"use client";
import type { Locale } from "@/lib/i18n/locale";
import { MESSAGES } from "@/lib/i18n/locale";
import type { Thread } from "./api";
import { CitationLink } from "./citation-link";
import { Markdown } from "./markdown";
import type { Failure } from "./use-thread";

/** The text for a question that got no answer (design §7.4: needs-blank-done has its own). */
export function failureText(f: Failure, locale: Locale): string {
  const t = MESSAGES[locale].qa;
  if (f.kind === "http") return f.text;
  if (f.error === "needs-blank-done") return t.needsBlankDone;
  if (f.status === "cancelled") return t.cancelled;
  if (f.status === "timed_out") return t.timedOut;
  const errors = MESSAGES[locale].error as Record<string, string>;
  if (f.error && errors[f.error]) return errors[f.error] as string;
  return t.failed.replace("{code}", f.error ?? f.status);
}

/**
 * A conversation: her questions as typed, the tutor's answers as Markdown with the library items
 * they cite and "save as note". `library` marks an answer that cites nothing (design §7.5).
 * The notes page passes `from` (messages before it are not shown; it offers them itself) and
 * `markSaved` (a saved answer gets the accent bar and the "Saved answer" label).
 */
export function ThreadView({
  thread,
  locale,
  thinking,
  failure,
  onCancel,
  onSaveNote,
  from = 0,
  markSaved = false,
}: {
  thread: Thread | null;
  locale: Locale;
  thinking: boolean;
  failure: Failure | null;
  onCancel: () => void;
  onSaveNote: (messageId: string) => void;
  from?: number;
  markSaved?: boolean;
}) {
  const t = MESSAGES[locale].qa;
  const library = thread?.workflow === "library";
  return (
    <div className="qa-thread" data-testid="thread">
      {thread?.messages.length ? (
        <ol className="qa-messages">
          {thread.messages.slice(from).map((m) => (
            <li
              key={m.id}
              className="qa-msg"
              data-role={m.role}
              data-saved={markSaved && m.noteId ? "true" : undefined}
              data-testid="qa-message"
            >
              <span className="qa-who">
                {m.role === "user" ? t.you : markSaved && m.noteId ? t.savedAnswer : t.tutor}
              </span>
              {m.role === "user" ? (
                <p className="qa-q">{m.text}</p>
              ) : (
                <>
                  <Markdown source={m.text} />
                  {m.citations.length ? (
                    <div className="qa-sources">
                      <span className="qa-who">{t.sources}</span>
                      <ul data-testid="citations">
                        {m.citations.map((c) => (
                          <li key={c.id}>
                            <CitationLink citation={c} locale={locale} />
                          </li>
                        ))}
                      </ul>
                    </div>
                  ) : library ? (
                    <p className="qa-note" data-testid="no-citations">
                      {t.noCitations}
                    </p>
                  ) : null}
                  <div className="qa-actions">
                    {m.noteId ? (
                      <span className="qa-saved" data-testid="note-saved">
                        {t.saved}
                      </span>
                    ) : (
                      <button
                        type="button"
                        className="chip"
                        data-testid="save-note"
                        onClick={() => onSaveNote(m.id)}
                      >
                        {t.saveNote}
                      </button>
                    )}
                  </div>
                </>
              )}
            </li>
          ))}
        </ol>
      ) : null}
      {thinking ? (
        <div className="qa-status" data-testid="thinking" role="status">
          <span className="qa-spin" aria-hidden="true" />
          <span>{t.thinking}</span>
          <button type="button" className="chip" data-testid="ask-cancel" onClick={onCancel}>
            {t.cancel}
          </button>
        </div>
      ) : null}
      {failure ? (
        <p className="qa-error" data-testid="ask-error" role="alert">
          {failureText(failure, locale)}
        </p>
      ) : null}
    </div>
  );
}
