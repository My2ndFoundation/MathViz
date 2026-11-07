import { route } from "@/lib/http/route";
import { findThread, postThread } from "@/lib/server/qa";

/** GET /api/threads?subject=<type>:<id> (the newest thread about it), POST /api/threads: a new question (lib/server/qa.ts). */
export const dynamic = "force-dynamic";

export const GET = route("GET", findThread);
export const POST = route("POST", postThread);
