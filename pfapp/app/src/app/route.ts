import { route } from "@/lib/http/route";
import { getLang } from "@/lib/server/settings";

/**
 * GET /: to the shell in the stored language (settings.lang, else the target's default). The URL
 * locale is what the pages render in; this is the only place the setting picks it.
 */
export const dynamic = "force-dynamic";

export const GET = route(
  "GET",
  (app) =>
    new Response(null, {
      status: 307,
      headers: { location: `/${getLang(app.db, app.target)}`, "cache-control": "no-store" },
    }),
);
