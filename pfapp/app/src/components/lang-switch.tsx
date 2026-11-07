"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import type { Locale } from "@/lib/i18n/locale";
import { csrfHeaders } from "./csrf";

/**
 * The language switch. The URL locale is what the shell renders in; switching stores the choice
 * (PUT /api/settings, so `/` opens in it next time) and navigates to the same page under the other
 * locale — the tool iframe's src carries `?lang=`, so it reloads in the new language.
 */
export function LangSwitch({
  locale,
  label,
  title,
}: {
  locale: Locale;
  /** The other language's name, shown on the button. */
  label: string;
  title: string;
}) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const next: Locale = locale === "en" ? "zh" : "en";

  async function go() {
    setBusy(true);
    try {
      await fetch("/api/settings", {
        method: "PUT",
        headers: { "content-type": "application/json", ...(await csrfHeaders()) },
        body: JSON.stringify({ lang: next }),
      });
    } catch {
      // the setting only picks the language `/` opens in; the switch itself still works
    }
    const { pathname, search } = window.location;
    router.push(`${pathname.replace(/^\/(en|zh)(?=\/|$)/, `/${next}`)}${search}`);
    setBusy(false);
  }

  return (
    <button
      type="button"
      className="chip"
      data-testid="lang-switch"
      title={title}
      aria-label={title}
      lang={next}
      disabled={busy}
      onClick={go}
    >
      {label}
    </button>
  );
}
