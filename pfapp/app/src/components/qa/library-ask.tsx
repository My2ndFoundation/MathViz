"use client";
import { useSearchParams } from "next/navigation";
import { useEffect, useId, useState } from "react";
import type { Locale } from "@/lib/i18n/locale";
import { MESSAGES } from "@/lib/i18n/locale";
import { ThreadView } from "./thread-view";
import { useThread } from "./use-thread";

/** `?thread=` in place (Next's router follows the native history calls). */
function setThreadParam(id: string | null) {
  const u = new URL(window.location.href);
  if (id) u.searchParams.set("thread", id);
  else u.searchParams.delete("thread");
  window.history.replaceState(null, "", `${u.pathname}${u.search}`);
}

/**
 * "Ask the whole library" (design §7.5): a `library` question; the tutor searches this app's
 * tools and programs and cites what it used, each citation a link to that page in this app.
 * `?thread=<id>` reopens that library conversation (the notes page's "open" link) and follow-ups
 * continue it; the URL follows the conversation shown, so a reload keeps it, and a new URL (the
 * sidebar's bare `/ask`, the AI queue's `?thread=`) changes the conversation shown.
 */
export function LibraryAsk({
  locale,
  programs,
  example,
}: {
  locale: Locale;
  /** Whether this app's library has programs (python) as well as tools: the intro says which. */
  programs: boolean;
  /** The placeholder question, about one of this app's tools (target.json libraryExample). */
  example: string;
}) {
  const t = MESSAGES[locale].qa;
  const inputId = useId();
  const [text, setText] = useState("");
  const { thread, thinking, sending, failure, send, cancel, saveNote, reset, open } =
    useThread(locale);
  const busy = thinking || sending;
  const wanted = useSearchParams().get("thread");

  // the id in the URL, on arrival and whenever it changes without a remount (the sidebar's link,
  // the AI queue's): open that conversation, or leave the one shown when the URL names none
  // biome-ignore lint/correctness/useExhaustiveDependencies: only a change of the URL's id
  useEffect(() => {
    if (wanted) {
      if (wanted !== thread?.id) void open(wanted);
    } else if (thread) {
      reset();
    }
  }, [wanted]);
  // a conversation that is not about the library cannot be continued here: start a new one
  useEffect(() => {
    if (thread && !thread.subjects.some((s) => s.type === "library")) {
      reset();
      setThreadParam(null);
    } else if (thread && new URL(window.location.href).searchParams.get("thread") !== thread.id) {
      setThreadParam(thread.id);
    }
  }, [thread, reset]);
  const startOver = () => {
    reset();
    setThreadParam(null);
  };

  const go = async () => {
    const message = text.trim();
    if (!message) return;
    if (await send({ workflow: "library", message, subjects: [{ type: "library", id: "all" }] })) {
      setText("");
    }
  };

  return (
    <section className="qa-page" data-testid="library-ask">
      <header className="qa-page-head">
        <h1>{t.libraryTitle}</h1>
        <p>{programs ? t.libraryIntro : t.libraryIntroTools}</p>
      </header>
      <ThreadView
        thread={thread}
        locale={locale}
        thinking={thinking}
        failure={failure}
        onCancel={cancel}
        onSaveNote={saveNote}
      />
      <div className="ask-form">
        <label htmlFor={inputId} className="sr-only">
          {t.inputLabel}
        </label>
        <textarea
          id={inputId}
          data-testid="library-input"
          value={text}
          rows={3}
          maxLength={4000}
          placeholder={example}
          disabled={busy}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey && !e.nativeEvent.isComposing) {
              e.preventDefault();
              void go();
            }
          }}
        />
        <div className="ask-buttons">
          <button
            type="button"
            className="chip primary"
            data-testid="library-submit"
            disabled={busy || !text.trim()}
            onClick={() => void go()}
          >
            {t.libraryAsk}
          </button>
          {thread ? (
            <button type="button" className="chip" data-testid="ask-new" onClick={startOver}>
              {t.newThread}
            </button>
          ) : null}
        </div>
      </div>
    </section>
  );
}
