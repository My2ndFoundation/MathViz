"use client";

import { useRef, useState } from "react";
import type { Locale } from "@/lib/i18n/locale";
import { MESSAGES } from "@/lib/i18n/locale";
import { csrfHeaders } from "./csrf";

export interface Imported {
  version: string;
  firstTool: string | null;
}

/**
 * "Import a local content pack": POST /api/content/import (multipart, CSRF), then `onDone` with
 * the version now served and the first tool. Used by Settings → Content pack and, as the second
 * way in, by the empty state.
 */
export function ImportPack({ locale, onDone }: { locale: Locale; onDone: (r: Imported) => void }) {
  const t = MESSAGES[locale];
  const file = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const errors = t.error as Record<string, string>;

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
        version?: string;
        firstTool?: string | null;
        error?: { code?: string };
      } | null;
      if (!res.ok) {
        const code = body?.error?.code ?? "internal";
        setError(errors[code] ?? errors.internal ?? code);
        return;
      }
      onDone({ version: body?.version ?? "", firstTool: body?.firstTool ?? null });
    } catch {
      setError(errors.internal ?? "error");
    } finally {
      setBusy(false);
      if (file.current) file.current.value = "";
    }
  }

  return (
    <div className="import-pack">
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
        {busy ? t.content.importing : t.content.importLocal}
      </button>
      {error ? (
        <p className="err small" role="alert" data-testid="import-error">
          {error}
        </p>
      ) : null}
    </div>
  );
}
