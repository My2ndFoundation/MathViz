// After MathTestBuddy trainer/src/lib/addons/sync.ts (createAddonSync), minimally. Kept: the
// platform's /addons/v1/installed as the truth, asked again every POLL_MS and after every Settings
// or empty-state action, onChange only when the installed set changed, refresh() serialized (one
// running, one queued), the set compared in a canonical order. Dropped: the persisted
// addons-installed.json (findContent asks the platform itself, so the content is never located
// from a stale list; the platform is local and the call is bounded by the client's timeout), the
// failed-reload backoff (onChange is refreshContent, which never throws past a log), the base
// resolver (this app has one content pack). Added: observe() — every installed() answer the
// content was located with becomes the baseline, so a change is measured against what is served.
import type { AddonsClient, InstalledAddon } from "./client";

export const POLL_MS = 10_000;

export interface AddonSync {
  /** Record an installed() answer that the content was just located with. */
  observe(rows: InstalledAddon[] | "unsupported"): void;
  /** Ask the platform again; true when the installed set changed (onChange has run). */
  refresh(): Promise<boolean>;
  start(): void;
  stop(): void;
}

export interface AddonSyncConfig {
  client: Pick<AddonsClient, "installed"> | null;
  onChange: () => Promise<unknown>;
  log?: (event: string, fields?: Record<string, unknown>) => void;
  intervalMs?: number;
}

/** A canonical form of an answer, to compare sets in any order. */
export const keyOf = (rows: InstalledAddon[] | "unsupported"): string =>
  rows === "unsupported"
    ? "unsupported"
    : JSON.stringify(
        [...rows]
          .map((a) => [a.addonId, a.kind, a.version, a.path])
          .sort((a, b) => (a.join("\0") < b.join("\0") ? -1 : 1)),
      );

export function createAddonSync({
  client,
  onChange,
  log = () => {},
  intervalMs = POLL_MS,
}: AddonSyncConfig): AddonSync {
  let seen: string | null = null;
  let running: Promise<boolean> | null = null;
  let queued: Promise<boolean> | null = null;
  let timer: ReturnType<typeof setInterval> | null = null;

  async function run(): Promise<boolean> {
    if (!client) return false;
    let rows: InstalledAddon[] | "unsupported";
    try {
      rows = await client.installed();
    } catch (e) {
      log("addons.sync_failed", { code: (e as { code?: unknown } | null)?.code ?? null });
      return false;
    }
    const key = keyOf(rows);
    if (key === seen) return false;
    seen = key;
    log("addons.installed_changed");
    await onChange();
    return true;
  }

  function refresh(): Promise<boolean> {
    if (!running) {
      running = run().finally(() => {
        running = null;
      });
      return running;
    }
    // one queued run, after the one in flight: it sees whatever finished meanwhile
    queued ??= running.then(() => {
      queued = null;
      return refresh();
    });
    return queued;
  }

  return {
    observe(rows) {
      seen = keyOf(rows);
    },
    refresh,
    start() {
      if (timer || !client) return;
      timer = setInterval(() => void refresh(), intervalMs);
      timer.unref?.();
    },
    stop() {
      if (timer) clearInterval(timer);
      timer = null;
    },
  };
}
