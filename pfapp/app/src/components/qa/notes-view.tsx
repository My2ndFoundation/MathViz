"use client";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useCallback, useEffect, useId, useRef, useState } from "react";
import type { Bilingual } from "@/lib/catalog";
import type { Locale } from "@/lib/i18n/locale";
import { MESSAGES } from "@/lib/i18n/locale";
import { api, errorText, LIBRARY_GROUP, type NoteThread } from "./api";
import { ThreadView } from "./thread-view";
import { useThread } from "./use-thread";

/** Debounce for the search box (MathTestBuddy notes-view.tsx). */
const SEARCH_DELAY_MS = 250;

/** A catalog group as the filter chips name it (the sidebar's groups, in the pack's order). */
export interface NotesGroup {
  id: string;
  label: Bilingual;
}

type Text = (typeof MESSAGES)[Locale]["qa"];

const dateText = (iso: string, locale: Locale) => {
  const d = new Date(iso);
  return Number.isNaN(d.getTime())
    ? iso
    : d.toLocaleString(locale === "zh" ? "zh-CN" : "en-GB", {
        dateStyle: "medium",
        timeStyle: "short",
      });
};

const followUpsText = (n: number, t: Text) =>
  n === 0 ? t.followUps0 : n === 1 ? t.followUps1 : t.followUpsN.replace("{n}", String(n));

/** What a conversation is about, as one line: "Program: <title> · <group>", or the library. */
function subjectLine(row: NoteThread, locale: Locale, t: Text): string {
  if (row.kind === "library") return t.subjectLibrary;
  const name = row.subject?.title?.[locale] || row.subject?.programId || row.subject?.id || "";
  const what = (row.kind === "program" ? t.subjectProgram : t.subjectTool).replace("{title}", name);
  return row.group ? `${what} · ${row.group.label[locale]}` : what;
}

/** The list's heading for a conversation: "<group> · <tool or program title>". */
function headingOf(row: NoteThread, locale: Locale, t: Text): { key: string; text: string } {
  if (row.kind === "library") return { key: LIBRARY_GROUP, text: t.subjectLibrary };
  const name = row.subject?.title?.[locale] || row.subject?.programId || row.subject?.id || "";
  const key = `${row.group?.id ?? ""}|${row.kind}:${row.subject?.programId ?? row.subject?.id ?? ""}`;
  return { key, text: row.group ? `${row.group.label[locale]} · ${name}` : name };
}

/** The rows under their headings, headings in the order their newest row comes. */
function sections(rows: readonly NoteThread[], locale: Locale, t: Text) {
  const out: { key: string; text: string; rows: NoteThread[] }[] = [];
  const byKey = new Map<string, (typeof out)[number]>();
  for (const r of rows) {
    const h = headingOf(r, locale, t);
    let s = byKey.get(h.key);
    if (!s) {
      s = { ...h, rows: [] };
      byKey.set(h.key, s);
      out.push(s);
    }
    s.rows.push(r);
  }
  return out;
}

/** `?thread=<id>` in place (Next's router follows the native history calls). */
function setThreadParam(id: string | null, how: "push" | "replace") {
  const u = new URL(window.location.href);
  if (id) u.searchParams.set("thread", id);
  else u.searchParams.delete("thread");
  const next = `${u.pathname}${u.search}`;
  if (how === "push") window.history.pushState(null, "", next);
  else window.history.replaceState(null, "", next);
}

/**
 * Notes (design §7.4), two panes: on the left the conversations that have saved answers, one row
 * each (GET /api/notes/threads), searchable and filtered by catalog group; on the right the one in
 * `?thread=` — its messages, the saved answers marked, the ones before the question the first
 * saved answer replied to folded away — with a follow-up box that continues the same conversation (so it shows in the
 * tool page's ask panel too), "Open the exercise" and Delete (its notes, not the conversation).
 * Under 760 px one pane at a time.
 */
