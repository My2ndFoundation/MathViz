"use client";
import { type RefObject, useEffect, useRef } from "react";
import type { Locale } from "@/lib/i18n/locale";
import { saveFile } from "./save-file";

/**
 * The maths app's video recorder: the web shell's own (app.html's "录制器" block), generated into
 * /recorder/rec.js and rec.css by scripts/recorder.ts, so there is one recorder and the web shell
 * is its source. This component is the web shell's part of the bargain:
 *
 * - the markup the block expects: #recBtn (.dot + #recBtnTxt) and #recPanel, floating at the
 *   bottom right of the frame's area (`.rec-stage`, which REC_HOST.stage() names — the block's
 *   `.stage` lookups are swapped for it at generation);
 * - the web shell's globals it reads: `frame` (the tool iframe), `curId` (the tool's id), `LANG`
 *   and `byId(id)` (the tool's title and kicker, for the overlay) — defined on window as getters
 *   over the mounted instance;
 * - its lifecycle hooks: mount once the script is in; Bridge.invalidate() on every frame load;
 *   abort() when the tool, or the language, changes (this component unmounts: the page renders the
 *   frame with key={src});
 * - and its download: REC.Encoder.download is a `blob:` link, which PrimeForge's window refuses
 *   (design §5.3), so it is replaced by saveFile (upload, then a same-origin `<a download>`).
 *
 * The recorder reaches into the tool page with `contentWindow.eval` to drive its clock and camera
 * frame by frame; the maths tool pages are served with 'unsafe-eval' for it (lib/http/csp
 * toolCsp), the shell's own policy is unchanged.
 */

interface RecApi {
  UI: { mount(): void; render(): void };
  Bridge: { invalidate(): void };
  Encoder: { download(blob: Blob, name: string): void };
  abort(): void;
}

interface Bilingual {
  en: string;
  zh: string;
}

interface Host {
  frame: HTMLIFrameElement | null;
  toolId: string;
  lang: Locale;
  title: Bilingual;
  kicker: Bilingual | null;
  stage: HTMLElement | null;
}

type RecWindow = Window & {
  REC?: RecApi;
  REC_HOST?: { stage(): HTMLElement | null };
  __recHost?: Host | null;
};

let loading: Promise<RecApi> | null = null;

/** Define the web shell's globals once (getters over the mounted instance), then load the block. */
function load(): Promise<RecApi> {
  const w = window as RecWindow;
  if (loading) return loading;
  const host = () => w.__recHost ?? null;
  const define = (name: string, get: () => unknown) =>
    Object.defineProperty(window, name, { configurable: true, get });
  define("frame", () => host()?.frame ?? null);
  define("curId", () => host()?.toolId ?? null);
  define("LANG", () => host()?.lang ?? "en");
  define("byId", () => (id: string) => {
    const h = host();
    return h && h.toolId === id ? { title: h.title, kicker: h.kicker ?? undefined } : undefined;
  });
  w.REC_HOST = { stage: () => host()?.stage ?? null };
  loading = new Promise<RecApi>((resolve, reject) => {
    const css = document.createElement("link");
    css.rel = "stylesheet";
    css.href = "/recorder/rec.css";
    document.head.appendChild(css);
    const s = document.createElement("script");
    s.src = "/recorder/rec.js";
    s.onload = () => {
      const rec = w.REC;
      if (!rec) return reject(new Error("recorder did not load"));
      // PrimeForge's window saves same-origin links only (save-file.ts)
      rec.Encoder.download = (blob, name) => {
        saveFile(blob, name).catch((e) => console.error("recording not saved", e));
      };
      resolve(rec);
    };
    s.onerror = () => {
      loading = null;
      reject(new Error("recorder failed to load"));
    };
    document.head.appendChild(s);
  });
  return loading;
}

export function Recorder({
  frameRef,
  stageRef,
  toolId,
  locale,
  title,
  kicker,
}: {
  frameRef: RefObject<HTMLIFrameElement | null>;
  stageRef: RefObject<HTMLElement | null>;
  toolId: string;
  locale: Locale;
  title: Bilingual;
  kicker: Bilingual | null;
}) {
  // the overlay's words, read when a recording draws (not effect inputs: a re-render with new
  // but equal objects must not abort a recording in progress)
  const words = useRef({ title, kicker });
  words.current = { title, kicker };
  useEffect(() => {
    const w = window as RecWindow;
    const me: Host = {
      frame: frameRef.current,
      toolId,
      lang: locale,
      get title() {
        return words.current.title;
      },
      get kicker() {
        return words.current.kicker;
      },
      stage: stageRef.current,
    };
    w.__recHost = me;
    let rec: RecApi | null = null;
    let live = true;
    const frame = frameRef.current;
    const onLoad = () => rec?.Bridge.invalidate();
    frame?.addEventListener("load", onLoad);
    load()
      .then((r) => {
        if (!live) return;
        rec = r;
        r.Bridge.invalidate();
        r.UI.mount();
      })
      .catch((e) => console.error(e));
    return () => {
      live = false;
      frame?.removeEventListener("load", onLoad);
      // a new tool or language: the recording (if any) belonged to the frame that is going away
      rec?.abort();
      if (w.__recHost === me) w.__recHost = null;
    };
  }, [frameRef, stageRef, toolId, locale]);
  const label = locale === "zh" ? "录制视频" : "Record video";
  return (
    <>
      <button type="button" className="rec-btn" id="recBtn" data-testid="rec-btn" title={label}>
        <span className="dot" />
        <span id="recBtnTxt" />
      </button>
      <div className="rec-panel" id="recPanel" data-testid="rec-panel" />
    </>
  );
}
