import { CSRF_HEADER } from "@/lib/http/guard";

/** The x-primeforge-csrf header for a write, from a same-origin GET /api/session-token. */
export async function csrfHeaders(): Promise<Record<string, string>> {
  const res = await fetch("/api/session-token", { cache: "no-store" });
  if (!res.ok) throw new Error(`session-token ${res.status}`);
  const { token } = (await res.json()) as { token: string };
  return { [CSRF_HEADER]: token };
}
