import chess from "../../../targets/chess/target.json";
import crypto from "../../../targets/crypto/target.json";
import math from "../../../targets/math/target.json";
import python from "../../../targets/python/target.json";

export type TargetId = "math" | "chess" | "crypto" | "python";

export interface Target {
  id: TargetId;
  appId: string;
  /** The full app name: "Viz Learn Buddy for <subject>" (manifest, store, window title). */
  name: { en: string; zh: string };
  /** The subject half of the name ("for Python"), shown under the "Viz Learn Buddy" eyebrow. */
  subject: { en: string; zh: string };
  /** What its content pack is called in the top bar ("Python content"). */
  pack: { en: string; zh: string };
  /** The example question in "Ask the whole library" (about one of this target's tools). */
  libraryExample: { en: string; zh: string };
  port: number;
  defaultLang: "en";
  groupField: "cat" | "phase" | "chapter" | "module";
  /** Path relative to the MathViz root. */
  registry: string;
  toolDir: string;
  subjectTypes: ("tool" | "program" | "blank" | "library")[];
}

const TARGETS: Record<TargetId, Target> = {
  math: math as Target,
  chess: chess as Target,
  crypto: crypto as Target,
  python: python as Target,
};

export function loadTarget(id: string | undefined = process.env.MATHVIZ_TARGET): Target {
  if (id !== undefined && Object.hasOwn(TARGETS, id)) return TARGETS[id as TargetId];
  throw new Error(
    `Unknown MATHVIZ_TARGET: ${JSON.stringify(id)} (expected math|chess|crypto|python)`,
  );
}
