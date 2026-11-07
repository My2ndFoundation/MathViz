"use client";
import { useCallback, useEffect, useId, useState } from "react";
import type { Locale } from "@/lib/i18n/locale";
import { MESSAGES } from "@/lib/i18n/locale";
import { api, errorText, type Note } from "./api";
import { CitationLink } from "./citation-link";
import { Markdown } from "./markdown";

/** Debounce for the search box (MathTestBuddy notes-view.tsx). */
const SEARCH_DELAY_MS = 250;

/**
 * Notes (design §7.4): every answer saved with "save as note", newest first, with the question
 * it answered and its citations; searchable (GET /api/notes?q=) and deletable.
 */
export function NotesView({ locale }: { locale: Locale }) {
  const t = MESSAGES[locale].qa;
  const searchId = useId();
  const [q, setQ] = useState("");
  const [query, setQuery] = useState("");
  const [notes, setNotes] = useState<Note[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [version, setVersion] = useState(0);
  const refresh = useCallback(() => setVersion((v) => v + 1), []);

  useEffect(() => {
    const h = window.setTimeout(() => setQuery(q.trim()), SEARCH_DELAY_MS);
    return () => window.clearTimeout(h);
  }, [q]);

  // biome-ignore lint/correctness/useExhaustiveDependencies: version re-reads the list
  useEffect(() => {
    let stop = false;
    const url = query ? `/api/notes?${new URLSearchParams({ q: query })}` : "/api/notes";
    api<{ notes: Note[] }>("GET", url)
      .then((r) => {
        if (stop) return;
        setNotes(r.notes);
        setError(null);
      })
      .catch((e: unknown) => {
        if (!stop) setError(errorText(e, locale));
      });
    return () => {
      stop = true;
    };
  }, [query, version, locale]);

  const remove = async (id: string) => {
    try {
      await api<null>("DELETE", `/api/notes/${encodeURIComponent(id)}`);
      refresh();
    } catch (e) {
      setError(errorText(e, locale));
    }
  };

  const date = (iso: string) => {
    const d = new Date(iso);
    return Number.isNaN(d.getTime())
      ? iso
      : d.toLocaleString(locale === "zh" ? "zh-CN" : "en-GB", {
          dateStyle: "medium",
          timeStyle: "short",
        });
  };

  return (
    <section className="qa-page" data-testid="notes-view">
      <header className="qa-page-head">
        <h1>{t.notesTitle}</h1>
        <p>{t.notesIntro}</p>
      </header>
      <label htmlFor={searchId} className="sr-only">
        {t.notesSearch}
      </label>
      <input
        id={searchId}
        type="search"
        className="qa-search"
        data-testid="notes-search"
        placeholder={t.notesSearchPlaceholder}
        value={q}
        onChange={(e) => setQ(e.target.value)}
      />
      {error ? (
        <p className="qa-error" role="alert">
          {error}
        </p>
      ) : null}
      {notes && notes.length === 0 ? (
        <p className="qa-note" data-testid="notes-empty">
          {query ? t.notesNoMatch : t.notesEmpty}
        </p>
      ) : null}
      <ol className="qa-notes" data-testid="notes-list">
        {(notes ?? []).map((n) => (
          <li key={n.id} className="qa-card" data-testid="note" data-id={n.id}>
            <div className="qa-card-head">
              <span className="qa-who">{t.question}</span>
              <time dateTime={n.createdAt}>{date(n.createdAt)}</time>
            </div>
            <p className="qa-q">{n.question || n.threadTitle}</p>
            <Markdown source={n.text} />
            {n.citations.length ? (
              <ul className="qa-sources-list" data-testid="citations">
                {n.citations.map((c) => (
                  <li key={c.id}>
                    <CitationLink citation={c} locale={locale} />
                  </li>
                ))}
              </ul>
            ) : null}
            <div className="qa-actions">
              <button
                type="button"
                className="chip"
                data-testid="note-delete"
                aria-label={t.deleteNoteLabel}
                onClick={() => void remove(n.id)}
              >
                {t.deleteNote}
              </button>
            </div>
          </li>
        ))}
      </ol>
    </section>
  );
}
