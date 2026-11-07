import { randomBytes } from "node:crypto";
import path from "node:path";
import { type AddonsClient, createAddonsClient } from "../addons/client";
import { createPlatformClient, type PlatformClient } from "../agent/platform/client";
import { ensureIndexed } from "../content/index-builder";
import { type FoundContent, findContent } from "../content/installed";
import type { Db } from "../db/handle";
import { openDb } from "../db/open";
import { effectivePort, newCsrfToken, processCsrfToken } from "../http/guard";
import { loadTarget, type Target } from "../target";
import { startAi } from "./ai";

/**
 * The server's process-wide state: the target, the open database, the content pack it runs on,
 * the port the guard checks Host against and the CSRF token. Built once, lazily, on the first
 * request (getAppContext); tests build their own with an injected env (createAppContext) and
 * install it with setAppContext.
 *
 * Held on globalThis, not in a module variable: Next bundles each route (and the proxy)
 * separately, and a module-level singleton would be one database handle per bundle.
 */

export interface AppEnv {
  /** Where the database and manual imports live. Development: `<cwd>/.data/<target>`. */
  PRIMEFORGE_DATA_DIR?: string;
  /** The containment root of store-installed add-ons. */
  PRIMEFORGE_ADDONS_DIR?: string;
  /** The platform API; with the secret, enables store add-ons. */
  PRIMEFORGE_API_URL?: string;
  PRIMEFORGE_API_SECRET?: string;
  MATHVIZ_TARGET?: string;
  PRIMEFORGE_PORT?: string;
  PORT?: string;
  [key: string]: string | undefined;
}

export type Log = (event: string, fields?: Record<string, unknown>) => void;

/** The AI side: the platform client (null outside PrimeForge) and the MCP secret it was given. */
export interface AiState {
  readonly platform: PlatformClient | null;
  /** The bearer the platform must present on /api/mcp/** (registered with POST /ai/mcp). */
  readonly mcpToken: string;
  /** Whether the platform accepted mcpToken (lib/server/ai startAi). */
  registered: boolean;
}

export interface AppContext {
  readonly target: Target;
  readonly db: Db;
  /** PRIMEFORGE_DATA_DIR (or the development default): the database and manual imports. */
  readonly dataDir: string;
  /** The content pack served under /c/<content.version>/…; null when none is installed. */
  readonly content: FoundContent | null;
  /** The port the guard requires in Host. */
  readonly port: number;
  readonly csrfToken: string;
  readonly log: Log;
  readonly ai: AiState;
  /** Find the content pack again (after an import, a store install) and re-index if it changed. */
  refreshContent(): Promise<FoundContent | null>;
  close(): void;
}

export interface CreateOptions {
  /** A drizzle migrations folder (tests); defaults to the shipped one. */
  migrationsDir?: string;
  /** Defaults to a fresh token. getAppContext passes the process's (shared with the proxy). */
  csrfToken?: string;
  /** Overrides the client built from PRIMEFORGE_API_URL / _SECRET (tests). */
  addons?: Pick<AddonsClient, "installed"> | null;
  log?: Log;
  /** Overrides the client built from PRIMEFORGE_API_URL / _SECRET (tests); null = no AI. */
  platform?: PlatformClient | null;
  /** Defaults to a fresh 64-hex secret (the platform requires at least 64 characters). */
  mcpToken?: string;
}

const defaultLog: Log = (event, fields = {}) => {
  console.warn(JSON.stringify({ event, ...fields }));
};

export async function createAppContext(
  env: AppEnv,
  options: CreateOptions = {},
): Promise<AppContext> {
  const target = loadTarget(env.MATHVIZ_TARGET);
  const log = options.log ?? defaultLog;
  const dataDir = env.PRIMEFORGE_DATA_DIR || path.join(process.cwd(), ".data", target.id);
  const addons =
    options.addons !== undefined
      ? options.addons
      : env.PRIMEFORGE_API_URL && env.PRIMEFORGE_API_SECRET
        ? createAddonsClient({
            apiUrl: env.PRIMEFORGE_API_URL,
            secret: env.PRIMEFORGE_API_SECRET,
            appId: target.appId,
          })
        : null;
  const platform =
    options.platform !== undefined
      ? options.platform
      : env.PRIMEFORGE_API_URL && env.PRIMEFORGE_API_SECRET
        ? createPlatformClient({
            apiUrl: env.PRIMEFORGE_API_URL,
            secret: env.PRIMEFORGE_API_SECRET,
          })
        : null;
  const ai: AiState = {
    platform,
    mcpToken: options.mcpToken ?? randomBytes(32).toString("hex"),
    registered: false,
  };
  const db = openDb(dataDir, { migrationsDir: options.migrationsDir });

  async function locate(): Promise<FoundContent | null> {
    const found = await findContent({
      appId: target.appId,
      dataDir,
      addonsDir: env.PRIMEFORGE_ADDONS_DIR || null,
      addons,
      log,
    });
    if (!found) return null;
    try {
      ensureIndexed(db, found);
    } catch (e) {
      // the catalog would not describe this pack: serve nothing rather than a mismatched index
      log("content.index_failed", {
        version: found.version,
        source: found.source,
        error: e instanceof Error ? e.name : "Error",
      });
      return null;
    }
    return found;
  }

  let content: FoundContent | null;
  try {
    content = await locate();
  } catch (e) {
    db.close();
    throw e;
  }
  return {
    target,
    db,
    dataDir,
    get content() {
      return content;
    },
    port: effectivePort(env, target.port),
    csrfToken: options.csrfToken ?? newCsrfToken(),
    log,
    ai,
    async refreshContent() {
      content = await locate();
      return content;
    },
    close() {
      db.close();
    },
  };
}

const SLOT = Symbol.for("mathviz.pfapp.appContext");
type Slot = { [SLOT]?: Promise<AppContext> };

/**
 * The process's context, built on first use from process.env with the process's CSRF token (the
 * one the proxy checks). A failed build is not cached: the next request tries again.
 */
export function getAppContext(): Promise<AppContext> {
  const g = globalThis as Slot;
  if (!g[SLOT]) {
    const p = createAppContext(process.env as AppEnv, { csrfToken: processCsrfToken() });
    g[SLOT] = p;
    // register the MCP secret, then reconcile unfinished jobs — in the background, once per process
    p.then((ctx) => startAi(ctx)).catch(() => {});
    p.catch(() => {
      if (g[SLOT] === p) delete g[SLOT];
    });
  }
  return g[SLOT];
}

/** Install `ctx` as the process's context (tests), or clear it (null). Does not close the old one. */
export function setAppContext(ctx: AppContext | null): void {
  const g = globalThis as Slot;
  if (ctx) g[SLOT] = Promise.resolve(ctx);
  else delete g[SLOT];
}
