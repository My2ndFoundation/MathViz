import { csrfHeaders } from "./csrf";

/**
 * Saving a file from the app (design §5.3): PrimeForge's window refuses a `blob:` or `data:`
 * download and saves only an `<a download>` that points at a same-origin URL. So the bytes go up
 * to /api/exports first (lib/server/exports.ts), in chunks under the server's per-request limit
 * (a 4K recording is far larger than the proxy buffers), and then a same-origin link downloads
 * them back. Used by the recorder (components/recorder.tsx) and, through bridgeDownloads, by the
 * tool pages' own exports.
 */

/** Below lib/http/body EXPORT_CHUNK_LIMIT (16 MiB), with room to spare. */
const CHUNK = 8 * 1024 * 1024;

export async function saveFile(blob: Blob, name: string): Promise<void> {
  const headers = await csrfHeaders();
  const res = await fetch("/api/exports", {
    method: "POST",
    headers: { ...headers, "content-type": "application/json" },
    body: JSON.stringify({ name, size: blob.size }),
  });
  if (!res.ok) throw new Error(`export ${res.status}`);
  const made = (await res.json()) as { id: string; name: string };
  for (let at = 0; at < blob.size; at += CHUNK) {
    const part = await fetch(`/api/exports/${made.id}?offset=${at}`, {
      method: "POST",
      headers: { ...headers, "content-type": "application/octet-stream" },
      body: blob.slice(at, Math.min(at + CHUNK, blob.size)),
    });
    if (!part.ok) throw new Error(`export chunk ${part.status}`);
  }
  const a = document.createElement("a");
  a.href = `/api/exports/${made.id}`;
  a.download = made.name;
  a.hidden = true;
  document.body.appendChild(a);
  a.click();
  a.remove();
}

type BridgedWindow = Window & typeof globalThis & { __mvDownloads?: true };

/**
 * Make a tool page's own `blob:` exports save through saveFile. The pages (eight maths tools, two
 * chess ones) all do the same thing: `URL.createObjectURL(blob)`, an `<a download>` with that
 * href, `a.click()`, and often revoke the URL at once — so the blob is remembered when its URL is
 * made, and taken when the link is clicked (programmatically, or by the student), before any
 * revoke. The page itself is the web version's, unchanged: this is done from the shell, which the
 * same-origin frame lets reach in. Anything else falls through to the browser as before.
 */
export function bridgeDownloads(win: Window | null): void {
  const w = win as BridgedWindow | null;
  if (!w || w.__mvDownloads) return;
  let URLc: typeof URL;
  try {
    URLc = w.URL;
  } catch {
    return; // not same-origin: nothing to do
  }
  w.__mvDownloads = true;
  const blobs = new Map<string, Blob>();
  const make = URLc.createObjectURL.bind(URLc);
  const revoke = URLc.revokeObjectURL.bind(URLc);
  URLc.createObjectURL = (obj: Blob | MediaSource): string => {
    const url = make(obj);
    if (obj instanceof w.Blob) blobs.set(url, obj);
    return url;
  };
  URLc.revokeObjectURL = (url: string): void => {
    // kept a little longer: a save in flight still reads it
    setTimeout(() => blobs.delete(url), 60_000);
    revoke(url);
  };
  const take = (a: HTMLAnchorElement): Blob | undefined =>
    a.hasAttribute("download") ? blobs.get(a.href) : undefined;
  const save = (blob: Blob, a: HTMLAnchorElement): void => {
    saveFile(blob, a.getAttribute("download") || "download").catch((e) => {
      console.error("save failed", e);
    });
  };
  const click = w.HTMLAnchorElement.prototype.click;
  w.HTMLAnchorElement.prototype.click = function (this: HTMLAnchorElement) {
    const blob = take(this);
    if (blob) save(blob, this);
    else click.call(this);
  };
  w.document.addEventListener(
    "click",
    (e) => {
      const a = (e.target as Element | null)?.closest?.("a");
      const blob = a ? take(a as HTMLAnchorElement) : undefined;
      if (a && blob) {
        e.preventDefault();
        save(blob, a as HTMLAnchorElement);
      }
    },
    true,
  );
}
