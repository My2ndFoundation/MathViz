"use client";

import { useRouter } from "next/navigation";
import { useEffect, useMemo, useRef, useState } from "react";
import { filterCatalog, type ShellItem } from "@/lib/catalog";
import type { Locale } from "@/lib/i18n/locale";

/**
 * ⌘K (Ctrl+K): filter the catalog by title and tag in the current language; ↑↓ to move, Enter
 * to open, Esc to close. MathTestBuddy uses cmdk for this; one list of tools does not need it.
 */
export function CommandK({
  items,
  locale,
  open,
  onOpenChange,
  placeholder,
  noResults,
  closeLabel,
}: {
  items: ShellItem[];
  locale: Locale;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  placeholder: string;
  noResults: string;
  closeLabel: string;
}) {
  const router = useRouter();
  const [query, setQuery] = useState("");
  const [at, setAt] = useState(0);
  const input = useRef<HTMLInputElement>(null);
  const hits = useMemo(() => filterCatalog(items, query, locale), [items, query, locale]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        onOpenChange(!open);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onOpenChange]);

  useEffect(() => {
    if (open) {
      setQuery("");
      setAt(0);
      input.current?.focus();
    }
  }, [open]);

  if (!open) return null;

  const choose = (item: ShellItem | undefined) => {
    if (!item) return;
    onOpenChange(false);
    router.push(`/${locale}/tool/${encodeURIComponent(item.id)}`);
  };

  return (
    <div className="cmdk-scrim">
      {/* a click outside the dialog closes it */}
      <button
        type="button"
        className="fixed inset-0 cursor-default"
        tabIndex={-1}
        aria-label={closeLabel}
        onClick={() => onOpenChange(false)}
      />
      <div
        className="cmdk relative"
        role="dialog"
        aria-modal="true"
        aria-label={placeholder}
        data-testid="cmdk"
      >
        <input
          ref={input}
          value={query}
          placeholder={placeholder}
          aria-label={placeholder}
          data-testid="cmdk-input"
          onChange={(e) => {
            setQuery(e.target.value);
            setAt(0);
          }}
          onKeyDown={(e) => {
            if (e.key === "Escape") onOpenChange(false);
            else if (e.key === "ArrowDown") {
              e.preventDefault();
              setAt((i) => Math.min(i + 1, hits.length - 1));
            } else if (e.key === "ArrowUp") {
              e.preventDefault();
              setAt((i) => Math.max(i - 1, 0));
            } else if (e.key === "Enter") choose(hits[at]);
          }}
        />
        {hits.length === 0 ? (
          <div className="none">{noResults}</div>
        ) : (
          <ul>
            {hits.map((item, i) => (
              <li key={item.id} data-active={i === at}>
                <button
                  type="button"
                  className="item"
                  data-testid="cmdk-option"
                  data-id={item.id}
                  style={{ "--c": accentColor(item.accent) } as never}
                  onMouseEnter={() => setAt(i)}
                  onClick={() => choose(item)}
                >
                  <span className="dot" />
                  <span className="tx">
                    {item.title[locale]}
                    {item.tag ? <span className="tag">{item.tag[locale]}</span> : null}
                  </span>
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}

/** A catalog accent (the closed set cyan / rose / violet / emerald / orange) as its trace colour. */
export const accentColor = (accent: string) =>
  /^[a-z]+$/.test(accent) ? `var(--color-trace-${accent}, var(--color-ui-slate))` : undefined;
