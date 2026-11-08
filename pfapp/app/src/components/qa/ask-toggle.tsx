"use client";
import { useEffect, useRef } from "react";
import type { Locale } from "@/lib/i18n/locale";
import { MESSAGES } from "@/lib/i18n/locale";
import { useAskPanel } from "./use-ask-panel";

/**
 * The top bar's "Ask AI Tutor" toggle, shown on tool pages only (where the ask panel is). It and
 * the panel's own hide button drive the same state (useAskPanel). It glows brighter while the panel
 * is hidden, so the way back is never hard to find (acceptance feedback: the old edge tab was not).
 */
export function AskToggle({ locale }: { locale: Locale }) {
  const t = MESSAGES[locale].qa;
  const { change, set } = useAskPanel();
  const ref = useRef<HTMLButtonElement>(null);
  // hidden from inside the panel: focus comes here rather than staying in the hidden panel
  useEffect(() => {
    if (change.from === "panel" && !change.shown) ref.current?.focus();
  }, [change]);
  return (
    <button
      ref={ref}
      type="button"
      className="chip ask-toggle"
      aria-pressed={change.shown}
      title={change.shown ? t.hidePanel : t.showPanel}
      data-testid="ask-toggle"
      onClick={() => set(!change.shown, "toggle")}
    >
      <svg viewBox="0 0 16 16" width="13" height="13" aria-hidden="true" focusable="false">
        <path
          d="M2.5 3.5h11v7h-6l-3 2.5v-2.5h-2z"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.4"
          strokeLinejoin="round"
        />
      </svg>
      {t.toggle}
    </button>
  );
}
