import { describe, expect, test } from "bun:test";
import {
  type AiJobsState,
  type AiJobsView,
  aiIndicator,
  createAiJobsReader,
} from "../../app/src/components/ai/use-ai-jobs";

/**
 * The AI indicator's reads (review I1, M2) without React or timers: each load is a promise the test
 * settles by hand, so "a read slower than the poll interval" is an ordering, not a wait.
 */

const view = (n: number): AiJobsView =>
  ({
    ai: { available: true, reason: null, state: "available" },
    active: Array.from({ length: n }, (_, i) => ({ id: `j${i}` })),
    recent: [],
  }) as unknown as AiJobsView;

function harness() {
  const pending: { resolve: (v: AiJobsView) => void; reject: (e: unknown) => void }[] = [];
  let state: AiJobsState = { data: null, failed: false };
  const reader = createAiJobsReader(
    () =>
      new Promise<AiJobsView>((resolve, reject) => {
        pending.push({ resolve, reject });
      }),
    (update) => {
      state = update(state);
    },
  );
  return {
    reader,
    pending,
    get state() {
      return state;
    },
  };
}

describe("createAiJobsReader", () => {
  test("a routine read is not started while one is in flight, so a slow answer is still shown", async () => {
    const h = harness();
    const first = h.reader.read(); // t=0
    expect(await h.reader.read()).toBe(false); // the 10 s tick while the first is out
    expect(h.pending.length).toBe(1);
    h.pending[0]?.resolve(view(2)); // it answers at t=15 s
    expect(await first).toBe(true);
    expect(h.state).toEqual({ data: view(2), failed: false });
    // and the next tick reads again
    const next = h.reader.read();
    expect(h.pending.length).toBe(2);
    h.pending[1]?.resolve(view(3));
    await next;
    expect(h.state.data?.active.length).toBe(3);
  });

  test("a forced read starts anyway; an older answer arriving after a newer one is dropped", async () => {
    const h = harness();
    const older = h.reader.read();
    const newer = h.reader.read({ force: true });
    expect(h.pending.length).toBe(2);
    h.pending[1]?.resolve(view(5));
    expect(await newer).toBe(true);
    h.pending[0]?.resolve(view(1));
    expect(await older).toBe(false);
    expect(h.state.data?.active.length).toBe(5);
  });

  test("a newer answer is applied even when a later read has started (the newest finished wins)", async () => {
    const h = harness();
    const a = h.reader.read();
    const b = h.reader.read({ force: true });
    h.pending[0]?.resolve(view(1));
    expect(await a).toBe(true); // nothing newer has been applied yet
    h.pending[1]?.resolve(view(2));
    expect(await b).toBe(true);
    expect(h.state.data?.active.length).toBe(2);
  });

  test("a failed read keeps the last lists and marks them failed; the light says unknown, the count stays", async () => {
    const h = harness();
    const ok = h.reader.read();
    h.pending[0]?.resolve(view(1));
    await ok;
    const bad = h.reader.read();
    h.pending[1]?.reject(new Error("HTTP 500"));
    await bad;
    expect(h.state).toEqual({ data: view(1), failed: true });
    expect(aiIndicator(h.state.data, h.state.failed)).toEqual({
      tone: "unknown",
      active: 1,
      reason: null,
    });
    expect(aiIndicator(h.state.data, false).tone).toBe("ok");
  });
});
