import { route } from "@/lib/http/route";
import { deleteNote } from "@/lib/server/qa";

/** DELETE /api/notes/:id — lib/server/qa.ts. */
export const dynamic = "force-dynamic";

export const DELETE = route("DELETE", deleteNote);
