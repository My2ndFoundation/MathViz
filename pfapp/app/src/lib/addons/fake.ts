// Ported from MathTestBuddy trainer/src/lib/addons/fake.ts (the development stand-in for
// /addons/v1). Kept: offers read from a directory of <slug>/{addon.json, payload/}, an install
// that takes installMs with byte progress and then "installs" the payload in place (nothing is
// copied), the installed set persisted in stateFile, a not-owned offer refusing install with
// addon_not_owned, get() opening nothing, the ETag a hash of the list. Changed: APP_ID is a
// parameter and an offer is this app's content pack only (addon.json read with
// parseContentManifest, payload/ must hold catalog.json); every offer is free and owned unless
// `paid` names its slug (MTB defaults one pack to paid); no remove() (the client has none here).
import { createHash } from "node:crypto";
import { mkdirSync, readdirSync, readFileSync, renameSync, statSync, writeFileSync } from "node:fs";
import path from "node:path";
import { parseContentManifest } from "../content/pfaddon";
import {
  AddonError,
  type AddonList,
  type AddonRow,
  type AddonsClient,
  type InstalledAddon,
} from "./client";

/**
 * A development stand-in for the platform's /addons/v1 (MATHVIZ_FAKE_ADDONS=1; context.ts), so
 * the Settings page and the empty state's install can be tried without PrimeForge, and the e2e
 * suite can drive them. The store is `root`: each `<slug>/` holding this app's addon.json and a
 * payload/ is an offer. The payload directory is reported as installed in place, so `root` is
 * also the containment root findContent holds the reported path to.
 */

export interface FakeAddonsConfig {
  appId: string;
  /** A directory of <slug>/{addon.json, payload/}. */
  root: string;
  stateFile: string;
  now?: () => number;
  installMs?: number;
  /** The slugs that cost money and are not owned (default: none). */
  paid?: readonly string[];
}

interface Offer {
  addonId: string;
  slug: string;
  kind: string;
  title: string;
  version: string;
  dir: string;
  bytes: number;
}

function readOffers(root: string, appId: string): Offer[] {
  let names: string[];
  try {
    names = readdirSync(root).sort();
  } catch {
    return [];
  }
  const out: Offer[] = [];
  for (const slug of names) {
    const dir = path.join(root, slug, "payload");
    try {
      if (!statSync(path.join(dir, "catalog.json")).isFile()) continue;
      const m = parseContentManifest(
        readFileSync(path.join(root, slug, "addon.json"), "utf8"),
        appId,
      );
      if (m.id !== `${appId}/${slug}`) continue;
      let bytes = 0;
      for (const f of readdirSync(dir, { recursive: true }) as string[]) {
        const s = statSync(path.join(dir, f));
        if (s.isFile()) bytes += s.size;
      }
      out.push({
        addonId: m.id,
        slug,
        kind: m.kind,
        title: m.title,
        version: m.version,
        dir: path.resolve(dir),
        bytes,
      });
    } catch {
      // not an add-on dir
    }
  }
  return out;
}

function writeAtomic(file: string, text: string): void {
  const tmp = `${file}.${process.pid}.tmp`;
  writeFileSync(tmp, text);
  renameSync(tmp, file);
}

export function createFakeAddons({
  appId,
  root,
  stateFile,
  now = Date.now,
  installMs = 4000,
  paid = [],
}: FakeAddonsConfig): AddonsClient {
  const unowned = new Set(paid);
  let installed: Record<string, string> = {};
  try {
    installed = JSON.parse(readFileSync(stateFile, "utf8")).installed ?? {};
  } catch {
    // a fresh fake
  }
  const jobs = new Map<string, { startedAt: number; version: string }>();

  const save = () => {
    mkdirSync(path.dirname(stateFile), { recursive: true });
    writeAtomic(stateFile, JSON.stringify({ installed }));
  };

  /** Finish the jobs whose time is up. */
  function settle() {
    for (const [id, j] of jobs) {
      if (now() - j.startedAt < installMs) continue;
      jobs.delete(id);
      installed[id] = j.version;
      save();
    }
  }

  const owned = (o: Offer) => !unowned.has(o.slug);
  const find = (id: string) => {
    const o = readOffers(root, appId).find((x) => x.addonId === id);
    if (!o) throw new AddonError("not_found", 404);
    return o;
  };

  function rows(): AddonList {
    settle();
    const addons: AddonRow[] = readOffers(root, appId).map((o) => {
      const here = installed[o.addonId] ?? null;
      const job = jobs.get(o.addonId);
      const update = here !== null && here !== o.version;
      const state: AddonRow["state"] = job
        ? "installing"
        : here !== null
          ? update
            ? "update"
            : "installed"
          : owned(o)
            ? "owned"
            : "available";
      return {
        addonId: o.addonId,
        kind: o.kind,
        title: o.title,
        summary: `${o.title}, from the development store (MATHVIZ_FAKE_ADDONS).`,
        summaryZh: `${o.title}（开发用的假商店）`,
        iconUrl: null,
        price: unowned.has(o.slug)
          ? { display: "£4.99", free: false }
          : { display: "Free", free: true },
        owned: owned(o),
        latestVersion: o.version,
        installedVersion: here,
        updateAvailable: update,
        state,
        ...(job && {
          progress: {
            receivedBytes: Math.min(
              o.bytes,
              Math.round((o.bytes * (now() - job.startedAt)) / installMs),
            ),
            totalBytes: o.bytes,
          },
        }),
        productId: `fake-${o.slug}`,
      };
    });
    return { supported: true, offline: false, addons };
  }

  async function begin(id: string) {
    settle();
    const o = find(id);
    if (jobs.has(id)) return { state: "installing" as const };
    if (!owned(o)) throw new AddonError("addon_not_owned", 409, { productId: `fake-${o.slug}` });
    if (installed[id] === o.version) return { state: "installed" as const };
    jobs.set(id, { startedAt: now(), version: o.version });
    return { state: "installing" as const };
  }

  return {
    async list(etag) {
      const list = rows();
      const tag = `"${createHash("sha256").update(JSON.stringify(list)).digest("hex").slice(0, 32)}"`;
      if (etag === tag) return { notModified: true, etag: tag };
      return { notModified: false, etag: tag, list };
    },
    async installed() {
      settle();
      const out: InstalledAddon[] = [];
      for (const o of readOffers(root, appId)) {
        const v = installed[o.addonId];
        if (v !== undefined)
          out.push({ addonId: o.addonId, kind: o.kind, version: v, path: o.dir });
      }
      return out;
    },
    install: begin,
    update: begin,
    async get(id) {
      find(id);
      return { opened: true };
    },
  };
}
