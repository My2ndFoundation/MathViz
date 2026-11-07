"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import type { Locale } from "@/lib/i18n/locale";
import type { PyState } from "@/lib/py-state";
import { api, errorText, type Job, OPEN_STATUSES, type Thread } from "./api";

/** How often the page asks whether the tutor is done (MathTestBuddy tutor-thread.tsx: 1.5 s). */
export const POLL_MS = 1500;

export interface Ask {
  workflow: "ask" | "hint" | "library";
  message: string;
  subjects: { type: string; id: string }[];
  pyState?: PyState | null;
}

/** Why the last question has no answer: a job status/error, or an HTTP error's text. */
export type Failure =
  | { kind: "job"; status: string; error: string | null }
  | { kind: "http"; text: string };

/**
 * One conversation: the first question creates the thread (POST /api/threads), later ones follow
 * it up (POST /api/threads/:id). While a job is open the page polls GET /api/jobs/:id, then reads
 * the thread again. No streaming (design §7.4): "thinking…" until the answer is there.
 */
export function useThread(locale: Locale) {
  const [thread, setThread] = useState<Thread | null>(null);
  const [jobId, setJobId] = useState<string | null>(null);
  const [failure, setFailure] = useState<Failure | null>(null);
  const [sending, setSending] = useState(false);
  const threadId = useRef<string | null>(null);

  const reload = useCallback(async (id: string) => {
    const t = await api<Thread>("GET", `/api/threads/${encodeURIComponent(id)}`);
    if (threadId.current === id) setThread(t);
    return t;
  }, []);

  useEffect(() => {
    if (!jobId) return;
    let stop = false;
    let timer: number | undefined;
    const poll = async () => {
      try {
        const j = await api<Job>("GET", `/api/jobs/${encodeURIComponent(jobId)}`);
        if (stop) return;
        if (OPEN_STATUSES.includes(j.status)) {
          timer = window.setTimeout(poll, POLL_MS);
          return;
        }
        await reload(j.threadId);
        if (stop) return;
        if (j.status !== "completed") setFailure({ kind: "job", status: j.status, error: j.error });
        setJobId(null);
      } catch (e) {
        if (stop) return;
        setFailure({ kind: "http", text: errorText(e, locale) });
        setJobId(null);
      }
    };
    timer = window.setTimeout(poll, POLL_MS);
    return () => {
      stop = true;
      window.clearTimeout(timer);
    };
  }, [jobId, reload, locale]);

  const send = useCallback(
    async (a: Ask): Promise<boolean> => {
      setFailure(null);
      setSending(true);
      try {
        const id = threadId.current;
        const body = {
          message: a.message,
          workflow: a.workflow,
          locale,
          ...(a.pyState ? { pyState: a.pyState } : {}),
        };
        const r = id
          ? await api<{ threadId: string; jobId: string }>(
              "POST",
              `/api/threads/${encodeURIComponent(id)}`,
              body,
            )
          : await api<{ threadId: string; jobId: string }>("POST", "/api/threads", {
              ...body,
              subjects: a.subjects,
            });
        threadId.current = r.threadId;
        await reload(r.threadId);
        setJobId(r.jobId);
        return true;
      } catch (e) {
        setFailure({ kind: "http", text: errorText(e, locale) });
        return false;
      } finally {
        setSending(false);
      }
    },
    [locale, reload],
  );

  const cancel = useCallback(async () => {
    const id = jobId;
    if (!id) return;
    try {
      await api<Job>("DELETE", `/api/jobs/${encodeURIComponent(id)}`);
    } catch (e) {
      setFailure({ kind: "http", text: errorText(e, locale) });
    }
    // the poll sees the ended job on its next round and shows "cancelled"
  }, [jobId, locale]);

  const saveNote = useCallback(
    async (messageId: string) => {
      try {
        await api<{ id: string }>("POST", "/api/notes", { messageId });
        if (threadId.current) await reload(threadId.current);
      } catch (e) {
        setFailure({ kind: "http", text: errorText(e, locale) });
      }
    },
    [locale, reload],
  );

  const reset = useCallback(() => {
    threadId.current = null;
    setThread(null);
    setJobId(null);
    setFailure(null);
  }, []);

  return { thread, thinking: jobId !== null, sending, failure, send, cancel, saveNote, reset };
}
