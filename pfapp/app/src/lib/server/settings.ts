import type { Db } from "../db/handle";
import { type Locale, resolveLocale } from "../i18n/locale";
import type { Target } from "../target";

/** User preferences in SQLite `settings(key, value)`. Keys: `lang`. */

export function getLang(db: Db, target: Pick<Target, "defaultLang">): Locale {
  const row = db.prepare("SELECT value FROM settings WHERE key = 'lang'").get<{ value: string }>();
  return resolveLocale(row?.value, target);
}

export function setLang(db: Db, lang: Locale): void {
  db.prepare(
    "INSERT INTO settings (key, value) VALUES ('lang', ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value",
  ).run(lang);
}
