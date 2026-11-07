"use client";
import { type RefObject, useEffect, useState } from "react";
import { type PyState, parsePyState } from "@/lib/py-state";

/** The embedded python page's current state (null until its first message; cleared on a new tool). */
export function usePyState(
  iframeRef: RefObject<HTMLIFrameElement | null>,
  toolId: string,
): PyState | null {
  const [held, setHeld] = useState<{ toolId: string; state: PyState } | null>(null);
  useEffect(() => {
    const onMessage = (ev: MessageEvent) => {
      // only our own frame: a message from any other window is not the tool page
      if (!iframeRef.current || ev.source !== iframeRef.current.contentWindow) return;
      const state = parsePyState(ev, window.location.origin, toolId);
      if (state) setHeld({ toolId, state });
    };
    window.addEventListener("message", onMessage);
    return () => window.removeEventListener("message", onMessage);
  }, [iframeRef, toolId]);
  return held && held.toolId === toolId ? held.state : null;
}
