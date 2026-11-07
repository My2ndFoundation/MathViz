import { route } from "@/lib/http/route";
import { postGet } from "@/lib/server/online";

/** POST /api/content/online/get (CSRF): see lib/server/online. */
export const dynamic = "force-dynamic";

export const POST = route("POST", postGet);
