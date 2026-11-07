import type { Db } from "../db/handle";
import { type Locale, resolveLocale } from "../i18n/locale";
import type { Target } from "../target";

/**
 * User preferences in SQLite `settings(key, value)`. Keys:
 * - `lang`: the shell's language (default: the target's defaultLang);
 * - `aiLang`: the tutor's reply language — `page` (the language of the page that asked, the
 *   default), or `en` / `zh` whatever the page is in. An unknown stored value reads as `page`.
 */

export const AI_LANGS = ["page", "en", "zh"] as const;
export type AiLang = (typeof AI_LANGS)[number];

const read = (db: Db, key: string) =>
  db.prepare("SELECT value FROM settings WHERE key = ?").get<{ value: string }>(key)?.value;

const write = (db: Db, key: string, value: string) =>
  db
    .prepare(
      "INSERT INTO settings (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value",
    )
    .run(key, value);

export function getLang(db: Db, target: Pick<Target, "defaultLang">): Locale {
  return resolveLocale(read(db, "lang"), target);
}

export function setLang(db: Db, lang: Locale): void {
  write(db, "lang", lang);
}

export function getAiLang(db: Db): AiLang {
  const v = read(db, "aiLang");
  return (AI_LANGS as readonly string[]).includes(v ?? "") ? (v as AiLang) : "page";
}

export function setAiLang(db: Db, v: AiLang): void {
  write(db, "aiLang", v);
}
