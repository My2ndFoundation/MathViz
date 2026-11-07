import { z } from "zod";
import { readJson } from "@/lib/http/body";
import { HttpError } from "@/lib/http/errors";
import { route } from "@/lib/http/route";
import { LOCALES } from "@/lib/i18n/locale";
import type { AppContext } from "@/lib/server/context";
import { AI_LANGS, getAiLang, getLang, setAiLang, setLang } from "@/lib/server/settings";

/**
 * GET / PUT /api/settings: {lang: 'en' | 'zh', aiLang: 'page' | 'en' | 'zh'} (defaults: the
 * target's defaultLang, 'page'). A PUT sets either field or both; at least one is required.
 */
export const dynamic = "force-dynamic";

const putSchema = z
  .object({ lang: z.enum(LOCALES).optional(), aiLang: z.enum(AI_LANGS).optional() })
  .strict()
  .refine((v) => v.lang !== undefined || v.aiLang !== undefined);

const view = (app: AppContext) => ({
  lang: getLang(app.db, app.target),
  aiLang: getAiLang(app.db),
});

export const GET = route("GET", (app) => ({ body: view(app) }));

export const PUT = route("PUT", async (app, { req }) => {
  const parsed = putSchema.safeParse(await readJson(req));
  if (!parsed.success) throw new HttpError(400, "bad_request");
  const { lang, aiLang } = parsed.data;
  app.db.transaction(() => {
    if (lang !== undefined) setLang(app.db, lang);
    if (aiLang !== undefined) setAiLang(app.db, aiLang);
  });
  return { body: view(app) };
});
