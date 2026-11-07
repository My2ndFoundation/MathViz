import { route } from "@/lib/http/route";
import { getOnline } from "@/lib/server/online";

/** GET /api/content/online: the content pack in the PrimeForge store (lib/server/online). */
export const dynamic = "force-dynamic";

export const GET = route("GET", getOnline);
