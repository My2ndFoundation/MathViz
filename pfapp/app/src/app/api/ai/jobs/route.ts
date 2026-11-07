import { route } from "@/lib/http/route";
import { getAiJobs } from "@/lib/server/ai-jobs";

/** GET /api/ai/jobs: {ai: {available, reason, state}, active, recent} — lib/server/ai-jobs.ts. */
export const dynamic = "force-dynamic";

export const GET = route("GET", getAiJobs);
