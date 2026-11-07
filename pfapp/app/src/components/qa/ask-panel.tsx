"use client";
import { useEffect, useId, useRef, useState } from "react";
import type { Locale } from "@/lib/i18n/locale";
import { MESSAGES } from "@/lib/i18n/locale";
import type { PyState } from "@/lib/py-state";
import { ThreadView } from "./thread-view";
import { useThread } from "./use-thread";

/**
 * The tool page's "ask" panel (design §7.4; plan Task 11). Python: what the page's state bridge
 * reports — the program, and in fill-in mode the focused blank — with "ask about this program"
 * and "get a hint" (`hint`; only in fill-in mode with a blank focused, the server refuses it
 * otherwise). Before the bridge has spoken, and on every other target: "ask about this tool".
 * A new program starts a new conversation (the old one was about another program).
 */
export function AskPanel({
  toolId,
  toolTitle,
  locale,
  python,
  pyState,
}: {
  toolId: string;
  toolTitle: string;
  locale: Locale;
  python: boolean;
  pyState: PyState | null;
}) {
  const t = MESSAGES[locale].qa;
  const inputId = useId();
  const [text, setText] = useState("");
  const { thread, thinking, sending, failure, send, cancel, saveNote, reset } = useThread(locale);
  const prog = python ? (pyState?.progId ?? null) : null;

  // a conversation is about the program it started on
  const startedOn = useRef<string | null>(null);
  useEffect(() => {
    if (thread && startedOn.current !== prog) reset();
  }, [prog, thread, reset]);

  const canHint = !!pyState && pyState.mode === "blank" && !!pyState.blankId;
  const busy = thinking || sending;

  const go = async (workflow: "ask" | "hint") => {
    const message =
      text.trim() ||
      (workflow === "hint" ? t.hintMessage.replace("{id}", pyState?.blankId ?? "") : "");
    if (!message) return;
    const subjects =
      prog !== null ? [{ type: "program", id: prog }] : [{ type: "tool", id: toolId }];
    if (!thread) startedOn.current = prog;
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
