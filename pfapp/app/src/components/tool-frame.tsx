"use client";
import { useEffect, useRef, useState } from "react";
import type { Locale } from "@/lib/i18n/locale";
import { MESSAGES } from "@/lib/i18n/locale";
import { AskPanel } from "./qa/ask-panel";
import { useAskPanel } from "./qa/use-ask-panel";
import { useAskWidth } from "./qa/use-ask-width";
import { Recorder } from "./recorder";
import { bridgeDownloads } from "./save-file";
import { usePyState } from "./use-py-state";

/**
 * The tool view (design §7.3): the web version's page, as it is, in a same-origin iframe of
 * /c/<content version>/tools/<file>. The page renders it with key={src}, so a new language or program
 * is a fresh component: a fresh load, and the previous frame's python state is dropped with it.
 * The python page's state (usePyState) is mirrored to data-py-* attributes, which is also how the
 * e2e suite observes the bridge.
 *
 * The iframe gets its src only after mount. The python page posts its state once on mount and
 * otherwise only on a change; with the src in the server HTML the page could load and post before
 * hydration attached usePyState's listener, and the shell would know nothing until the first
 * interaction. Effects run in declaration order, so the listener (usePyState's effect) is in place
 * before this component's effect hands the iframe its src.
 *
 * Beside the frame, the "ask" panel (Task 11), fed the same bridge state; it can be hidden, from its
 * own hide button or the top bar's "Ask AI Tutor" toggle (useAskPanel: one state, remembered in
 * localStorage like the sidebar's). Hidden means `hidden` + `inert`, never
 * unmounted: the panel owns the conversation (useThread), and a student who hides it to widen the
 * code while the tutor is still answering must find the answer there when she opens it again
 * (final review I-3). Focus follows the toggle: opening focuses into the panel, hiding from inside it
 * focuses the top-bar toggle, so it is never left inside a hidden panel. Its left edge resizes it
 * (useAskWidth); while dragging, the iframe takes no pointer events, or it would swallow the drag.
 *
 * The frame sits in `.rec-stage`, the area the maths recorder floats over and resizes the frame in
 * while it records (components/recorder.tsx; `recorder` carries the overlay's words). On every
 * load the frame's own `blob:` exports are routed through the app's save (save-file
 * bridgeDownloads), since PrimeForge's window refuses `blob:` downloads.
 */
export function ToolFrame({
  src,
  title,
  toolId,
  locale,
  python,
  thread = null,
  recorder = null,
}: {
  src: string;
  title: string;
  toolId: string;
  locale: Locale;
  python: boolean;
  /** `?thread=`: the conversation the ask panel opens (Notes, the AI queue). */
  thread?: string | null;
  /** The maths app only: the tool's title and kicker in both languages, for the recording overlay. */
  recorder?: {
    title: { en: string; zh: string };
    kicker: { en: string; zh: string } | null;
  } | null;
}) {
  const ref = useRef<HTMLIFrameElement>(null);
  const stageRef = useRef<HTMLDivElement>(null);
  const py = usePyState(ref, toolId);
  const [mounted, setMounted] = useState(false);
  const { change, set } = useAskPanel();
  const panel = change.shown;
  const hideRef = useRef<HTMLButtonElement>(null);
  const viewRef = useRef<HTMLDivElement>(null);
  const size = useAskWidth(viewRef);
  useEffect(() => {
    setMounted(true);
  }, []);
  // the page's own `blob:` exports, on every load (a reload is a new window)
  useEffect(() => {
    const frame = ref.current;
    if (!frame) return;
    const bridge = () => {
      try {
        bridgeDownloads(frame.contentWindow);
      } catch {
        // not same-origin: nothing to bridge
      }
    };
    frame.addEventListener("load", bridge);
    return () => frame.removeEventListener("load", bridge);
  }, []);
  // opened from either control: focus moves into the panel
  useEffect(() => {
    if (change.from && change.shown) hideRef.current?.focus();
  }, [change]);
  const t = MESSAGES[locale].qa;
  return (
    <div ref={viewRef} className="tool-view" data-panel={panel} data-resizing={size.dragging}>
      <div ref={stageRef} className="rec-stage" data-testid="rec-stage">
        <iframe
          ref={ref}
          className="tool-frame"
          data-testid="tool-frame"
          data-py-mode={py?.mode}
          data-py-prog={py?.progId}
          src={mounted ? src : undefined}
          title={title}
        />
        {recorder ? (
          <Recorder
            frameRef={ref}
            stageRef={stageRef}
            toolId={toolId}
            locale={locale}
            title={recorder.title}
            kicker={recorder.kicker}
          />
        ) : null}
      </div>
      <div className="ask-wrap" hidden={!panel} inert={!panel} style={size.style}>
        {size.narrow ? null : (
          // the left edge: drag (or ←/→) to resize, double-click for the default width
          // biome-ignore lint/a11y/useSemanticElements: a focusable splitter (WAI-ARIA window splitter), not a thematic break; <hr> cannot hold the pointer handlers
          <div
            role="separator"
            tabIndex={0}
            aria-orientation="vertical"
            aria-valuemin={size.min}
            aria-valuemax={size.max}
            aria-valuenow={size.value}
            className="ask-resize"
            data-testid="ask-resize"
            aria-label={t.resize}
            title={t.resize}
            {...size.handle}
          />
        )}
        <button
          ref={hideRef}
          type="button"
          className="iconbtn ask-hide"
          title={t.hidePanel}
          aria-label={t.hidePanel}
          data-testid="ask-hide"
          onClick={() => set(false, "panel")}
        >
          ▶
        </button>
        <AskPanel
          toolId={toolId}
          toolTitle={title}
          locale={locale}
          python={python}
          pyState={py}
          thread={thread}
        />
      </div>
    </div>
  );
}
