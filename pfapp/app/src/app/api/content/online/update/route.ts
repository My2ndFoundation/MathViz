import { route } from "@/lib/http/route";
import { postUpdate } from "@/lib/server/online";

/** POST /api/content/online/update (CSRF): see lib/server/online. */
export const dynamic = "force-dynamic";

export const POST = route("POST", postUpdate);
