"use client";
import {
  type KeyboardEvent as ReactKeyboardEvent,
  type PointerEvent as ReactPointerEvent,
  type RefObject,
  useCallback,
  useEffect,
  useRef,
  useState,
} from "react";

/**
 * The ask panel's width, resizable by dragging its left edge (or the arrow keys on that edge, a
 * focusable separator). Clamped to [MIN, the tool view's width − FRAME_MIN] so the tool page keeps
 * room, recomputed when the window or the tool view resizes; remembered in localStorage ("pfapp-ask-width");
 * double-click resets to the CSS default (340 px, 300 px under 1100 px). Narrow windows
 * (≤ NARROW px) keep the fixed CSS width and no handle.
 *
 * `width` null means "the CSS default"; the style the caller applies is then empty.
 */
export const ASK_MIN = 280;
export const FRAME_MIN = 480;
const NARROW = 760;
const STEP = 16;
const KEY = "pfapp-ask-width";

const cssDefault = () => (window.matchMedia("(max-width: 1100px)").matches ? 300 : 340);

export function useAskWidth(view: RefObject<HTMLElement | null>) {
  const [width, setWidth] = useState<number | null>(null);
  const [max, setMax] = useState(10_000);
  const [narrow, setNarrow] = useState(false);
  // the CSS default, measured after mount (the server cannot know the window: no hydration mismatch)
  const [def, setDef] = useState(340);
  const [dragging, setDragging] = useState(false);
  const drag = useRef<{ x: number; w: number; id: number } | null>(null);

  const bounds = useCallback(() => {
    const total = view.current?.clientWidth ?? window.innerWidth;
    return Math.max(ASK_MIN, total - FRAME_MIN);
  }, [view]);
  const clamp = useCallback(
    (w: number, hi: number) => Math.round(Math.min(hi, Math.max(ASK_MIN, w))),
    [],
  );

  useEffect(() => {
    const measure = () => {
      setMax(bounds());
      setNarrow(window.innerWidth <= NARROW);
      setDef(cssDefault());
    };
    measure();
    try {
      const saved = Number(localStorage.getItem(KEY));
      if (saved > 0) setWidth(saved);
    } catch {
      // no storage: the default
    }
    // the window, and the tool view itself (the sidebar collapsing widens it without a resize)
    window.addEventListener("resize", measure);
    const ro = typeof ResizeObserver === "undefined" ? null : new ResizeObserver(measure);
    if (view.current) ro?.observe(view.current);
    return () => {
      window.removeEventListener("resize", measure);
      ro?.disconnect();
    };
  }, [bounds, view]);

  const save = (w: number | null) => {
    try {
      if (w == null) localStorage.removeItem(KEY);
      else localStorage.setItem(KEY, String(w));
    } catch {
      // no storage: this session only
    }
  };
  /** what is shown: the chosen width within today's bounds, else the CSS default */
  const now = width == null ? null : clamp(width, max);
  const value = now ?? Math.min(def, max);

  const onPointerDown = (e: ReactPointerEvent<HTMLElement>) => {
    if (e.button !== 0) return;
    e.preventDefault();
    e.currentTarget.setPointerCapture(e.pointerId);
    const panel = e.currentTarget.parentElement;
    drag.current = { x: e.clientX, w: panel?.offsetWidth ?? value, id: e.pointerId };
    setMax(bounds());
    setDragging(true);
  };
  const onPointerMove = (e: ReactPointerEvent<HTMLElement>) => {
    const d = drag.current;
    if (!d || d.id !== e.pointerId) return;
    // the panel is on the right: moving the edge left widens it
    setWidth(clamp(d.w + (d.x - e.clientX), bounds()));
  };
  const end = (e: ReactPointerEvent<HTMLElement>) => {
    const d = drag.current;
    if (!d || d.id !== e.pointerId) return;
    drag.current = null;
    setDragging(false);
    const w = clamp(d.w + (d.x - e.clientX), bounds());
    setWidth(w);
    save(w);
  };
  const onKeyDown = (e: ReactKeyboardEvent<HTMLElement>) => {
    const hi = bounds();
    const next =
      e.key === "ArrowLeft"
        ? value + STEP
        : e.key === "ArrowRight"
          ? value - STEP
          : e.key === "Home"
            ? ASK_MIN
            : e.key === "End"
              ? hi
              : null;
    if (next == null) return;
    e.preventDefault();
    const w = clamp(next, hi);
    setMax(hi);
    setWidth(w);
    save(w);
  };
  const onDoubleClick = () => {
    setWidth(null);
    save(null);
  };

  return {
    min: ASK_MIN,
    max,
    value,
    narrow,
    dragging,
    /** inline width for the panel (none on a narrow window or at the default) */
    style: !narrow && now != null ? { flexBasis: `${now}px`, width: `${now}px` } : undefined,
    handle: {
      onPointerDown,
      onPointerMove,
      onPointerUp: end,
      onPointerCancel: end,
      onKeyDown,
      onDoubleClick,
    },
  };
}
