import { route } from "@/lib/http/route";
import { postThread } from "@/lib/server/qa";

/** POST /api/threads: a new question (lib/server/qa.ts). */
export const dynamic = "force-dynamic";

export const POST = route("POST", postThread);
