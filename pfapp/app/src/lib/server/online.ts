// After MathTestBuddy trainer/src/lib/api/online.ts. Kept: the platform's /addons/v1 through the
// server so the app secret never reaches the browser; our ETag wrapping the platform's with the
// UI language (it picks the summary), If-None-Match → 304; an unreachable platform answering
// {supported: true, offline: true}; the installed set read again after every list that changed
// and after every action, so the content reloads at once; the refusal → HTTP mapping (STATUS).
// Changed: one row, not a list — this app has exactly one content add-on (contentAddonId), so the
// routes take no :addonId; the language comes from ?lang= (the page's URL locale) rather than a
// setting. Dropped: remove, update-all, the base resolver, the icon proxy (the row carries no
// icon: the page CSP allows only 'self' and nothing here fetches one).
import { AddonError, type AddonRow } from "../addons/client";
import { contentAddonId } from "../content/pfaddon";
import { HttpError, jsonResponse } from "../http/errors";
import type { Handler } from "../http/route";
import { isLocale, type Locale } from "../i18n/locale";
import type { AppContext } from "./context";
import { getLang } from "./settings";

/**
 * The content pack in the PrimeForge store:
 *   GET  /api/content/online[?lang=en|zh]  → {supported, offline, addon: OnlineRow | null};
 *                                            ETag, If-None-Match → 304
 *   POST /api/content/online/install       → 202 {state: "installing"} | 200 {state: "installed"}
 *   POST /api/content/online/update        → as install
 *   POST /api/content/online/get           → 202 {opened: true} (the PrimeForge store window opens;
 *                                            the platform installs it by itself once it is owned)
 * Refusals: addon_not_owned (the UI then calls get), app_too_old, signed_out, app_not_installed,
 * installing (409); offline, unsupported (503); not_found (404); addon_failed (502).
 */

export interface OnlineRow {
  addonId: string;
  title: string;
  /** In the UI's language (summaryZh for zh when the store has one). */
  summary: string | null;
  price: { display: string; free: boolean } | null;
  owned: boolean;
  latestVersion: string | null;
  installedVersion: string | null;
  updateAvailable: boolean;
  state: AddonRow["state"];
  progress?: { receivedBytes: number; totalBytes: number };
  blockedReason?: string;
  error?: string;
}

export interface OnlineView {
  supported: boolean;
  offline: boolean;
  addon: OnlineRow | null;
}

const STATUS: Record<string, [number, string]> = {
  addon_not_owned: [409, "addon_not_owned"],
  app_too_old: [409, "app_too_old"],
  signed_out: [409, "signed_out"],
  app_not_installed: [409, "app_not_installed"],
  installing: [409, "installing"],
  offline: [503, "offline"],
  unreachable: [503, "offline"],
  unsupported: [503, "unsupported"],
  not_found: [404, "not_found"],
};

/** Run a platform call; its AddonError becomes the app's HTTP error. */
async function platform<T>(fn: () => Promise<T>): Promise<T> {
  try {
    return await fn();
  } catch (e) {
    if (e instanceof AddonError || (e as { name?: unknown } | null)?.name === "AddonError") {
      const [status, code] = STATUS[(e as AddonError).code] ?? [502, "addon_failed"];
      throw new HttpError(status, code);
    }
    throw e;
  }
}

function client(app: AppContext) {
  if (!app.addons) throw new HttpError(503, "unsupported");
  return app.addons;
}

/** Read /installed again (the content reloads when the set changed); never fails the action. */
async function resync(app: AppContext) {
  await app.addonSync.refresh().catch(() => false);
}

const ourEtag = (locale: string, platformEtag: string) =>
  `"${locale}~${platformEtag.replaceAll('"', "")}"`;
function platformEtagOf(header: string | null, locale: string): string | null {
  const m = header ? /^"([^"~]+)~([^"]*)"$/.exec(header.trim()) : null;
  return m && m[1] === locale ? `"${m[2]}"` : null;
}

const NONE = (supported: boolean, offline: boolean): OnlineView => ({
  supported,
  offline,
  addon: null,
});

function toRow(a: AddonRow, locale: Locale): OnlineRow {
  return {
    addonId: a.addonId,
    title: a.title,
    summary: (locale === "zh" ? a.summaryZh : null) ?? a.summary,
    price: a.price,
    owned: a.owned,
    latestVersion: a.latestVersion,
    installedVersion: a.installedVersion,
    updateAvailable: a.updateAvailable,
    state: a.state,
    ...(a.progress && { progress: a.progress }),
    ...(a.blockedReason !== undefined && { blockedReason: a.blockedReason }),
    ...(a.error !== undefined && { error: a.error }),
  };
}

export const getOnline: Handler = async (app, { req, query }) => {
  if (!app.addons) return { body: NONE(false, false) };
  const addons = app.addons;
  const asked = query.get("lang");
  const locale: Locale = isLocale(asked) ? asked : getLang(app.db, app.target);
  const sent = platformEtagOf(req.headers.get("if-none-match"), locale);
  let r: Awaited<ReturnType<typeof addons.list>>;
  try {
    r = await addons.list(sent);
  } catch (e) {
    const code = (e as { code?: unknown } | null)?.code;
    app.log("addons.list_failed", { code: typeof code === "string" ? code : null });
    if (code === "unsupported") return { body: NONE(false, false) };
    // the platform did not answer: say so the way the platform says "store offline"
    return { body: NONE(true, true) };
  }
  if (r.notModified) {
    return new Response(null, {
      status: 304,
      headers: { etag: ourEtag(locale, r.etag), "cache-control": "no-store" },
    });
  }
  // the list changed (an install finished, the pack was bought): the installed set may have too
  await resync(app);
  const id = contentAddonId(app.target.appId);
  const row = r.list.addons.find((a) => a.addonId === id);
  const body: OnlineView = {
    supported: r.list.supported,
    offline: r.list.offline,
    addon: row ? toRow(row, locale) : null,
  };
  return jsonResponse(200, body, r.etag ? { etag: ourEtag(locale, r.etag) } : {});
};

function action(verb: "install" | "update"): Handler {
  return async (app) => {
    const addons = client(app);
    const id = contentAddonId(app.target.appId);
    const r = await platform(() => (verb === "install" ? addons.install(id) : addons.update(id)));
    app.log(`content.addon_${verb}`, { state: r.state });
    await resync(app);
    return { status: r.state === "installing" ? 202 : 200, body: { state: r.state } };
  };
}

export const postInstall = action("install");
export const postUpdate = action("update");

export const postGet: Handler = async (app) => {
  const addons = client(app);
  await platform(() => addons.get(contentAddonId(app.target.appId)));
  app.log("content.addon_get");
  return { status: 202, body: { opened: true } };
};
