/**
 * The python tool page's read-only state bridge, shell side (python/core/interact.js
 * `stateMessage`): `{type:'mathviz/py-state', v:1, page, progId, mode, blankId, given}`. Fields
 * are kept as sent — `blankId` is the most recently focused blank and may differ from the ones
 * in `given`; nothing here infers.
 */
export type PyMode = "read" | "blank" | "trace";
export interface PyState {
  progId: string;
  mode: PyMode;
  blankId: string | null;
  given: string[];
}

const MODES: readonly string[] = ["read", "blank", "trace"];

export function parsePyState(
  ev: { origin: string; data: unknown },
  expectedOrigin: string,
  page: string,
): PyState | null {
  if (ev.origin !== expectedOrigin) return null;
  const d = ev.data;
  if (typeof d !== "object" || d === null) return null;
  const m = d as Record<string, unknown>;
  if (m.type !== "mathviz/py-state" || m.v !== 1) return null;
  if (m.page !== page) return null;
  return toPyState(m);
}

/**
 * The PyState fields of `v`, checked as parsePyState checks them; null when any is wrong. Also how
 * a stored state is read back (lib/ai/jobs inputOf): an invalid one counts as no state at all.
 */
export function toPyState(v: unknown): PyState | null {
  if (typeof v !== "object" || v === null) return null;
  const m = v as Record<string, unknown>;
  if (typeof m.progId !== "string") return null;
  if (typeof m.mode !== "string" || !MODES.includes(m.mode)) return null;
  if (m.blankId !== null && typeof m.blankId !== "string") return null;
  if (!Array.isArray(m.given) || !m.given.every((g) => typeof g === "string")) return null;
  return {
    progId: m.progId,
    mode: m.mode as PyMode,
    blankId: m.blankId as string | null,
    given: [...(m.given as string[])],
  };
}
