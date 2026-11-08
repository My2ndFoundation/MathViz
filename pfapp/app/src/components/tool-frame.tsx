"use client";
import { useEffect, useRef, useState } from "react";
import type { Locale } from "@/lib/i18n/locale";
import { MESSAGES } from "@/lib/i18n/locale";
import { AskPanel } from "./qa/ask-panel";
import { useAskPanel } from "./qa/use-ask-panel";
import { useAskWidth } from "./qa/use-ask-width";
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
 */
export function ToolFrame({
  src,
  title,
  toolId,
  locale,
  python,
  thread = null,
}: {
  src: string;
  title: string;
  toolId: string;
  locale: Locale;
  python: boolean;
  /** `?thread=`: the conversation the ask panel opens (Notes, the AI queue). */
  thread?: string | null;
}) {
  const ref = useRef<HTMLIFrameElement>(null);
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
  // opened from either control: focus moves into the panel
  useEffect(() => {
    if (change.from && change.shown) hideRef.current?.focus();
  }, [change]);
  const t = MESSAGES[locale].qa;
  return (
    <div ref={viewRef} className="tool-view" data-panel={panel} data-resizing={size.dragging}>
      <iframe
        ref={ref}
        className="tool-frame"
        data-testid="tool-frame"
        data-py-mode={py?.mode}
        data-py-prog={py?.progId}
        src={mounted ? src : undefined}
        title={title}
      />
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
