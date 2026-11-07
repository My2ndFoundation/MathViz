import { route } from "@/lib/http/route";
import { deleteThreadNotes } from "@/lib/server/qa";

/** DELETE /api/notes/threads/:id (that conversation's saved answers; the conversation stays) — lib/server/qa.ts. */
export const dynamic = "force-dynamic";

export const DELETE = route("DELETE", deleteThreadNotes);
