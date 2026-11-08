"use client";
import Link from "next/link";
import type { Locale } from "@/lib/i18n/locale";

export interface BuildInfo {
  /** The app's own version (its shipped manifest), or null when it cannot be read. */
  app: string | null;
  /** The content pack the app serves. */
  pack: { name: string; version: string; source: string } | null;
}

/**
 * The top bar's last chip: "App 1.0.1 · Python content 1.0.0", a link to Settings → Content, the
 * pack's source (store / imported file) in its tooltip. Quiet (mono, slate); hidden on a narrow
 * window (≤ 760 px), where the sidebar's footer and Settings still show both.
 */
export function VersionChip({
  locale,
  info,
  appLabel,
}: {
  locale: Locale;
  info: BuildInfo;
  appLabel: string;
}) {
  const parts = [
    info.app ? appLabel.replace("{version}", info.app) : null,
    info.pack ? `${info.pack.name} ${info.pack.version}` : null,
  ].filter((p): p is string => p !== null);
  if (!parts.length) return null;
  const title = [
    ...parts.slice(0, -1),
    info.pack ? `${parts.at(-1)} — ${info.pack.source}` : parts.at(-1),
  ].join(" · ");
  return (
    <Link
      href={`/${locale}/settings#content`}
      className="chip tb-version no-underline"
      data-testid="version-chip"
      title={title}
      onClick={(e) => {
        // already on Settings: a hash-only Link updates history without a hashchange
        if (window.location.pathname === `/${locale}/settings`) {
          e.preventDefault();
          window.location.hash = "content";
        }
      }}
    >
      {info.app ? (
        <span data-testid="version-app">{appLabel.replace("{version}", info.app)}</span>
      ) : null}
      {info.app && info.pack ? <span aria-hidden="true">·</span> : null}
      {info.pack ? (
        <span data-testid="version-pack">{`${info.pack.name} ${info.pack.version}`}</span>
      ) : null}
    </Link>
  );
}
