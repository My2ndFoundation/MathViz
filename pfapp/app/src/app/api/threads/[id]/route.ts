import { route } from "@/lib/http/route";
import { getThread, postFollowUp } from "@/lib/server/qa";

/** GET /api/threads/:id (the thread), POST /api/threads/:id (a follow-up) — lib/server/qa.ts. */
export const dynamic = "force-dynamic";

export const GET = route("GET", getThread);
export const POST = route("POST", postFollowUp);
