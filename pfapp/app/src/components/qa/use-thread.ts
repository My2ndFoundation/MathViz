"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import type { Locale } from "@/lib/i18n/locale";
import type { PyState } from "@/lib/py-state";
import { notifyAiJobs } from "../ai/use-ai-jobs";
import { ApiError, api, errorText, type Job, OPEN_STATUSES, type Thread } from "./api";

/** How often the page asks whether the tutor is done (MathTestBuddy tutor-thread.tsx: 1.5 s). */
export const POLL_MS = 1500;
/** Consecutive failed polls before the page gives up (each waits longer: 1.5 s, 3 s, 6 s, 12 s). */
export const MAX_POLL_FAILURES = 5;
const MAX_BACKOFF_MS = 15_000;

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

/** What a tool page's conversation is about (GET /api/threads?subject=). */
export interface ThreadSubject {
  type: "tool" | "program";
  id: string;
}

/**
 * One conversation: the first question creates the thread (POST /api/threads), later ones follow
 * it up (POST /api/threads/:id). While a job is open the page polls GET /api/jobs/:id, then reads
 * the thread again. No streaming (design §7.4): "thinking…" until the answer is there.
 * `restore(subject)` reopens the newest conversation about a tool or program, resuming the poll
 * if its job is still open; a restore overtaken by another restore, a reset or a question is dropped.
 * `open(id)` does the same for one thread by id (the notes page, a tool page's `?thread=`).
 */
export function useThread(locale: Locale) {
  const [thread, setThread] = useState<Thread | null>(null);
  const [jobId, setJobId] = useState<string | null>(null);
  const [failure, setFailure] = useState<Failure | null>(null);
  const [sending, setSending] = useState(false);
  const threadId = useRef<string | null>(null);
  // bumped by restore, reset and send: a restore that resolves under a later number is stale
  const seq = useRef(0);

  const reload = useCallback(async (id: string) => {
    const t = await api<Thread>("GET", `/api/threads/${encodeURIComponent(id)}`);
    if (threadId.current === id) setThread(t);
    return t;
  }, []);

  useEffect(() => {
    if (!jobId) return;
    let stop = false;
    let timer: number | undefined;
    let failures = 0;
    const poll = async () => {
      let j: Job;
      try {
        j = await api<Job>("GET", `/api/jobs/${encodeURIComponent(jobId)}`);
      } catch (e) {
        if (stop) return;
        // a passing error (the app restarting, a dropped request) must not end the wait: retry
        // with a back-off; give up only on a job the app does not know or after MAX_POLL_FAILURES
        failures++;
        if ((e instanceof ApiError && e.status === 404) || failures >= MAX_POLL_FAILURES) {
          setFailure({ kind: "http", text: errorText(e, locale) });
          setJobId(null);
          return;
        }
        timer = window.setTimeout(poll, Math.min(POLL_MS * 2 ** failures, MAX_BACKOFF_MS));
        return;
      }
      if (stop) return;
      failures = 0;
      if (OPEN_STATUSES.includes(j.status)) {
        timer = window.setTimeout(poll, POLL_MS);
        return;
      }
      try {
        await reload(j.threadId);
      } catch (e) {
        if (!stop) setFailure({ kind: "http", text: errorText(e, locale) });
      }
      if (stop) return;
      if (j.status !== "completed") setFailure({ kind: "job", status: j.status, error: j.error });
      setJobId(null);
      notifyAiJobs();
    };
    timer = window.setTimeout(poll, POLL_MS);
    return () => {
      stop = true;
      window.clearTimeout(timer);
    };
  }, [jobId, reload, locale]);

  // a ref, not state: two Enter presses in one tick both see the same state (Task 11 review, Minor 6)
  const inFlight = useRef(false);
  const send = useCallback(
    async (a: Ask): Promise<boolean> => {
      if (inFlight.current) return false;
      inFlight.current = true;
      seq.current++;
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
        // the job exists now: poll it whatever happens to the reload (else the thread stays busy, 409)
        setJobId(r.jobId);
        notifyAiJobs();
        try {
          await reload(r.threadId);
        } catch {
          // the poll reloads the thread when the job ends
        }
        return true;
      } catch (e) {
        setFailure({ kind: "http", text: errorText(e, locale) });
        return false;
      } finally {
        inFlight.current = false;
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
    notifyAiJobs();
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

  const restore = useCallback(async (subject: ThreadSubject) => {
    const mine = ++seq.current;
    let found: Thread | null;
    try {
      const r = await api<{ thread: Thread | null }>(
        "GET",
        `/api/threads?subject=${encodeURIComponent(`${subject.type}:${subject.id}`)}`,
      );
      found = r.thread;
    } catch {
      return; // nothing to reopen is not an error worth showing: the panel starts empty
    }
    if (mine !== seq.current || !found) return;
    threadId.current = found.id;
    setThread(found);
    if (found.job && OPEN_STATUSES.includes(found.job.status)) setJobId(found.job.id);
  }, []);

  /**
   * The same for a thread named by id (the notes page, a tool page's `?thread=`): GET
   * /api/threads/:id. `fits` may refuse a thread (a tool page takes only one about its subject);
   * `quiet` keeps a failed read from showing as an error. "refused" covers both, so the caller can
   * fall back (to `restore`); "stale" means a later restore, open, reset or question overtook it.
   */
  const open = useCallback(
    async (
      id: string,
      { fits, quiet = false }: { fits?: (t: Thread) => boolean; quiet?: boolean } = {},
    ): Promise<"opened" | "stale" | "refused"> => {
      const mine = ++seq.current;
      let found: Thread;
      try {
        found = await api<Thread>("GET", `/api/threads/${encodeURIComponent(id)}`);
      } catch (e) {
        if (mine !== seq.current) return "stale";
        if (!quiet) setFailure({ kind: "http", text: errorText(e, locale) });
        return "refused";
      }
      if (mine !== seq.current) return "stale";
      if (fits && !fits(found)) return "refused";
      threadId.current = found.id;
      setThread(found);
      if (found.job && OPEN_STATUSES.includes(found.job.status)) setJobId(found.job.id);
      return "opened";
    },
    [locale],
  );

  const reset = useCallback(() => {
    seq.current++;
    threadId.current = null;
    setThread(null);
    setJobId(null);
    setFailure(null);
  }, []);

  return {
    thread,
    thinking: jobId !== null,
    sending,
    failure,
    send,
    cancel,
    saveNote,
    reset,
    restore,
    open,
  };
}
