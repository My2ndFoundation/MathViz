// Structure after LiveStudioLab src/lib/i18n/locale.ts (LOCALES / isLocale / resolve, pure
// functions shared by server, client and tests). Changed: two locales, 'en' and 'zh'; the default
// is the target's defaultLang; the choice is stored in SQLite (settings.lang, lib/server/settings)
// rather than a cookie, and there is no Accept-Language negotiation or locale URL segment.
import type { Target } from "../target";
import { en, type Messages } from "./messages/en";
import { zh } from "./messages/zh";

export const LOCALES = ["en", "zh"] as const;
export type Locale = (typeof LOCALES)[number];

export const isLocale = (v: unknown): v is Locale =>
  typeof v === "string" && (LOCALES as readonly string[]).includes(v);

/** The language when the user has chosen none (every target ships English first). */
export const defaultLocale = (target: Pick<Target, "defaultLang">): Locale => target.defaultLang;

/** The stored choice if it is a locale, else the target's default. */
export const resolveLocale = (
  stored: string | null | undefined,
  target: Pick<Target, "defaultLang">,
): Locale => (isLocale(stored) ? stored : defaultLocale(target));

export const MESSAGES: Record<Locale, Messages> = { en, zh };
