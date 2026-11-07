"use client";

// After MathTestBuddy trainer/src/components/settings/online-packs.tsx. Kept: the 2 s ETag poll
// while the page is visible (30 s without the platform's add-ons), one request at a time with a
// sequence guard, the button by state (available → Get, owned → Install, update → Update,
// installed → a disabled Installed, installing → a progress bar), the blocked reason, the
// last-error line, addon_not_owned → POST …/get with the "finish in the store window" note, the
// offline / unsupported one-liner, onChange when the installed version or state changes, one
// always-mounted live region for the note. Changed: one row (this app has one content pack), no
// icon, our CSS classes instead of shadcn; `onInstalled` (the empty state's way into the first
// tool) runs when the row becomes installed after this component first saw it otherwise.
import { useCallback, useEffect, useRef, useState } from "react";
import type { Locale } from "@/lib/i18n/locale";
import { MESSAGES } from "@/lib/i18n/locale";
import type { OnlineRow, OnlineView } from "@/lib/server/online";
import { ApiError, api, errorText } from "./qa/api";

/** How often the store is read while the page is on screen (the platform's own advice). */
const POLL_MS = 2000;
/** Without the platform's add-ons, ask again only this often. */
const UNSUPPORTED_POLL_MS = 30_000;

const installedKey = (v: OnlineView) =>
  v.addon ? `${v.addon.installedVersion ?? "-"}:${v.addon.state}` : "none";

