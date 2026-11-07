import { z } from "zod";
import { readJson } from "@/lib/http/body";
import { HttpError } from "@/lib/http/errors";
import { route } from "@/lib/http/route";
import { LOCALES } from "@/lib/i18n/locale";
import { getLang, setLang } from "@/lib/server/settings";

/** GET / PUT /api/settings: {lang: 'en' | 'zh'} (default: the target's defaultLang). */
export const dynamic = "force-dynamic";

const putSchema = z.object({ lang: z.enum(LOCALES) }).strict();

export const GET = route("GET", (app) => ({ body: { lang: getLang(app.db, app.target) } }));

export const PUT = route("PUT", async (app, { req }) => {
  const parsed = putSchema.safeParse(await readJson(req));
  if (!parsed.success) throw new HttpError(400, "bad_request");
  setLang(app.db, parsed.data.lang);
  return { body: { lang: getLang(app.db, app.target) } };
});
