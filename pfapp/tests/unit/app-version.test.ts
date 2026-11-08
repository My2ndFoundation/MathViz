import { describe, expect, test } from "bun:test";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { appVersion } from "../../app/src/lib/server/app-version";
import { tmp } from "../helpers/content-fixtures";

const PFAPP = join(import.meta.dir, "..", "..");
const manifest = (t: string) =>
  JSON.parse(readFileSync(join(PFAPP, "targets", t, "manifest.json"), "utf8")) as {
    id: string;
    version: string;
  };

describe("appVersion (the top bar's app version: the shipped manifest, never a constant)", () => {
  test("a package: <install dir>/manifest.json", () => {
    const dir = tmp("appver-pkg");
    writeFileSync(
      join(dir, "manifest.json"),
      JSON.stringify({ id: "app.primeforge.mathviz.python", version: "9.8.7" }),
    );
    expect(appVersion("python", "app.primeforge.mathviz.python", dir)).toBe("9.8.7");
  });
  test("the source tree: targets/<target>/manifest.json, from pfapp/ or pfapp/app", () => {
    for (const t of ["math", "chess", "crypto", "python"] as const) {
      const m = manifest(t);
      expect(appVersion(t, m.id, PFAPP)).toBe(m.version);
      expect(appVersion(t, m.id, join(PFAPP, "app"))).toBe(m.version);
    }
  });
  test("another app's manifest, a bad version, or none: null", () => {
    const dir = tmp("appver-bad");
    writeFileSync(
      join(dir, "manifest.json"),
      JSON.stringify({ id: "app.primeforge.mathviz.chess", version: "1.0.0" }),
    );
    expect(appVersion("python", "app.primeforge.mathviz.python", dir)).toBeNull();
    const bad = tmp("appver-semver");
    writeFileSync(
      join(bad, "manifest.json"),
      JSON.stringify({ id: "app.primeforge.mathviz.python", version: "1.0" }),
    );
    expect(appVersion("python", "app.primeforge.mathviz.python", bad)).toBeNull();
    const none = tmp("appver-none");
    mkdirSync(join(none, "x"));
    expect(appVersion("python", "app.primeforge.mathviz.python", join(none, "x"))).toBeNull();
  });
});
