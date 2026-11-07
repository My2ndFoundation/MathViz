"use client";
import { useEffect, useRef, useState } from "react";
import { usePyState } from "./use-py-state";

/**
 * The tool view (design §7.3): the web version's page, as it is, in a same-origin iframe of
 * /c/<content version>/tools/<file>. Keyed by src, so a new language or program is a fresh load.
 * The python page's state (usePyState) is mirrored to data-py-* attributes, which is also how the
 * e2e suite observes the bridge.
 *
 * The iframe gets its src only after mount. The python page posts its state once on mount and
 * otherwise only on a change; with the src in the server HTML the page could load and post before
 * hydration attached usePyState's listener, and the shell would know nothing until the first
 * interaction. Effects run in declaration order, so the listener (usePyState's effect) is in place
 * before this component's effect hands the iframe its src.
 */
export function ToolFrame({ src, title, toolId }: { src: string; title: string; toolId: string }) {
  const ref = useRef<HTMLIFrameElement>(null);
  const py = usePyState(ref, toolId);
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);
  return (
    <iframe
      key={src}
      ref={ref}
      className="tool-frame"
      data-testid="tool-frame"
      data-py-mode={py?.mode}
      data-py-prog={py?.progId}
      src={mounted ? src : undefined}
      title={title}
    />
  );
}
