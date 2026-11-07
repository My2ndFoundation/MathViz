import { randomBytes } from "node:crypto";

/**
 * Row ids: ULIDs (Crockford base32, 10 characters of milliseconds then 16 random), so ids sort by
 * creation time like MathTestBuddy's. Within one millisecond the random part is not monotonic;
 * every list that needs a strict order also sorts by its `created_at`.
 */

const B32 = "0123456789ABCDEFGHJKMNPQRSTVWXYZ";

export function newId(nowIso: string = new Date().toISOString()): string {
  let t = Date.parse(nowIso);
  if (!Number.isFinite(t) || t < 0) t = Date.now();
  let time = "";
  for (let i = 0; i < 10; i++) {
    time = B32[t % 32] + time;
    t = Math.floor(t / 32);
  }
  const r = randomBytes(16);
  let rand = "";
  for (let i = 0; i < 16; i++) rand += B32[(r[i] as number) % 32];
  return time + rand;
}
