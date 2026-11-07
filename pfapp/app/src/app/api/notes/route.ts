import { route } from "@/lib/http/route";
import { getNotes, postNote } from "@/lib/server/qa";

/** GET /api/notes?q= (newest first), POST /api/notes {messageId} — lib/server/qa.ts. */
export const dynamic = "force-dynamic";

export const GET = route("GET", getNotes);
export const POST = route("POST", postNote);
