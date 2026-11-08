"use client";
import { type KeyboardEvent, useEffect, useId, useRef, useState } from "react";
import type { Locale } from "@/lib/i18n/locale";
import { MESSAGES } from "@/lib/i18n/locale";
import { api, type ThreadRow } from "./api";

/** "3 hours ago" / "3 小时前", in the coarsest unit that is at least one. */
export function relativeTime(iso: string, locale: Locale, nowMs = Date.now()): string {
  const t = Date.parse(iso);
  if (Number.isNaN(t)) return iso;
  const fmt = new Intl.RelativeTimeFormat(locale === "zh" ? "zh-CN" : "en", { numeric: "auto" });
  const s = Math.round((t - nowMs) / 1000);
  const units: [Intl.RelativeTimeFormatUnit, number][] = [
    ["year", 365 * 86400],
    ["month", 30 * 86400],
    ["week", 7 * 86400],
    ["day", 86400],
    ["hour", 3600],
    ["minute", 60],
  ];
  for (const [unit, size] of units) {
    if (Math.abs(s) >= size) return fmt.format(Math.trunc(s / size), unit);
  }
  return fmt.format(0, "second");
}

/**
 * The ask panel's conversation switcher: every conversation about the panel's subject (GET
 * /api/threads?subject=…&list=1, newest first), so an earlier one stays reachable after "New
 * conversation" or a second question thread. Shown only when there is a conversation other than
 * the one open. A listbox: ↑/↓/Home/End move, Enter or Space opens one, Esc (or Tab, or a click
 * elsewhere) closes it, and focus goes back to the button. `version` changes whenever the open
 * conversation does (another id, a new message), and the list is read again.
 */
export function ThreadSwitcher({
  subject,
  currentId,
  version,
  locale,
  onPick,
}: {
  subject: string;
  currentId: string | null;
  version: string;
  locale: Locale;
  onPick: (id: string) => void;
}) {
  const t = MESSAGES[locale].qa;
  const [rows, setRows] = useState<ThreadRow[]>([]);
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(0);
  const button = useRef<HTMLButtonElement>(null);
  const list = useRef<HTMLDivElement>(null);
  const box = useRef<HTMLDivElement>(null);
  const baseId = useId();
  const listId = `${baseId}-list`;

  // biome-ignore lint/correctness/useExhaustiveDependencies: version re-reads the list
  useEffect(() => {
    let stale = false;
    api<{ threads: ThreadRow[] }>(
      "GET",
      `/api/threads?subject=${encodeURIComponent(subject)}&list=1`,
    ).then(
      (r) => {
        if (!stale) setRows(r.threads);
      },
      () => {
        // the switcher is a convenience: a failed read leaves the last list
      },
    );
    return () => {
      stale = true;
    };
  }, [subject, version]);

  useEffect(() => {
    if (!open) return;
    list.current?.focus();
    const away = (e: PointerEvent) => {
      if (!box.current?.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("pointerdown", away);
    return () => document.removeEventListener("pointerdown", away);
  }, [open]);

  const visible = rows.some((r) => r.id !== currentId);
  if (!visible) return null;

  const show = () => {
    const i = rows.findIndex((r) => r.id === currentId);
    setActive(i >= 0 ? i : 0);
    setOpen(true);
  };
  const close = () => {
    setOpen(false);
    button.current?.focus();
  };
  const pick = (id: string) => {
    close();
    if (id !== currentId) onPick(id);
  };
  const onKey = (e: KeyboardEvent<HTMLDivElement>) => {
    const last = rows.length - 1;
    const move = (i: number) => {
      e.preventDefault();
      setActive(Math.max(0, Math.min(last, i)));
    };
    if (e.key === "ArrowDown") move(active + 1);
    else if (e.key === "ArrowUp") move(active - 1);
    else if (e.key === "Home") move(0);
    else if (e.key === "End") move(last);
    else if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      const r = rows[active];
      if (r) pick(r.id);
    } else if (e.key === "Escape") {
      e.preventDefault();
      e.stopPropagation();
      close();
    } else if (e.key === "Tab") {
      setOpen(false);
    }
  };

  return (
    <div className="ask-threads" ref={box}>
      <button
        ref={button}
        type="button"
        className="chip"
        data-testid="ask-threads"
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-controls={open ? listId : undefined}
        onClick={() => (open ? close() : show())}
        onKeyDown={(e) => {
          if (e.key === "ArrowDown" && !open) {
            e.preventDefault();
            show();
          }
        }}
      >
        {t.threads.replace("{n}", String(rows.length))}
      </button>
      {open ? (
        <div
          ref={list}
          id={listId}
          className="ask-threads-list"
          role="listbox"
          tabIndex={-1}
          aria-label={t.threadsLabel}
          aria-activedescendant={rows[active] ? `${baseId}-${active}` : undefined}
          data-testid="ask-threads-list"
          onKeyDown={onKey}
        >
          {rows.map((r, i) => (
            // biome-ignore lint/a11y/useKeyWithClickEvents: the listbox owns the keyboard (aria-activedescendant)
            <div
              key={r.id}
              id={`${baseId}-${i}`}
              role="option"
              tabIndex={-1}
              aria-selected={r.id === currentId}
              className="ask-thread"
              data-testid="ask-thread"
              data-id={r.id}
              data-active={i === active}
              onClick={() => pick(r.id)}
              onPointerMove={() => setActive(i)}
            >
              <span className="ask-thread-title">{r.title}</span>
              <span className="ask-thread-meta">
                <span>{relativeTime(r.updatedAt, locale)}</span>
                <span>{t.threadMessages.replace("{n}", String(r.messageCount))}</span>
                {r.hasNotes ? (
                  <span className="ask-thread-note" title={t.threadHasNotes}>
                    ★<span className="sr-only">{t.threadHasNotes}</span>
                  </span>
                ) : null}
                {r.id === currentId ? (
                  <span className="ask-thread-current">{t.threadCurrent}</span>
                ) : null}
              </span>
            </div>
          ))}
        </div>
      ) : null}
    </div>
  );
}
