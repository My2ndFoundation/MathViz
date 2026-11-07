// Ported from MathTestBuddy trainer/src/lib/addons/client.ts (commit 3e01e49; list / install /
// update / get added back from the same file for the Settings page). remove() stays out: taking
// the only content pack away would leave the app empty, and nothing asks for it. Kept: the bearer
// call shape, the timeout, the row / list / installed schemas, ETag + 304, "not ours" filtering,
// the refusal mapping (409 action:get → addon_not_owned, 409 app_too_old / signed_out /
// app_not_installed / installing, 503 offline, 503 not_configured → unsupported, 403/404 →
// unsupported on a GET), UNSUPPORTED. Changed: `import "server-only"` dropped; APP_ID is a
// parameter, since one codebase builds four apps; installed() also reads 503 not_configured as
// unsupported (as list() does), so findContent never logs a platform without add-ons as a failure.
import { z } from "zod";

/**
 * The PrimeForge desktop's add-on API for this app, /addons/v1 (PFD
 * packages/platform-service/src/addons/routes.ts). Server only: every call carries
 * PRIMEFORGE_API_SECRET as a bearer, and nothing here reaches the browser except the parsed rows.
 * Ids in paths are encodeURIComponent(addonId), so the slash travels as %2F.
 *
 *   GET    /addons/v1                {offline, supported?, addons: [row]}   ETag; If-None-Match → 304
 *   GET    /addons/v1/installed      {addons: [{addonId, kind, version, path}]} — installed *and
 *                                    usable* (entitled), `path` the absolute payload/ of the version
 *   POST   /addons/v1/<id>/install   202 {state: installing} | 200 {state: installed} | 409 / 503 refusals
 *   POST   /addons/v1/<id>/update    as install
 *   POST   /addons/v1/<id>/get       202 {opened: true} (the PrimeForge store window opens)
 *
 * A desktop older than 1.45 answers 404 on everything, and a manifest without the "addons"
 * capability 403 on everything: both read as unsupported.
 */

export const ADDON_STATES = [
  "available",
  "owned",
  "installing",
  "installed",
  "update",
  "blocked",
] as const;

const rowSchema = z.object({
  addonId: z.string(),
  kind: z.string(),
  title: z.string(),
  summary: z.string().nullable().default(null),
  summaryZh: z.string().nullable().default(null),
  iconUrl: z.string().nullable().default(null),
  price: z.object({ display: z.string(), free: z.boolean() }).nullable().default(null),
  owned: z.boolean(),
  latestVersion: z.string().nullable().default(null),
  installedVersion: z.string().nullable().default(null),
  updateAvailable: z.boolean().default(false),
  state: z.enum(ADDON_STATES),
  progress: z
    .object({ receivedBytes: z.number().min(0), totalBytes: z.number().min(0) })
    .optional(),
  blockedReason: z.string().optional(),
  error: z.string().optional(),
  productId: z.string().nullable().default(null),
});

export type AddonRow = z.infer<typeof rowSchema>;

export interface AddonList {
  /** false: the desktop or its store does not offer add-ons (old desktop, store too old). */
  supported: boolean;
  /** true: the store is unreachable; only installed add-ons are listed. */
  offline: boolean;
  addons: AddonRow[];
}

export type ListResult =
  | { notModified: true; etag: string }
  | { notModified: false; etag: string | null; list: AddonList };

export interface InstalledAddon {
  addonId: string;
  kind: string;
  version: string;
  /** Absolute path of the add-on's payload/, read-only. */
  path: string;
}

export const UNSUPPORTED: AddonList = Object.freeze({
  supported: false,
  offline: false,
  addons: [],
}) as AddonList;

export type AddonErrorCode =
  /** not owned: the app opens the store with get (the platform remembers the install for 30 min) */
  | "addon_not_owned"
  | "app_too_old"
  | "signed_out"
  | "app_not_installed"
  | "installing"
  | "offline"
  | "unsupported"
  | "not_found"
  /** the platform did not answer (network or timeout) */
  | "unreachable"
  /** an answer outside the contract */
  | "bad_reply";

export class AddonError extends Error {
  override readonly name = "AddonError";
  constructor(
    readonly code: AddonErrorCode,
    readonly status = 0,
    readonly extra: { productId?: string | null; minAppVersion?: string } = {},
  ) {
    super(`add-on request refused: ${code}${status ? ` (${status})` : ""}`);
  }
  get productId(): string | null | undefined {
    return this.extra.productId;
  }
  get minAppVersion(): string | undefined {
    return this.extra.minAppVersion;
  }
}

/** What the app needs of the add-on API (the real client, the dev fake, or a test double). */
export interface AddonsClient {
  list(etag?: string | null): Promise<ListResult>;
  /** The installed add-ons the account may use; "unsupported" on a desktop without add-ons. */
  installed(): Promise<InstalledAddon[] | "unsupported">;
  install(addonId: string): Promise<{ state: "installing" | "installed" }>;
  update(addonId: string): Promise<{ state: "installing" | "installed" }>;
  get(addonId: string): Promise<{ opened: true }>;
}

