"use client";
import { useCallback, useEffect, useId, useState } from "react";
import type { Locale } from "@/lib/i18n/locale";
import { MESSAGES } from "@/lib/i18n/locale";
import { api, errorText, type Note, type NoteSubject } from "./api";
import { CitationLink } from "./citation-link";
import { Markdown } from "./markdown";

/** Debounce for the search box (MathTestBuddy notes-view.tsx). */
const SEARCH_DELAY_MS = 250;

/** A subject filter: `tool:<id>`, `program:<id>`, `library`, or "" for all. */
interface SubjectOption {
  key: string;
  kind: "tool" | "program" | "library";
  title: { en: string; zh: string } | null;
}

/** The filter keys a note matches: its tools (also a program's tool), its programs, the library. */
function keysOf(subjects: readonly NoteSubject[]): Set<string> {
  const out = new Set<string>();
  for (const s of subjects) {
    if (s.type === "library") out.add("library");
    if (s.toolId) out.add(`tool:${s.toolId}`);
    if (s.programId) out.add(`program:${s.programId}`);
  }
  return out;
}

/** Every subject the listed notes are about, tools first, then programs, then the library. */
function optionsOf(notes: readonly Note[]): SubjectOption[] {
  const seen = new Map<string, SubjectOption>();
  for (const n of notes) {
    for (const s of n.subjects) {
      if (s.type === "library")
        seen.set("library", { key: "library", kind: "library", title: null });
      if (s.type === "tool" && s.toolId) {
        seen.set(`tool:${s.toolId}`, { key: `tool:${s.toolId}`, kind: "tool", title: s.title });
      } else if (s.toolId && !seen.has(`tool:${s.toolId}`)) {
        seen.set(`tool:${s.toolId}`, { key: `tool:${s.toolId}`, kind: "tool", title: null });
      }
      if (s.programId) {
        const key = `program:${s.programId}`;
        seen.set(key, { key, kind: "program", title: s.title });
      }
    }
  }
  const order = { tool: 0, program: 1, library: 2 };
  return [...seen.values()].sort(
    (a, b) => order[a.kind] - order[b.kind] || a.key.localeCompare(b.key),
  );
}

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
  const [subject, setSubject] = useState("");
  const subjectId = useId();
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

  const options = optionsOf(notes ?? []);
  const label = (o: SubjectOption) => {
    if (o.kind === "library") return t.subjectLibrary;
    const name = o.title?.[locale] || o.key.slice(o.key.indexOf(":") + 1);
    return (o.kind === "tool" ? t.subjectTool : t.subjectProgram).replace("{title}", name);
  };
  const shown = (notes ?? []).filter((n) => !subject || keysOf(n.subjects).has(subject));

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
      <label htmlFor={subjectId} className="sr-only">
        {t.subjectFilter}
      </label>
      <select
        id={subjectId}
        className="qa-search qa-filter"
        data-testid="notes-subject"
        value={subject}
        onChange={(e) => setSubject(e.target.value)}
      >
        <option value="">{t.subjectAll}</option>
        {subject && !options.some((o) => o.key === subject) ? (
          <option value={subject}>{subject}</option>
        ) : null}
        {options.map((o) => (
          <option key={o.key} value={o.key}>
            {label(o)}
          </option>
        ))}
      </select>
      {error ? (
        <p className="qa-error" role="alert">
          {error}
        </p>
      ) : null}
      {notes && shown.length === 0 ? (
        <p className="qa-note" data-testid="notes-empty">
          {query || subject ? t.notesNoMatch : t.notesEmpty}
        </p>
      ) : null}
      <ol className="qa-notes" data-testid="notes-list">
        {shown.map((n) => (
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
