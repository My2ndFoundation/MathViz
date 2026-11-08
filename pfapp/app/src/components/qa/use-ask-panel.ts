"use client";
import { useCallback, useEffect, useState } from "react";

/**
 * Whether the tool page's ask panel is shown, shared by the two controls that change it: the
 * top-bar toggle (the shell) and the panel's own hide button (ToolFrame). No global store: the
 * choice lives in localStorage ("pfapp-ask", remembered like the sidebar's) and every change is
 * announced with a window CustomEvent, so each component holding this hook follows it.
 *
 * `from` says which control made the change (null: read from storage on mount), so each side can
 * move focus: opening focuses into the panel, hiding from inside it focuses the top-bar toggle
 * (focus is never left inside a hidden panel).
 */
export type AskSource = "toggle" | "panel";
export interface AskChange {
  shown: boolean;
  from: AskSource | null;
}

const KEY = "pfapp-ask";
const EVENT = "pfapp-ask-change";

export function useAskPanel(): {
  change: AskChange;
  set: (shown: boolean, from: AskSource) => void;
} {
  const [change, setChange] = useState<AskChange>({ shown: true, from: null });
  useEffect(() => {
    try {
      setChange({ shown: localStorage.getItem(KEY) !== "hidden", from: null });
    } catch {
      // no storage: shown
    }
    const on = (e: Event) => setChange((e as CustomEvent<AskChange>).detail);
    window.addEventListener(EVENT, on);
    return () => window.removeEventListener(EVENT, on);
  }, []);
  const set = useCallback((shown: boolean, from: AskSource) => {
    try {
      localStorage.setItem(KEY, shown ? "shown" : "hidden");
    } catch {
      // no storage: this session only
    }
    window.dispatchEvent(new CustomEvent<AskChange>(EVENT, { detail: { shown, from } }));
  }, []);
  return { change, set };
}