export interface AddonsClientConfig {
  apiUrl: string;
  secret: string;
  /** This app's id: rows of any other app are dropped. */
  appId: string;
  fetch?: (url: string, init: RequestInit) => Promise<Response>;
  timeoutMs?: number;
}

const listSchema = z.object({
  offline: z.boolean().default(false),
  supported: z.boolean().optional(),
  addons: z.array(z.unknown()),
});

const installedSchema = z.object({
  addons: z.array(
    z.object({ addonId: z.string(), kind: z.string(), version: z.string(), path: z.string() }),
  ),
});

const stateSchema = z.object({ state: z.enum(["installing", "installed"]) });

const field = (j: unknown, k: string): unknown =>
  typeof j === "object" && j !== null ? (j as Record<string, unknown>)[k] : undefined;

/** A refusal's body → AddonError. */
export function refusal(status: number, body: unknown): AddonError {
  const error = field(body, "error");
  if (status === 403) return new AddonError("unsupported", status);
  if (status === 409 && field(body, "action") === "get") {
    const productId = field(body, "productId");
    return new AddonError("addon_not_owned", status, {
      productId: typeof productId === "string" ? productId : null,
    });
  }
  if (status === 409 && error === "app_too_old") {
    const min = field(body, "minAppVersion");
    return new AddonError(
      "app_too_old",
      status,
      typeof min === "string" ? { minAppVersion: min } : {},
    );
  }
  if (
    status === 409 &&
    (error === "signed_out" || error === "app_not_installed" || error === "installing")
  ) {
    return new AddonError(error, status);
  }
  if (status === 503 && error === "offline") return new AddonError("offline", status);
  if (status === 503 && error === "not_configured") return new AddonError("unsupported", status);
  if (status === 404) return new AddonError("not_found", status);
  return new AddonError("bad_reply", status);
}

export function createAddonsClient({
  apiUrl,
  secret,
  appId,
  fetch: fetchImpl = globalThis.fetch,
  timeoutMs = 10_000,
}: AddonsClientConfig): AddonsClient {
  const base = String(apiUrl ?? "").replace(/\/+$/, "");
  const ours = (addonId: string) => addonId.startsWith(`${appId}/`);

  async function send(
    method: string,
    path: string,
    headers: Record<string, string> = {},
  ): Promise<{ status: number; body: unknown; etag: string | null }> {
    let res: Response;
    try {
      res = await fetchImpl(`${base}${path}`, {
        method,
        headers: { authorization: `Bearer ${secret}`, ...headers },
        signal: AbortSignal.timeout(timeoutMs),
      });
    } catch {
      throw new AddonError("unreachable");
    }
    const body = res.status === 304 ? null : await res.json().catch(() => null);
    return { status: res.status, body, etag: res.headers.get("etag") };
  }

  const one = (addonId: string) => `/addons/v1/${encodeURIComponent(addonId)}`;

  async function act(addonId: string, verb: "install" | "update") {
    const r = await send("POST", `${one(addonId)}/${verb}`);
    if (r.status !== 200 && r.status !== 202) throw refusal(r.status, r.body);
    const parsed = stateSchema.safeParse(r.body);
    if (!parsed.success) throw new AddonError("bad_reply", r.status);
    return parsed.data;
  }

  return {
    async list(etag) {
      const r = await send("GET", "/addons/v1", etag ? { "if-none-match": etag } : {});
      if (r.status === 304) return { notModified: true, etag: r.etag ?? etag ?? "" };
      if (r.status === 404 || r.status === 403) {
        return { notModified: false, etag: null, list: { ...UNSUPPORTED, addons: [] } };
      }
      if (r.status !== 200) {
        const e = refusal(r.status, r.body);
        // the platform has no add-on service (503 not_configured): not offline, unsupported
        if (e.code === "unsupported") {
          return { notModified: false, etag: null, list: { ...UNSUPPORTED, addons: [] } };
        }
        throw e;
      }
      const parsed = listSchema.safeParse(r.body);
      if (!parsed.success) throw new AddonError("bad_reply", r.status);
      const addons: AddonRow[] = [];
      for (const raw of parsed.data.addons) {
        const row = rowSchema.safeParse(raw);
        if (row.success && ours(row.data.addonId)) addons.push(row.data);
      }
      return {
        notModified: false,
        etag: r.etag,
        list: {
          supported: parsed.data.supported !== false,
          offline: parsed.data.offline,
          addons,
        },
      };
    },

    async installed() {
      const r = await send("GET", "/addons/v1/installed");
      if (r.status === 404 || r.status === 403) return "unsupported";
      if (r.status !== 200) {
        const e = refusal(r.status, r.body);
        if (e.code === "unsupported") return "unsupported";
        throw e;
      }
      const parsed = installedSchema.safeParse(r.body);
      if (!parsed.success) throw new AddonError("bad_reply", r.status);
      return parsed.data.addons.filter((a) => ours(a.addonId));
    },

    install: (addonId) => act(addonId, "install"),
    update: (addonId) => act(addonId, "update"),

    async get(addonId) {
      const r = await send("POST", `${one(addonId)}/get`);
      if (r.status !== 200 && r.status !== 202) throw refusal(r.status, r.body);
      return { opened: true };
    },
  };
}
