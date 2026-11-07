"use client";
import { useId, useState } from "react";
import type { Locale } from "@/lib/i18n/locale";
import { MESSAGES } from "@/lib/i18n/locale";
import { ThreadView } from "./thread-view";
import { useThread } from "./use-thread";

/**
 * "Ask the whole library" (design §7.5): a `library` question; the tutor searches this app's
 * tools and programs and cites what it used, each citation a link to that page in this app.
 */
export function LibraryAsk({ locale }: { locale: Locale }) {
  const t = MESSAGES[locale].qa;
  const inputId = useId();
  const [text, setText] = useState("");
  const { thread, thinking, sending, failure, send, cancel, saveNote, reset } = useThread(locale);
  const busy = thinking || sending;

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
        <p>{t.libraryIntro}</p>
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
          placeholder={t.libraryPlaceholder}
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
            <button type="button" className="chip" data-testid="ask-new" onClick={reset}>
              {t.newThread}
            </button>
          ) : null}
        </div>
      </div>
    </section>
  );
}
