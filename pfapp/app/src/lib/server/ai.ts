import { ENGINE_PREFERENCE } from "../agent/platform/client";
import { reconcileJobs } from "../ai/jobs";
import type { AppContext } from "./context";

/**
 * The AI startup (MathTestBuddy's startApp order): register the MCP secret with the platform,
 * retrying for a while (the platform service may still be coming up), then reconcile the jobs a
 * previous run left unfinished. Without a platform (development outside PrimeForge) or with a
 * read-only database, nothing happens. Logs names and codes only, never the secret.
 */

export const REGISTER_RETRY_MS = 15_000;
const REGISTER_PAUSE_MS = 1_000;

const errField = (e: unknown, k: "status" | "code"): unknown =>
  typeof e === "object" && e !== null ? (e as Record<string, unknown>)[k] : undefined;

/** Register ctx.ai.mcpToken once; true when the platform accepted it. */
export async function registerMcp(ctx: AppContext): Promise<boolean> {
  const { platform } = ctx.ai;
  if (!platform || ctx.db.readOnly) return false;
  try {
    await platform.registerMcp(ctx.ai.mcpToken);
    ctx.ai.registered = true;
    ctx.log("mcp.registered");
    return true;
  } catch (e) {
    ctx.ai.registered = false;
    ctx.log("mcp.register_failed", {
      status: errField(e, "status") ?? null,
      code: errField(e, "code") ?? null,
    });
    return false;
  }
}

export async function startAi(
  ctx: AppContext,
  { retryMs = REGISTER_RETRY_MS, pauseMs = REGISTER_PAUSE_MS } = {},
): Promise<boolean> {
  const { platform } = ctx.ai;
  if (!platform || ctx.db.readOnly) return false;
  const until = Date.now() + retryMs;
  let ok = await registerMcp(ctx);
  while (!ok && Date.now() < until) {
    await new Promise((r) => setTimeout(r, pauseMs));
    ok = await registerMcp(ctx);
  }
  if (!ok) return false;
  try {
    const s = await reconcileJobs(ctx.db, platform);
    ctx.log("ai.reconciled", {
      polled: s.polled,
      lost: s.lost,
      ended: s.ended,
      errors: s.errors.length,
    });
  } catch (e) {
    ctx.log("ai.reconcile_failed", { error: e instanceof Error ? e.name : "Error" });
  }
  return true;
}

export type AiAvailability = "available" | "not_authorised" | "unavailable";

/**
 * The Settings page's AI card (after MTB's aiStatus, lib/api/status.ts): `available` when the
 * platform is there, this app's MCP secret is registered and an engine it may use can run;
 * otherwise why, in the codes the Q&A already speaks — ai_unavailable (no platform),
 * not_registered, engine_not_granted (no engine granted → not_authorised), engine_unavailable
 * (granted but none can run). A platform without /ai/engines (null) is judged by registration
 * alone; a failing engine read reads as unavailable.
 */
export async function aiStatus(
  ctx: Pick<AppContext, "ai">,
): Promise<{ state: AiAvailability; code: string | null }> {
  const { platform } = ctx.ai;
  if (!platform) return { state: "unavailable", code: "ai_unavailable" };
  let engines: unknown = null;
  try {
    engines = platform.engines ? await platform.engines() : null;
  } catch {
    return { state: "unavailable", code: "engine_unavailable" };
  }
  if (Array.isArray(engines)) {
    const ours = engines.filter(
      (e) =>
        typeof e === "object" &&
        e !== null &&
        ENGINE_PREFERENCE.some((p) => p.engine === (e as { engine?: unknown }).engine),
    ) as { granted?: unknown; usable?: unknown }[];
    if (!ours.some((e) => e.granted === true)) {
      return { state: "not_authorised", code: "engine_not_granted" };
    }
    if (!ours.some((e) => e.granted === true && e.usable === true)) {
      return { state: "unavailable", code: "engine_unavailable" };
    }
  }
  if (!ctx.ai.registered) return { state: "unavailable", code: "not_registered" };
  return { state: "available", code: null };
}
