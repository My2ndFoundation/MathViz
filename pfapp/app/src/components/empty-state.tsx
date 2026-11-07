"use client";

import Link from "next/link";
import { useState } from "react";
import type { Locale } from "@/lib/i18n/locale";
import { MESSAGES } from "@/lib/i18n/locale";
import { ImportPack } from "./import-pack";
import { OnlinePack } from "./online-pack";

/**
 * No content pack (design §7.1 step 2). First: install this app's content pack from the PrimeForge
 * store in one click (the Settings page's store row, with its progress); once it is installed the
 * app opens its first tool (`/<locale>` redirects there). Offline, signed out or outside
 * PrimeForge the row says so in one line. Second: import a local .pfaddon, then the first tool;
 * and a link to Settings. (Math Test Buddy has no such call to action — the owner asked for one.)
 */
export function EmptyState({ locale }: { locale: Locale }) {
  const t = MESSAGES[locale];
  const [opening, setOpening] = useState(false);
  const open = (tool: string | null) => {
    setOpening(true);
    window.location.assign(tool ? `/${locale}/tool/${encodeURIComponent(tool)}` : `/${locale}`);
  };

  return (
    <section className="empty" data-testid="empty-state">
      <h1>{t.content.none}</h1>
      <p>{t.content.noneBody}</p>
      <h2>{t.content.fromStore}</h2>
      <p>{t.content.fromStoreBody}</p>
      <OnlinePack locale={locale} primary onInstalled={() => open(null)} />
      {opening ? (
        <p className="small" data-testid="empty-opening">
          {t.online.opening}
        </p>
      ) : null}
      <h2>{t.content.orImport}</h2>
      <ImportPack locale={locale} onDone={(r) => open(r.firstTool)} />
      <p className="empty-foot">
        <Link href={`/${locale}/settings`} className="chip" data-testid="empty-settings">
          {t.content.openSettings}
        </Link>
      </p>
    </section>
  );
}
