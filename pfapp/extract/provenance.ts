import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";

/** Bump when the payload format or extraction rules change. */
export const EXTRACTOR_VERSION = "1.0.0";

export const sha256 = (data: Buffer | string): string =>
  createHash("sha256").update(data).digest("hex");

const git = (mvPath: string, ...args: string[]): string =>
  execFileSync("git", ["-C", mvPath, ...args], { encoding: "utf8", stdio: "pipe" });

/**
 * Same discipline as PFD's build-mathtestbuddy.ts: the payload must be reproducible from the
 * recorded SHA, so uncommitted or untracked (non-ignored) changes anywhere in the checkout are
 * refused. Kept separate from `extract()` so tests can opt out explicitly; the CLI never does.
 */
export const isClean = (mvPath: string): boolean =>
  git(mvPath, "status", "--porcelain").trim() === "";

export function assertCleanCheckout(mvPath: string): void {
  const status = git(mvPath, "status", "--porcelain");
  if (status.trim() !== "") {
    const first = status.split("\n").slice(0, 5).join("\n");
    throw new Error(`MathViz checkout is not clean: ${mvPath}\n${first}`);
  }
}

export const headSha = (mvPath: string): string => git(mvPath, "rev-parse", "HEAD").trim();

export interface FileHash {
  path: string;
  sha256: string;
}

/** sha256 over `"<sha256>  <path>\n"` lines in path order (provenance.json excluded by caller). */
export function fingerprintOf(files: FileHash[]): string {
  return sha256(files.map((f) => `${f.sha256}  ${f.path}\n`).join(""));
}

/**
 * No timestamps anywhere: the same SHA extracted twice must give the same bytes, or PFD's
 * publish:addon refuses a re-pack as "same version, different bytes". `files` is an array, not a
 * path-keyed object, so file names never become JSON keys.
 */
export function buildProvenance(o: {
  target: string;
  sha: string;
  clean: boolean;
  fingerprint: string;
  files: FileHash[];
}) {
  return {
    target: o.target,
    sha: o.sha,
    clean: o.clean,
    extractor: EXTRACTOR_VERSION,
    fingerprint: o.fingerprint,
    files: o.files,
  };
}