export function NotesView({ locale, groups }: { locale: Locale; groups: NotesGroup[] }) {
  const t = MESSAGES[locale].qa;
  const searchId = useId();
  const params = useSearchParams();
  const selected = params.get("thread");
  const [q, setQ] = useState("");
  const [query, setQuery] = useState("");
  const [group, setGroup] = useState("");
  const [rows, setRows] = useState<NoteThread[] | null>(null);
  const [counts, setCounts] = useState<Record<string, number>>({});
  const [error, setError] = useState<string | null>(null);
  const [version, setVersion] = useState(0);
  const [pane, setPane] = useState<"list" | "detail">(selected ? "detail" : "list");
  // the rows seen so far: the detail keeps its header while a search hides its row
  const known = useRef(new Map<string, NoteThread>());
  // the next list picks its newest row (first load, after a delete)
  const pickNewest = useRef(!selected);
  const refresh = useCallback(() => setVersion((v) => v + 1), []);

  useEffect(() => {
    const h = window.setTimeout(() => setQuery(q.trim()), SEARCH_DELAY_MS);
    return () => window.clearTimeout(h);
  }, [q]);

  // biome-ignore lint/correctness/useExhaustiveDependencies: version re-reads the list
  useEffect(() => {
    let stop = false;
    const qs = new URLSearchParams();
    if (query) qs.set("q", query);
    if (group) qs.set("group", group);
    const url = `/api/notes/threads${qs.size ? `?${qs}` : ""}`;
    api<{ threads: NoteThread[]; groups: Record<string, number> }>("GET", url)
      .then((r) => {
        if (stop) return;
        for (const row of r.threads) known.current.set(row.id, row);
        setRows(r.threads);
        setCounts(r.groups);
        setError(null);
        if (pickNewest.current) {
          pickNewest.current = false;
          setThreadParam(r.threads[0]?.id ?? null, "replace");
        }
      })
      .catch((e: unknown) => {
        if (!stop) setError(errorText(e, locale));
      });
    return () => {
      stop = true;
    };
  }, [query, group, version, locale]);

  const choose = (id: string) => {
    if (id !== selected) setThreadParam(id, "push");
    setPane("detail");
  };

  const deleted = () => {
    if (selected) known.current.delete(selected);
    pickNewest.current = true;
    setPane("list");
    refresh();
  };

  const chips = [
    ...groups
      .filter((g) => counts[g.id] || group === g.id)
      .map((g) => ({
        id: g.id,
        label: g.label[locale],
      })),
    ...(counts[LIBRARY_GROUP] || group === LIBRARY_GROUP
      ? [{ id: LIBRARY_GROUP, label: t.subjectLibrary }]
      : []),
  ];
  const nothingSaved = rows !== null && rows.length === 0 && !query && !group;
  const row = selected ? (known.current.get(selected) ?? null) : null;

  return (
    <section className="notes" data-testid="notes-view" data-pane={pane}>
      <div className="notes-list" data-testid="notes-list-pane">
        <div className="notes-tools">
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
          {chips.length ? (
            <fieldset className="notes-chips">
              <legend className="sr-only">{t.notesGroups}</legend>
              {[{ id: "", label: t.notesAll }, ...chips].map((c) => (
                <button
                  key={c.id || "all"}
                  type="button"
                  className="chip"
                  data-testid="notes-chip"
                  data-group={c.id}
                  aria-pressed={group === c.id}
                  onClick={() => setGroup(c.id)}
                >
                  {c.label}
                  {c.id && counts[c.id] ? (
                    <span className="notes-count">{counts[c.id]}</span>
                  ) : null}
                </button>
              ))}
            </fieldset>
          ) : null}
        </div>
        {error ? (
          <p className="qa-error notes-pad" role="alert">
            {error}
          </p>
        ) : null}
        {rows && rows.length === 0 ? (
          <p className="qa-note notes-pad" data-testid="notes-empty">
            {nothingSaved ? t.notesEmpty : t.notesNoMatch}
          </p>
        ) : null}
        <nav className="notes-rows" aria-label={t.notesList} data-testid="notes-list">
          {sections(rows ?? [], locale, t).map((s) => (
            <section key={s.key} className="notes-sec">
              <h2 className="grp" data-testid="notes-heading">
                {s.text}
              </h2>
              {s.rows.map((r) => (
                <button
                  key={r.id}
                  type="button"
                  className="notes-row"
                  data-testid="notes-row"
                  data-id={r.id}
                  aria-current={r.id === selected ? "true" : undefined}
                  onClick={() => choose(r.id)}
                >
                  <span className="notes-row-q">{r.question || r.title}</span>
                  <span className="notes-row-meta">
                    <time dateTime={r.latestNoteAt}>{dateText(r.latestNoteAt, locale)}</time>
                    <span data-testid="notes-row-followups">{followUpsText(r.followUps, t)}</span>
                  </span>
                </button>
              ))}
            </section>
          ))}
        </nav>
      </div>
      <div className="notes-detail" data-testid="notes-detail-pane">
        {selected ? (
          <NoteDetail
            key={selected}
            threadId={selected}
            row={row}
            locale={locale}
            onChanged={refresh}
            onDeleted={deleted}
            onBack={() => setPane("list")}
          />
        ) : (
          <p className="qa-note notes-pad">{nothingSaved ? "" : t.notesPick}</p>
        )}
      </div>
    </section>
  );
}