export function OnlinePack({
  locale,
  onChange,
  onInstalled,
  primary = false,
}: {
  locale: Locale;
  /** The installed version or state changed (an install or update landed). */
  onChange?: () => void;
  /** The pack became installed while this was on screen. */
  onInstalled?: () => void;
  /** The empty state's big call to action. */
  primary?: boolean;
}) {
  const t = MESSAGES[locale].online;
  const [data, setData] = useState<OnlineView | null>(null);
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState<{ ok: boolean; text: string } | null>(null);
  const etag = useRef<string | null>(null);
  const seen = useRef<string | null>(null);
  const inflight = useRef<Promise<void> | null>(null);
  const sent = useRef(0);
  const applied = useRef(0);
  const lastAt = useRef(0);
  const supported = useRef(true);
  const changed = useRef(onChange);
  changed.current = onChange;
  const installed = useRef(onInstalled);
  installed.current = onInstalled;
  // false once unmounted: a reply still in flight then changes nothing and calls nobody back — an
  // install finishing after she left the empty state must not pull her off the page (review M2)
  const alive = useRef(true);

  const request = useCallback(async () => {
    const seq = ++sent.current;
    lastAt.current = Date.now();
    let res: Response;
    try {
      res = await fetch(`/api/content/online?lang=${locale}`, {
        cache: "no-store",
        headers: etag.current ? { "if-none-match": etag.current } : {},
      });
    } catch {
      return; // the app is restarting: try again on the next tick
    }
    if (res.status === 304 || !res.ok) return;
    const body = (await res.json()) as OnlineView;
    if (!alive.current) return;
    if (seq < applied.current) return; // a later reply already landed
    applied.current = seq;
    etag.current = res.headers.get("etag");
    supported.current = body.supported;
    setData(body);
    const key = installedKey(body);
    if (seen.current !== null && seen.current !== key) {
      changed.current?.();
      if (body.addon?.state === "installed") installed.current?.();
    }
    seen.current = key;
  }, [locale]);

  /** Read now: after the request in flight, if any (an action wants the state after it). */
  const poll = useCallback(async () => {
    while (inflight.current) await inflight.current;
    const p = request().finally(() => {
      inflight.current = null;
    });
    inflight.current = p;
    await p;
  }, [request]);

  useEffect(() => {
    alive.current = true;
    void poll();
    const tick = () => {
      if (document.visibilityState !== "visible" || inflight.current) return;
      if (!supported.current && Date.now() - lastAt.current < UNSUPPORTED_POLL_MS) return;
      void poll();
    };
    const timer = setInterval(tick, POLL_MS);
    document.addEventListener("visibilitychange", tick);
    return () => {
      alive.current = false;
      clearInterval(timer);
      document.removeEventListener("visibilitychange", tick);
    };
  }, [poll]);

  const act = async (verb: "install" | "update") => {
    setBusy(true);
    setNote(null);
    try {
      try {
        await api("POST", `/api/content/online/${verb}`);
      } catch (e) {
        // not owned yet: the store window takes over, and installs it once bought or claimed
        if (!(e instanceof ApiError) || e.code !== "addon_not_owned") throw e;
        await api("POST", "/api/content/online/get");
        if (alive.current) setNote({ ok: true, text: t.finishInStore });
      }
    } catch (e) {
      if (alive.current) setNote({ ok: false, text: errorText(e, locale) });
    } finally {
      if (alive.current) await poll();
      if (alive.current) setBusy(false);
    }
  };

  const button = (verb: "install" | "update", label: string) => (
    <button
      type="button"
      className={primary ? "chip primary big" : "chip primary"}
      data-testid="online-action"
      data-verb={verb}
      disabled={busy}
      aria-busy={busy}
      onClick={() => void act(verb)}
    >
      {label}
    </button>
  );

  if (!data) return <div className="online" data-testid="online-pack" data-loading="true" />;
  if (!data.supported || data.offline || !data.addon) {
    return (
      <div className="online" data-testid="online-pack">
        <p className="muted" data-testid="online-notice">
          {!data.supported ? t.unsupported : data.offline ? t.offline : t.notListed}
        </p>
      </div>
    );
  }
  const r: OnlineRow = data.addon;
  return (
    <div className="online" data-testid="online-pack" data-state={r.state}>
      <div className="online-row">
        <div className="online-info">
          <span className="online-title">{r.title}</span>
          {r.summary ? <span className="muted small">{r.summary}</span> : null}
          <span className="mono small" data-testid="online-price">
            {r.owned ? t.owned : r.price?.free ? t.free : r.price?.display || t.notForSale}
            {r.latestVersion ? ` · ${t.storeVersion.replace("{version}", r.latestVersion)}` : ""}
          </span>
          {r.state === "installing" ? <Progress row={r} label={t.installing} /> : null}
          {r.state === "blocked" ? (
            <span className="err small" data-testid="online-blocked">
              {r.blockedReason === "app_too_old"
                ? t.blockedAppTooOld
                : r.blockedReason === "not_entitled"
                  ? t.blockedNotEntitled
                  : r.blockedReason === "signed_out"
                    ? t.blockedSignedOut
                    : t.blockedOther}
            </span>
          ) : null}
          {r.error && r.state !== "installing" ? (
            <span role="alert" className="err small">
              {t.failed}
            </span>
          ) : null}
        </div>
        <div className="online-actions">
          {r.state === "available"
            ? button("install", t.get)
            : r.state === "owned"
              ? button("install", t.install)
              : r.state === "update"
                ? button("update", t.update)
                : null}
          {r.state === "installed" ? (
            <button type="button" className="chip" data-testid="online-installed" disabled>
              {t.installed}
            </button>
          ) : null}
        </div>
      </div>
      {/* one live region, always mounted, so the note is announced when it appears */}
      <p
        data-testid="online-note"
        aria-live="polite"
        className={note?.ok === false ? "err small" : "small"}
      >
        {note?.text ?? ""}
      </p>
    </div>
  );
}

function Progress({ row, label }: { row: OnlineRow; label: string }) {
  const total = row.progress?.totalBytes ?? 0;
  const pct =
    total > 0 ? Math.min(100, Math.round(((row.progress?.receivedBytes ?? 0) / total) * 100)) : 0;
  return (
    <div className="online-progress">
      <div
        role="progressbar"
        aria-label={label}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={pct}
        className="bar"
        data-testid="online-progress"
      >
        <div style={{ width: `${pct}%` }} />
      </div>
      <span className="muted small">{label}</span>
    </div>
  );
}
