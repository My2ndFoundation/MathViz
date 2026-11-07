import chess from "../../../targets/chess/target.json";
import crypto from "../../../targets/crypto/target.json";
import math from "../../../targets/math/target.json";
import python from "../../../targets/python/target.json";

export type TargetId = "math" | "chess" | "crypto" | "python";

export interface Target {
  id: TargetId;
  appId: string;
  name: { en: string; zh: string };
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
