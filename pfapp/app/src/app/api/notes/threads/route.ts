import { route } from "@/lib/http/route";
import { getNoteThreads } from "@/lib/server/qa";

/** GET /api/notes/threads?q=&group= (one row per conversation with saved answers) — lib/server/qa.ts. */
export const dynamic = "force-dynamic";

export const GET = route("GET", getNoteThreads);
