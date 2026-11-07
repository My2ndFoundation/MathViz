"use client";
// After MathTestBuddy trainer/src/lib/client/ai-jobs.ts: AI_POLL_MS, the view's types and the
// indicator's tone logic. Added: a window event the ask panel fires after it submits or cancels,
// so the count moves at once instead of on the next 10 s tick (no global store).
import { useCallback, useEffect, useRef, useState } from "react";
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
 * answer or after a failed read. `reason` is the code before ':'.
 */
export function aiIndicator(v: AiJobsView | null): {
  tone: AiTone;
  active: number;
  reason: string | null;
} {
  if (!v) return { tone: "unknown", active: 0, reason: null };
  const reason = v.ai.reason ? (v.ai.reason.split(":")[0] ?? null) : null;
  const tone: AiTone = !v.ai.available ? "off" : reason ? "paused" : "ok";
  return { tone, active: v.active.length, reason };
}

/** The sentence for a reason code: the Q&A's own error text, or the queue's fallbacks. */
export function reasonText(reason: string | null, locale: Locale): string | null {
  if (!reason) return null;
  const m = MESSAGES[locale];
  if (reason === "not_registered") return m.aiQueue.reasonNotRegistered;
  return (m.error as Record<string, string>)[reason] ?? m.aiQueue.reasonOther;
}

/**
 * GET /api/ai/jobs, re-read every AI_POLL_MS while the document is visible, on window focus, on
 * AI_JOBS_EVENT and whenever `refresh()` is called. A failed read is `null` (tone "unknown").
 * `initial` (server-rendered) is shown until the first answer.
 */
export function useAiJobs(initial: AiJobsView | null = null) {
  const [data, setData] = useState<AiJobsView | null>(initial);
  // an answer to an older request must not overwrite a newer one
  const seq = useRef(0);
  const refresh = useCallback(async () => {
    const mine = ++seq.current;
    let next: AiJobsView | null;
    try {
      next = await api<AiJobsView>("GET", "/api/ai/jobs");
    } catch {
      next = null;
    }
    if (mine === seq.current) setData(next);
  }, []);

  useEffect(() => {
    void refresh();
    const timer = window.setInterval(() => {
      if (document.visibilityState === "visible") void refresh();
    }, AI_POLL_MS);
    const now = () => void refresh();
    window.addEventListener("focus", now);
    window.addEventListener(AI_JOBS_EVENT, now);
    return () => {
      window.clearInterval(timer);
      window.removeEventListener("focus", now);
      window.removeEventListener(AI_JOBS_EVENT, now);
    };
  }, [refresh]);

  return { data, refresh };
}
