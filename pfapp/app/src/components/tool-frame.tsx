"use client";
import { useEffect, useRef, useState } from "react";
import type { Locale } from "@/lib/i18n/locale";
import { MESSAGES } from "@/lib/i18n/locale";
import { AskPanel } from "./qa/ask-panel";
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
 * Beside the frame, the "ask" panel (Task 11), fed the same bridge state; it can be hidden (the
 * choice is remembered in localStorage, like the sidebar's).
 */
export function ToolFrame({
  src,
  title,
  toolId,
  locale,
  python,
}: {
  src: string;
  title: string;
  toolId: string;
  locale: Locale;
  python: boolean;
}) {
  const ref = useRef<HTMLIFrameElement>(null);
  const py = usePyState(ref, toolId);
  const [mounted, setMounted] = useState(false);
  const [panel, setPanel] = useState(true);
  useEffect(() => {
    setMounted(true);
    try {
      setPanel(localStorage.getItem("pfapp-ask") !== "hidden");
    } catch {
      // no storage: shown
    }
  }, []);
  const show = (v: boolean) => {
    setPanel(v);
    try {
      localStorage.setItem("pfapp-ask", v ? "shown" : "hidden");
    } catch {
      // no storage: this session only
    }
  };
  const t = MESSAGES[locale].qa;
  return (
    <div className="tool-view" data-panel={panel}>
      <iframe
        ref={ref}
        className="tool-frame"
        data-testid="tool-frame"
        data-py-mode={py?.mode}
        data-py-prog={py?.progId}
        src={mounted ? src : undefined}
        title={title}
      />
      {panel ? (
        <div className="ask-wrap">
          <button
            type="button"
            className="iconbtn ask-hide"
            title={t.hidePanel}
            aria-label={t.hidePanel}
            data-testid="ask-hide"
            onClick={() => show(false)}
          >
            ▶
          </button>
          <AskPanel
            toolId={toolId}
            toolTitle={title}
            locale={locale}
            python={python}
            pyState={py}
          />
        </div>
      ) : (
        <button
          type="button"
          className="ask-open"
          title={t.showPanel}
          data-testid="ask-open"
          onClick={() => show(true)}
        >
          {t.panel}
        </button>
      )}
    </div>
  );
}
