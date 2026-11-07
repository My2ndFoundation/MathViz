import { route } from "@/lib/http/route";
import { postInstall } from "@/lib/server/online";

/** POST /api/content/online/install (CSRF): see lib/server/online. */
export const dynamic = "force-dynamic";

export const POST = route("POST", postInstall);
