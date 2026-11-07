"use client";

import { useRef, useState } from "react";
import type { Locale } from "@/lib/i18n/locale";
import { csrfHeaders } from "./csrf";

export interface EmptyText {
  none: string;
  noneBody: string;
  fromStore: string;
  fromStoreBody: string;
  importLocal: string;
  importing: string;
  /** error.<code> strings, for the import's refusals. */
  errors: Record<string, string>;
}

/**
 * No content pack (design §7.1 step 2): how to install one from the store, and "import a local
 * content pack" — POST /api/content/import (multipart, CSRF), then the first tool.
 */
export function EmptyState({ locale, text }: { locale: Locale; text: EmptyText }) {
  const file = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function upload(f: File) {
    setBusy(true);
    setError(null);
    try {
      const form = new FormData();
      form.append("file", f, f.name);
      const res = await fetch("/api/content/import", {
        method: "POST",
        headers: await csrfHeaders(),
        body: form,
      });
      const body = (await res.json().catch(() => null)) as {
        firstTool?: string | null;
        error?: { code?: string };
      } | null;
      if (!res.ok) {
        const code = body?.error?.code ?? "internal";
        setError(text.errors[code] ?? text.errors.internal ?? code);
        return;
      }
      window.location.assign(
        body?.firstTool ? `/${locale}/tool/${encodeURIComponent(body.firstTool)}` : `/${locale}`,
      );
    } catch {
      setError(text.errors.internal ?? "error");
    } finally {
      setBusy(false);
      if (file.current) file.current.value = "";
    }
  }

  return (
    <section className="empty" data-testid="empty-state">
      <h1>{text.none}</h1>
      <p>{text.noneBody}</p>
      <h2>{text.fromStore}</h2>
      <p>{text.fromStoreBody}</p>
      <h2>{text.importLocal}</h2>
      <input
        ref={file}
        type="file"
        accept=".pfaddon,application/gzip"
        hidden
        data-testid="import-file"
        onChange={(e) => {
          const f = e.target.files?.[0];
          if (f) void upload(f);
        }}
      />
      <button
        type="button"
        className="chip"
        data-testid="import-button"
        disabled={busy}
        onClick={() => file.current?.click()}
      >
        {busy ? text.importing : text.importLocal}
      </button>
      {error ? (
        <p className="err" role="alert" data-testid="import-error">
          {error}
        </p>
      ) : null}
    </section>
  );
}
