"use client";
import { useEffect, useId, useRef, useState } from "react";
import type { Locale } from "@/lib/i18n/locale";
import { MESSAGES } from "@/lib/i18n/locale";
import type { PyState } from "@/lib/py-state";
import { ThreadView } from "./thread-view";
import { type ThreadSubject, useThread } from "./use-thread";

/**
 * The tool page's "ask" panel (design §7.4; plan Task 11). Python: what the page's state bridge
 * reports — the program, and in fill-in mode the focused blank — with "ask about this program"
 * and "get a hint" (`hint`; only in fill-in mode with a blank focused, the server refuses it
 * otherwise). Before the bridge has spoken, and on every other target: "ask about this tool".
 * The panel opens on the newest conversation about its subject — the program (python, once the
 * bridge has named one) or else the tool — and a new program switches to that program's.
 * `thread` (the page's `?thread=`, from Notes or the AI queue) names the conversation to open
 * instead, once it is about the panel's subject; a thread about something else, or one the app
 * does not have, falls back to the newest. Once opened, `?thread=` leaves the URL, so a reload
 * after "New conversation" does not bring the old one back.
 */
export function AskPanel({
  toolId,
  toolTitle,
  locale,
  python,
  pyState,
  thread: wantedThread = null,
}: {
  toolId: string;
  toolTitle: string;
  locale: Locale;
  python: boolean;
  pyState: PyState | null;
  thread?: string | null;
}) {
  const t = MESSAGES[locale].qa;
  const inputId = useId();
  const [text, setText] = useState("");
  const { thread, thinking, sending, failure, send, cancel, saveNote, reset, restore, open } =
    useThread(locale);
  const prog = python ? (pyState?.progId ?? null) : null;

  // a conversation is about its subject: a new subject drops the old one and reopens its own
  const subjectType: ThreadSubject["type"] = prog !== null ? "program" : "tool";
  const subjectId = prog ?? toolId;
  // the conversation `?thread=` names, until it has been opened (a python page names its program
  // only once the bridge speaks: before that the subject is the tool, which a program thread is not about)
  const wanted = useRef(wantedThread);
  // a later `?thread=` on the same page (the AI queue's link, same frame): open that one too
  const [asked, setAsked] = useState(0);
  const firstThread = useRef(wantedThread);
  useEffect(() => {
    if (wantedThread === firstThread.current) return;
    firstThread.current = wantedThread;
    if (!wantedThread) return;
    wanted.current = wantedThread;
    setAsked((n) => n + 1);
  }, [wantedThread]);
  // biome-ignore lint/correctness/useExhaustiveDependencies: asked re-runs it for a new ?thread=
  useEffect(() => {
    reset();
    const subject: ThreadSubject = { type: subjectType, id: subjectId };
    const id = wanted.current;
    if (!id) {
      void restore(subject);
      return;
    }
    const fits = (t: { subjects: { type: string; id: string }[] }) =>
      t.subjects.some((s) => s.type === subject.type && s.id === subject.id) &&
      !t.subjects.some((s) => s.type === "library");
    void open(id, { fits, quiet: true }).then((r) => {
      if (r === "refused") {
        // final unless this is a python page whose bridge has not named the program yet
        if (!python || subject.type === "program") wanted.current = null;
        void restore(subject);
      } else if (r === "opened") {
        wanted.current = null;
        const u = new URL(window.location.href);
        u.searchParams.delete("thread");
        // null, never history.state: Next treats a state carrying its own keys as its own call and
        // would not follow the URL
        window.history.replaceState(null, "", `${u.pathname}${u.search}`);
      }
    });
  }, [subjectType, subjectId, python, reset, restore, open, asked]);

  const canHint = !!pyState && pyState.mode === "blank" && !!pyState.blankId;
  const busy = thinking || sending;

  const go = async (workflow: "ask" | "hint") => {
    const message =
      text.trim() ||
      (workflow === "hint" ? t.hintMessage.replace("{id}", pyState?.blankId ?? "") : "");
    if (!message) return;
    const subjects =
      prog !== null ? [{ type: "program", id: prog }] : [{ type: "tool", id: toolId }];
    if (await send({ workflow, message, subjects, pyState: python ? pyState : null })) setText("");
  };

  return (
    <aside className="ask-panel" data-testid="ask-panel" aria-label={t.panel}>
      <header className="ask-head">
        <div className="ask-ctx" data-testid="ask-context">
          {prog !== null ? (
            <>
              <span className="mono">{t.program.replace("{id}", prog)}</span>
              {pyState?.mode === "blank" && pyState.blankId ? (
                <span className="mono"> · {t.blank.replace("{id}", pyState.blankId)}</span>
              ) : null}
            </>
          ) : (
            <span>{python ? t.noState : `${t.thisTool}: ${toolTitle}`}</span>
          )}
        </div>
        {thread ? (
          <button type="button" className="chip" data-testid="ask-new" onClick={reset}>
            {t.newThread}
          </button>
        ) : null}
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
          data-testid="ask-input"
          value={text}
          rows={3}
          maxLength={4000}
          placeholder={t.placeholder}
          disabled={busy}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey && !e.nativeEvent.isComposing) {
              e.preventDefault();
              void go("ask");
            }
          }}
        />
        <div className="ask-buttons">
          <button
            type="button"
            className="chip primary"
            data-testid="ask-submit"
            disabled={busy || !text.trim()}
            onClick={() => void go("ask")}
          >
            {prog !== null ? t.askProgram : t.askTool}
          </button>
          {python ? (
            <button
              type="button"
              className="chip"
              data-testid="ask-hint"
              disabled={busy || !canHint}
              title={canHint ? undefined : t.hintDisabled}
              onClick={() => void go("hint")}
            >
              {t.hint}
            </button>
          ) : null}
        </div>
      </div>
    </aside>
  );
}
