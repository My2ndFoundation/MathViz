import { route } from "@/lib/http/route";
import { deleteJob, getJob } from "@/lib/server/qa";

/** GET /api/jobs/:id (poll), DELETE /api/jobs/:id (cancel) — lib/server/qa.ts. */
export const dynamic = "force-dynamic";

export const GET = route("GET", getJob);
export const DELETE = route("DELETE", deleteJob);
