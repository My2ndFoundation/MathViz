import { describe, expect, test } from "bun:test";
import type { PlatformClient } from "../../app/src/lib/agent/platform/client";
import { aiStatus, ENGINES_TTL_MS } from "../../app/src/lib/server/ai";

/**
 * aiStatus()'s /ai/engines read is shared for ENGINES_TTL_MS: the top bar's indicator and the
 * Settings card both read the status every 10 s, and must not each cost a platform call.
 */

function platformCounting(reply: () => Promise<unknown>) {
  const counter = { calls: 0 };
  const platform = {
    engines: () => {
      counter.calls++;
      return reply();
    },
  } as unknown as PlatformClient;
  return { counter, ctx: { ai: { platform, mcpToken: "x", registered: true } } };
}

const usable = async () => [{ engine: "claude", granted: true, usable: true }];

describe("aiStatus /ai/engines cache", () => {
  test("one platform call per TTL, shared by concurrent readers; a new call after it", async () => {
    const { counter, ctx } = platformCounting(usable);
    const at = (ms: number) => ({ now: () => 1_000_000 + ms });
    const both = await Promise.all([aiStatus(ctx, at(0)), aiStatus(ctx, at(0))]);
    expect(both.map((s) => s.state)).toEqual(["available", "available"]);
    expect(counter.calls).toBe(1);
    await aiStatus(ctx, at(ENGINES_TTL_MS - 1));
    expect(counter.calls).toBe(1);
    await aiStatus(ctx, at(ENGINES_TTL_MS));
    expect(counter.calls).toBe(2);
  });

  test("a failed read is reused for the TTL too, then asked again", async () => {
    let fail = true;
    const { counter, ctx } = platformCounting(async () => {
      if (fail) throw new Error("down");
      return usable();
    });
    const at = (ms: number) => ({ now: () => 5_000_000 + ms });
    expect((await aiStatus(ctx, at(0))).code).toBe("engine_unavailable");
    fail = false;
    expect((await aiStatus(ctx, at(1))).code).toBe("engine_unavailable");
    expect(counter.calls).toBe(1);
    expect((await aiStatus(ctx, at(ENGINES_TTL_MS + 1))).state).toBe("available");
    expect(counter.calls).toBe(2);
  });

  test("each platform client has its own entry", async () => {
    const a = platformCounting(usable);
    const b = platformCounting(usable);
    await aiStatus(a.ctx, { now: () => 0 });
    await aiStatus(b.ctx, { now: () => 0 });
    expect([a.counter.calls, b.counter.calls]).toEqual([1, 1]);
  });
});
