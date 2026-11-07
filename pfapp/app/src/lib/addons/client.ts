// Ported from MathTestBuddy trainer/src/lib/addons/client.ts (commit 3e01e49). Kept: the bearer
// call shape, the timeout, the installed schema, "not ours" filtering, 403/404 = unsupported, the
// AddonError codes a GET can produce. Changed: 503 not_configured (a platform with no add-on
// service) also reads as unsupported here, as the reference's list() already treats it. Dropped: list / install / update / get / remove and their
// schemas (the pfapp's first use is findContent, which reads `installed` only — add them back from
// the reference when the store UI lands); `import "server-only"`; APP_ID is a parameter, since one
// codebase builds four apps.
import { z } from "zod";

/**
 * The PrimeForge desktop's add-on API for this app (PFD packages/platform-service/src/addons/routes.ts):
 *
 *   GET /addons/v1/installed   {addons: [{addonId, kind, version, path}]} — installed *and usable*
 *                              (entitled), `path` the absolute `payload/` of the current version
 *
 * Server only: every call carries PRIMEFORGE_API_SECRET as a bearer. A desktop older than 1.45
 * answers 404 and a manifest without the "addons" capability 403: both read as unsupported.
 */

export interface InstalledAddon {
  addonId: string;
  kind: string;
  version: string;
  /** Absolute path of the add-on's payload/, read-only. */
  path: string;
}

export type AddonErrorCode =
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
  ) {
    super(`add-on request refused: ${code}${status ? ` (${status})` : ""}`);
  }
}

/** What the app needs of the add-on API (the real client or a test double). */
export interface AddonsClient {
  /** The installed add-ons the account may use; "unsupported" on a desktop without add-ons. */
  installed(): Promise<InstalledAddon[] | "unsupported">;
}

export interface AddonsClientConfig {
  apiUrl: string;
  secret: string;
  /** This app's id: rows of any other app are dropped. */
  appId: string;
  fetch?: (url: string, init: RequestInit) => Promise<Response>;
  timeoutMs?: number;
}

const installedSchema = z.object({
  addons: z.array(
    z.object({ addonId: z.string(), kind: z.string(), version: z.string(), path: z.string() }),
  ),
});

const field = (j: unknown, k: string): unknown =>
  typeof j === "object" && j !== null ? (j as Record<string, unknown>)[k] : undefined;

/** A refusal's body → AddonError. */
function refusal(status: number, body: unknown): AddonError {
  if (status === 403) return new AddonError("unsupported", status);
  if (status === 503 && field(body, "error") === "not_configured") {
    return new AddonError("unsupported", status);
  }
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

  async function send(method: string, path: string): Promise<{ status: number; body: unknown }> {
    let res: Response;
    try {
      res = await fetchImpl(`${base}${path}`, {
        method,
        headers: { authorization: `Bearer ${secret}` },
        signal: AbortSignal.timeout(timeoutMs),
      });
    } catch {
      throw new AddonError("unreachable");
    }
    const body = await res.json().catch(() => null);
    return { status: res.status, body };
  }

  return {
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
  };
}
