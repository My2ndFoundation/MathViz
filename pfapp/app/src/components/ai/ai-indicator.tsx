"use client";
// After MathTestBuddy trainer/src/components/layout/ai-indicator.tsx (itself after LinkedBot's):
// the light, "AI" and the number of jobs in the queue at the right of the top bar; a click opens a
// side panel with the status sentence, what is waiting or running, the latest finished jobs and a
// link to Settings → AI. Changed: no spend line (this app tracks no cost), the panel is the shell's
// own CSS rather than a shadcn Sheet, each row links to where it was asked, and an open job has a
// Cancel button (DELETE /api/jobs/:id) — beyond MTB, the student asked to be able to stop one.
import Link from "next/link";
import { type KeyboardEvent as ReactKeyboardEvent, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import type { Locale } from "@/lib/i18n/locale";
import { MESSAGES } from "@/lib/i18n/locale";
import { api, errorText, OPEN_STATUSES } from "../qa/api";
import { failureText } from "../qa/thread-view";
import {
  type AiJobView,
  aiIndicator,
  notifyAiJobs,
  reasonText,
  useSharedAiJobs,
} from "./use-ai-jobs";

const FOCUSABLE =
  'a[href], button:not([disabled]), input:not([disabled]), textarea:not([disabled]), select:not([disabled]), [tabindex]:not([tabindex="-1"])';

/** Tab and Shift-Tab wrap inside the modal panel (review M4): nothing behind the scrim takes focus. */
export function trapTab(e: ReactKeyboardEvent<HTMLElement>, box: HTMLElement | null) {
  if (e.key !== "Tab" || !box) return;
  const items = [...box.querySelectorAll<HTMLElement>(FOCUSABLE)].filter(
    (el) => el.getClientRects().length > 0,
  );
  const first = items[0];
  const last = items[items.length - 1];
  if (!first || !last) {
    e.preventDefault();
    box.focus();
    return;
  }
  const at = document.activeElement;
  if (e.shiftKey && (at === first || at === box || !box.contains(at))) {
    e.preventDefault();
    last.focus();
  } else if (!e.shiftKey && (at === last || !box.contains(at))) {
    e.preventDefault();
    first.focus();
  }
}

const STATUS_KEY: Record<string, keyof (typeof MESSAGES)["en"]["aiQueue"]> = {
  queued: "statusQueued",
  running: "statusRunning",
  completed: "statusCompleted",
  failed: "statusFailed",
  timed_out: "statusTimedOut",
  cancelled: "statusCancelled",
  lost: "statusLost",
};
const WORKFLOW_KEY: Record<string, keyof (typeof MESSAGES)["en"]["aiQueue"]> = {
  ask: "workflowAsk",
  hint: "workflowHint",
  library: "workflowLibrary",
};

const when = (iso: string, locale: Locale) => {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleString(locale === "zh" ? "zh-CN" : "en-GB", {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
};

export function AiIndicator({ locale }: { locale: Locale }) {
  const t = MESSAGES[locale].aiQueue;
  const { data, failed, refresh } = useSharedAiJobs();
  const [open, setOpen] = useState(false);
  const [cancelling, setCancelling] = useState<string | null>(null);
  const [cancelError, setCancelError] = useState<string | null>(null);
  const trigger = useRef<HTMLButtonElement>(null);
  const panel = useRef<HTMLDivElement>(null);
  const wasOpen = useRef(false);

  // focus moves into the panel when it opens and back to the trigger when it closes
  useEffect(() => {
    if (open) panel.current?.focus();
    else if (wasOpen.current) trigger.current?.focus();
    wasOpen.current = open;
  }, [open]);
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.preventDefault();
        setOpen(false);
      }
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open]);

  const { tone, active, reason } = aiIndicator(data, failed);
  const state = { ok: t.toneOk, paused: t.tonePaused, off: t.toneOff, unknown: t.toneUnknown }[
    tone
  ];
  const why = reasonText(reason, locale);
  const label = `${t.label}: ${state}${active ? ` · ${t.activeCount.replace("{n}", String(active))}` : ""}`;

  const show = () => {
    setOpen(true);
    setCancelError(null);
    void refresh();
  };
  const cancel = async (id: string) => {
    setCancelling(id);
    setCancelError(null);
    try {
      await api("DELETE", `/api/jobs/${encodeURIComponent(id)}`);
    } catch (e) {
      setCancelError(errorText(e, locale));
    } finally {
      setCancelling(null);
      notifyAiJobs();
    }
  };

  const row = (j: AiJobView) => {
    const isOpen = OPEN_STATUSES.includes(j.status);
    const bad = j.status === "failed" || j.status === "lost" || j.status === "timed_out";
    const statusKey = STATUS_KEY[j.status];
    const workflowKey = WORKFLOW_KEY[j.workflow];
    const error =
      !isOpen && j.status !== "completed" && j.status !== "cancelled"
        ? failureText({ kind: "job", status: j.status, error: j.error }, locale)
        : null;
    return (
      <li key={j.id} className="aiq-row" data-testid="ai-queue-row" data-status={j.status}>
        <div className="aiq-line">
          <span className="aiq-kind">{workflowKey ? t[workflowKey] : j.workflow}</span>
          <span className={bad ? "aiq-status err" : "aiq-status"}>
            {statusKey ? t[statusKey] : j.status}
          </span>
        </div>
        {j.href ? (
          <Link
            href={`/${locale}${j.href}`}
            className="aiq-title"
            data-testid="ai-queue-title"
            onClick={() => setOpen(false)}
          >
            {j.title}
          </Link>
        ) : (
          <span className="aiq-title">{j.title}</span>
        )}
        <div className="aiq-meta">
          <span>{when(j.settledAt ?? j.createdAt, locale)}</span>
          {j.durationMs != null ? (
            <span>{t.seconds.replace("{n}", String(Math.round(j.durationMs / 1000)))}</span>
          ) : null}
          {j.engine ? <span>{j.model ? `${j.engine} · ${j.model}` : j.engine}</span> : null}
          {isOpen ? (
            <button
              type="button"
              className="chip aiq-cancel"
              data-testid="ai-queue-cancel"
              aria-label={`${t.cancelLabel}: ${j.title}`}
              disabled={cancelling === j.id}
              onClick={() => void cancel(j.id)}
            >
              {t.cancel}
            </button>
          ) : null}
        </div>
        {error ? <p className="aiq-error err">{error}</p> : null}
      </li>
    );
  };

  return (
    <>
      <button
        ref={trigger}
        type="button"
        className="chip ai-ind"
        aria-label={label}
        title={label}
        aria-haspopup="dialog"
        aria-expanded={open}
        data-testid="ai-indicator"
        data-tone={tone}
        onClick={() => (open ? setOpen(false) : show())}
      >
        <span className="light" data-tone={tone} aria-hidden="true" />
        {t.label}
        <span className="tabular-nums" data-testid="ai-indicator-count">
          {active}
        </span>
      </button>
      {/* in document.body, above everything the shell positions (the Ask tab, the collapse edge,
          the narrow sidebar), whatever stacking context the top bar makes (review I3) */}
      {open
        ? createPortal(
            <div className="aiq-scrim" data-testid="ai-queue-scrim">
              {/* a click outside the panel closes it */}
              <button
                type="button"
                className="aiq-outside"
                data-testid="ai-queue-outside"
                tabIndex={-1}
                aria-label={t.close}
                onClick={() => setOpen(false)}
              />
              <div
                ref={panel}
                className="aiq"
                role="dialog"
                aria-modal="true"
                aria-labelledby="aiq-title"
                tabIndex={-1}
                data-testid="ai-queue"
                onKeyDown={(e) => trapTab(e, panel.current)}
              >
                <div className="aiq-head">
                  <h2 id="aiq-title">{t.title}</h2>
                  <button
                    type="button"
                    className="iconbtn"
                    aria-label={t.close}
                    title={t.close}
                    onClick={() => setOpen(false)}
                  >
                    ✕
                  </button>
                </div>
                <p className="aiq-sentence" data-testid="ai-queue-status">
                  {state}
                  {why ? ` — ${why}` : null}
                </p>
                <div className="aiq-body">
                  <section>
                    <h3>{t.active}</h3>
                    {data?.active.length ? (
                      <ul data-testid="ai-queue-active">{data.active.map(row)}</ul>
                    ) : (
                      <p className="muted small">{t.noActive}</p>
                    )}
                    {cancelError ? (
                      <p className="small err" role="alert">
                        {cancelError}
                      </p>
                    ) : null}
                  </section>
                  <section>
                    <h3>{t.recent}</h3>
                    {data?.recent.length ? (
                      <ul data-testid="ai-queue-recent">{data.recent.map(row)}</ul>
                    ) : (
                      <p className="muted small">{t.noRecent}</p>
                    )}
                  </section>
                  <Link
                    href={`/${locale}/settings#ai`}
                    className="aiq-settings"
                    data-testid="ai-queue-settings"
                    onClick={(e) => {
                      setOpen(false);
                      // already on Settings: a hash-only Link updates history without a hashchange
                      if (window.location.pathname === `/${locale}/settings`) {
                        e.preventDefault();
                        window.location.hash = "ai";
                      }
                    }}
                  >
                    {t.settings}
                  </Link>
                </div>
              </div>
            </div>,
            document.body,
          )
        : null}
    </>
  );
}
