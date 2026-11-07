"use client";
// After MathTestBuddy trainer/src/lib/client/ai-jobs.ts: AI_POLL_MS, the view's types and the
// indicator's tone logic. Added: a window event the ask panel fires after it submits or cancels,
// so the count moves at once instead of on the next 10 s tick (no global store).
import {
  createContext,
  createElement,
  type ReactNode,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
} from "react";
import type { Locale } from "@/lib/i18n/locale";
import { MESSAGES } from "@/lib/i18n/locale";
import type { AiJobsView } from "@/lib/server/ai-jobs";
import { api } from "../qa/api";

export type { AiJobsView, AiJobView } from "@/lib/server/ai-jobs";

/** How often the AI indicator re-reads GET /api/ai/jobs while the window is visible. */
export const AI_POLL_MS = 10_000;
/** Fired on window when the AI queue changed here (a question sent, a job cancelled or ended). */
export const AI_JOBS_EVENT = "pfapp:ai-jobs";

export function notifyAiJobs(): void {
  if (typeof window !== "undefined") window.dispatchEvent(new Event(AI_JOBS_EVENT));
}

export type AiTone = "ok" | "paused" | "off" | "unknown";

/**
 * MTB's light: "off" when AI is not available, "paused" when it is but a reason stands (this app
 * reports none today, the state is kept for parity), "ok" otherwise, "unknown" before the first
 * answer or while the last read failed (`failed`: the lists stay, the light does not claim to
 * know). `reason` is the code before ':'.
 */
export function aiIndicator(
  v: AiJobsView | null,
  failed = false,
): {
  tone: AiTone;
  active: number;
  reason: string | null;
} {
  if (!v) return { tone: "unknown", active: 0, reason: null };
  const reason = v.ai.reason ? (v.ai.reason.split(":")[0] ?? null) : null;
  const tone: AiTone = failed ? "unknown" : !v.ai.available ? "off" : reason ? "paused" : "ok";
  return { tone, active: v.active.length, reason: failed ? null : reason };
}

/** The sentence for a reason code: the Q&A's own error text, or the queue's fallbacks. */
export function reasonText(reason: string | null, locale: Locale): string | null {
  if (!reason) return null;
  const m = MESSAGES[locale];
  if (reason === "not_registered") return m.aiQueue.reasonNotRegistered;
  return (m.error as Record<string, string>)[reason] ?? m.aiQueue.reasonOther;
}

/** What the indicator shows: the last good answer, and whether the latest read failed. */
export interface AiJobsState {
  data: AiJobsView | null;
  failed: boolean;
}

/**
 * The reads behind useAiJobs, without React (review I1, M2). A routine read (the timer, focus,
 * becoming visible) is not started while another read is in flight — a platform that answers in
 * more than AI_POLL_MS would otherwise have every answer overtaken by the next start and never
 * shown. A forced read (a question sent or cancelled here, the panel opened) always starts. An
 * answer is applied when it is newer than the last one applied, so a late older answer never
 * overwrites a newer one, and the newest answer is never dropped for a later start. A failed read
 * keeps the last good lists and marks them `failed`.
 */
export function createAiJobsReader(
  load: () => Promise<AiJobsView>,
  apply: (update: (s: AiJobsState) => AiJobsState) => void,
) {
  let started = 0;
  let applied = 0;
  let inFlight = 0;
  return {
    get inFlight() {
      return inFlight;
    },
    async read({ force = false }: { force?: boolean } = {}): Promise<boolean> {
      if (inFlight > 0 && !force) return false;
      const mine = ++started;
      inFlight++;
      let next: AiJobsView | null = null;
      try {
        next = await load();
      } catch {
        next = null;
      } finally {
        inFlight--;
      }
      if (mine <= applied) return false;
      applied = mine;
      const got = next;
      apply((s) => (got ? { data: got, failed: false } : { data: s.data, failed: true }));
      return true;
    },
  };
}

/**
 * GET /api/ai/jobs, re-read every AI_POLL_MS while the document is visible, on window focus, when
 * it becomes visible again (M5), on AI_JOBS_EVENT and whenever `refresh()` is called. `initial`
 * (server-rendered) is shown until the first answer. `enabled: false` reads nothing (a component
 * under AiJobsProvider uses the shared instance instead).
 */
export function useAiJobs(
  initial: AiJobsView | null = null,
  { enabled = true }: { enabled?: boolean } = {},
) {
  const [state, setState] = useState<AiJobsState>({ data: initial, failed: false });
  const reader = useRef<ReturnType<typeof createAiJobsReader> | null>(null);
  reader.current ??= createAiJobsReader(() => api<AiJobsView>("GET", "/api/ai/jobs"), setState);
  const refresh = useCallback(async () => {
    await reader.current?.read({ force: true });
  }, []);

  useEffect(() => {
    if (!enabled) return;
    const r = reader.current;
    if (!r) return;
    void r.read({ force: true });
    const routine = () => {
      if (document.visibilityState === "visible") void r.read();
    };
    const forced = () => void r.read({ force: true });
    const timer = window.setInterval(routine, AI_POLL_MS);
    window.addEventListener("focus", routine);
    document.addEventListener("visibilitychange", routine);
    window.addEventListener(AI_JOBS_EVENT, forced);
    return () => {
      window.clearInterval(timer);
      window.removeEventListener("focus", routine);
      document.removeEventListener("visibilitychange", routine);
      window.removeEventListener(AI_JOBS_EVENT, forced);
    };
  }, [enabled]);

  return { data: state.data, failed: state.failed, refresh };
}

type Shared = ReturnType<typeof useAiJobs>;
const AiJobsContext = createContext<Shared | null>(null);

/**
 * One reader for the whole shell (review M3): the top bar's indicator and Settings → AI show the
 * same answer, and there is one poll (one platform look per open job), not one per component.
 */
export function AiJobsProvider({ children }: { children: ReactNode }) {
  const value = useAiJobs();
  return createElement(AiJobsContext.Provider, { value }, children);
}

/** The shell's shared reader; outside AiJobsProvider (a bare page), a reader of its own. */
export function useSharedAiJobs(): Shared {
  const shared = useContext(AiJobsContext);
  const own = useAiJobs(null, { enabled: !shared });
  return shared ?? own;
}