/** The right pane: one conversation, its saved answers marked, and a follow-up box under it. */
function NoteDetail({
  threadId,
  row,
  locale,
  onChanged,
  onDeleted,
  onBack,
}: {
  threadId: string;
  row: NoteThread | null;
  locale: Locale;
  onChanged: () => void;
  onDeleted: () => void;
  onBack: () => void;
}) {
  const t = MESSAGES[locale].qa;
  const inputId = useId();
  const [text, setText] = useState("");
  const [showEarlier, setShowEarlier] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const { thread, thinking, sending, failure, send, cancel, saveNote, open } = useThread(locale);

  useEffect(() => {
    void open(threadId);
  }, [threadId, open]);

  // an answer that has just come in changes the row's follow-up count: re-read the list
  const wasThinking = useRef(false);
  useEffect(() => {
    if (wasThinking.current && !thinking) onChanged();
    wasThinking.current = thinking;
  }, [thinking, onChanged]);

  const messages = thread?.messages ?? [];
  // folded: what comes before the question the first saved answer replied to (that question stays)
  const firstSaved = messages.findIndex((m) => m.noteId !== null);
  const asked =
    firstSaved > 0 && messages[firstSaved - 1]?.role === "user" ? firstSaved - 1 : firstSaved;
  const earlier = asked > 0 ? asked : 0;
  const from = showEarlier ? 0 : earlier;
  const library = !!thread?.subjects.some((s) => s.type === "library");
  const busy = thinking || sending;
  const question =
    row?.question || messages.find((m) => m.role === "user")?.text || thread?.title || "";

  const go = async () => {
    const message = text.trim();
    if (!message || !thread) return;
    // the thread's own workflow: library for a library conversation, else ask — never a hint here
    if (await send({ workflow: library ? "library" : "ask", message, subjects: [] })) setText("");
  };

  const remove = async () => {
    try {
      await api<null>("DELETE", `/api/notes/threads/${encodeURIComponent(threadId)}`);
      onDeleted();
    } catch (e) {
      setDeleteError(errorText(e, locale));
    }
  };

  return (
    <article className="notes-thread" data-testid="notes-detail" data-id={threadId}>
      <header className="notes-head">
        <button type="button" className="chip notes-back" data-testid="notes-back" onClick={onBack}>
          ← {t.notesBack}
        </button>
        <h1 className="notes-title" data-testid="notes-question">
          {question}
        </h1>
        {row ? (
          <p className="notes-subject mono" data-testid="notes-subject">
            {subjectLine(row, locale, t)}
          </p>
        ) : null}
        <div className="notes-head-actions">
          {row?.href ? (
            <Link href={`/${locale}${row.href}`} className="chip primary" data-testid="notes-open">
              {row.kind === "library" ? t.openLibrary : t.openExercise}
            </Link>
          ) : null}
          {confirming ? (
            <span className="notes-confirm" role="alert">
              <span>{t.deleteConfirm}</span>
              <button
                type="button"
                className="chip danger"
                data-testid="notes-delete-yes"
                onClick={() => void remove()}
              >
                {t.deleteYes}
              </button>
              <button
                type="button"
                className="chip"
                data-testid="notes-delete-no"
                onClick={() => setConfirming(false)}
              >
                {t.deleteNo}
              </button>
            </span>
          ) : (
            <button
              type="button"
              className="chip"
              data-testid="notes-delete"
              aria-label={t.deleteNotesLabel}
              onClick={() => setConfirming(true)}
            >
              {t.deleteNotes}
            </button>
          )}
        </div>
        {deleteError ? (
          <p className="qa-error" role="alert">
            {deleteError}
          </p>
        ) : null}
      </header>
      <div className="notes-body">
        {earlier > 0 ? (
          <button
            type="button"
            className="chip notes-earlier"
            data-testid="notes-earlier"
            aria-expanded={showEarlier}
            onClick={() => setShowEarlier((v) => !v)}
          >
            {showEarlier
              ? t.hideEarlier
              : earlier === 1
                ? t.earlier1
                : t.earlierN.replace("{n}", String(earlier))}
          </button>
        ) : null}
        <ThreadView
          thread={thread}
          locale={locale}
          thinking={thinking}
          failure={failure}
          onCancel={cancel}
          onSaveNote={(id) => void saveNote(id).then(onChanged)}
          from={from}
          markSaved
        />
      </div>
      <div className="ask-form notes-form">
        <label htmlFor={inputId} className="sr-only">
          {t.followUpLabel}
        </label>
        <textarea
          id={inputId}
          data-testid="notes-followup-input"
          value={text}
          rows={2}
          maxLength={4000}
          placeholder={t.followUpPlaceholder}
          disabled={busy || !thread}
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
            data-testid="notes-followup-submit"
            disabled={busy || !thread || !text.trim()}
            onClick={() => void go()}
          >
            {t.followUpSend}
          </button>
        </div>
      </div>
    </article>
  );
}
