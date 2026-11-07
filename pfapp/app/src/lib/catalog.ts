import type { Locale } from "./i18n/locale";

/**
 * The sidebar's catalog as the client sees it (lib/server/catalog loads it from SQLite), and the
 * ⌘K filter over it. No server imports: the sidebar and ⌘K bundle this file.
 */

export interface Bilingual {
  en: string;
  zh: string;
}

export interface ShellItem {
  id: string;
  /** Payload-relative, `tools/<file>`. */
  file: string;
  title: Bilingual;
  tag: Bilingual | null;
  version: string;
  accent: string;
}

export interface ShellGroup {
  id: string;
  label: Bilingual;
  items: ShellItem[];
}

/** ⌘K: items whose title or tag (in `lang`) contains every word of `query`, case-insensitively. */
export function filterCatalog<T extends Pick<ShellItem, "title" | "tag">>(
  items: readonly T[],
  query: string,
  lang: Locale,
): T[] {
  const words = query.toLowerCase().split(/\s+/).filter(Boolean);
  if (!words.length) return [...items];
  return items.filter((i) => {
    const hay = `${i.title[lang]}\n${i.tag?.[lang] ?? ""}`.toLowerCase();
    return words.every((w) => hay.includes(w));
  });
}
