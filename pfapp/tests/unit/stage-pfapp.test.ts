import { describe, expect, test } from "bun:test";
import {
  chmodSync,
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  statSync,
  symlinkSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
  BUILD_ENTRIES,
  checkStage,
  childEnv,
  clearStage,
  copyTree,
  PRODUCTION_INSTALL,
  packagingProblems,
  projectDir,
  removeBinDirs,
  STAGE,
  stageBuild,
} from "../../scripts/stage-pfapp";

const TARGETS = ["math", "chess", "crypto", "python"] as const;
const tmp = () => mkdtempSync(join(tmpdir(), "stage-pfapp-"));

/** A build/<t>/ with every required entry, stamped for `t`. */
function fakeBuild(t: string, extra: string[] = []): string {
  const dir = tmp();
  for (const e of BUILD_ENTRIES) {
    if (e.optional) continue;
    if (e.name === ".next" || e.name === "drizzle") {
      mkdirSync(join(dir, e.name), { recursive: true });
      writeFileSync(join(dir, e.name, "x"), e.name);
    } else writeFileSync(join(dir, e.name), e.name);
  }
  writeFileSync(join(dir, ".next", "mathviz-target"), `${t}\n`);
  for (const x of extra) writeFileSync(join(dir, x), x);
  return dir;
}

describe("stage-pfapp", () => {
  test("each target is a pf project: targets/<t>/primeforge.json builds that target into dist/pfapp", () => {
    for (const t of TARGETS) {
      const p = JSON.parse(readFileSync(join(projectDir(t), "primeforge.json"), "utf8"));
      expect(p).toEqual({
        kind: "app",
        stage: STAGE,
        build: ["bun", "../../scripts/stage-pfapp.ts", "--target", t],
        lockfile: `${STAGE}/bun.lock`,
      });
      // no package.json in the project: pf's versions gate then compares the manifest with the
      // stage's package.json, which build-local sets to the target's version
      expect(existsSync(join(projectDir(t), "package.json"))).toBe(false);
    }
  });

  test("the production install is the desktop's, flag for flag", () => {
    expect(PRODUCTION_INSTALL.join(" ")).toBe(
      "install --production --omit=optional --frozen-lockfile --ignore-scripts --linker hoisted",
    );
  });

  test("copyTree copies bytes and permission bits, following links", () => {
    const src = tmp();
    mkdirSync(join(src, "a", "b"), { recursive: true });
    writeFileSync(join(src, "a", "b", "f.txt"), "hello");
    writeFileSync(join(src, "run.sh"), "#!/bin/sh\n");
    chmodSync(join(src, "run.sh"), 0o755);
    symlinkSync(join(src, "a", "b", "f.txt"), join(src, "link"));
    const dst = join(tmp(), "out");
    copyTree(src, dst);
    expect(readFileSync(join(dst, "a", "b", "f.txt"), "utf8")).toBe("hello");
    expect(statSync(join(dst, "run.sh")).mode & 0o777).toBe(0o755);
    expect(readFileSync(join(dst, "link"), "utf8")).toBe("hello");
    expect(statSync(join(dst, "link")).isFile()).toBe(true);
  });

  test("clearStage removes the old stage (moved aside first) and tolerates none", () => {
    const dir = join(tmp(), "dist");
    mkdirSync(join(dir, "node_modules", "x"), { recursive: true });
    writeFileSync(join(dir, "node_modules", "x", "i.js"), "");
    clearStage(dir);
    expect(existsSync(dir)).toBe(false);
    clearStage(dir);
  });

  test("stageBuild copies BUILD_ENTRIES and refuses another shape or target", () => {
    const stage = join(tmp(), "dist");
    stageBuild(fakeBuild("math"), stage, "math");
    expect(readFileSync(join(stage, ".next", "mathviz-target"), "utf8")).toBe("math\n");
    expect(readFileSync(join(stage, "icon.svg"), "utf8")).toBe("icon.svg");

    expect(() => stageBuild(fakeBuild("math", ["node_modules"]), stage, "math")).toThrow(
      "holds entries the package does not carry: node_modules",
    );
    expect(() => stageBuild(fakeBuild("chess"), stage, "math")).toThrow(
      'stamped "chess", not "math"',
    );
    const noIcon = fakeBuild("math");
    rmSync(join(noIcon, "icon.svg"));
    expect(() => stageBuild(noIcon, stage, "math")).toThrow("is missing icon.svg");
  });

  test("checkStage holds the stage to the target's manifest, version and bun.lock", () => {
    const pfapp = tmp();
    mkdirSync(join(pfapp, "targets", "math"), { recursive: true });
    const manifest = '{"id":"app.primeforge.mathviz.math","version":"1.0.3"}\n';
    writeFileSync(join(pfapp, "targets", "math", "manifest.json"), manifest);
    writeFileSync(join(pfapp, "bun.lock"), "lock");
    const stage = tmp();
    writeFileSync(join(stage, "manifest.json"), manifest);
    writeFileSync(join(stage, "package.json"), '{"version":"1.0.3"}');
    writeFileSync(join(stage, "bun.lock"), "lock");
    checkStage(stage, "math", pfapp);

    writeFileSync(join(stage, "package.json"), '{"version":"1.0.0"}');
    writeFileSync(join(stage, "bun.lock"), "other");
    writeFileSync(join(stage, "manifest.json"), manifest.replace("1.0.3", "1.0.2"));
    let message = "";
    try {
      checkStage(stage, "math", pfapp);
    } catch (e) {
      message = (e as Error).message;
    }
    expect(message).toContain("differs from targets/math/manifest.json");
    expect(message).toContain("package.json says 1.0.0, the manifest 1.0.3");
    expect(message).toContain("bun.lock differs");
  });

  test("every committed target meets the desktop's packaging rules", () => {
    for (const t of TARGETS) expect(packagingProblems(t)).toEqual([]);
  });

  test("packagingProblems names a missing window, platforms and a native driver", () => {
    const pfapp = tmp();
    mkdirSync(join(pfapp, "targets", "math"), { recursive: true });
    mkdirSync(join(pfapp, "app"));
    writeFileSync(join(pfapp, "targets", "math", "manifest.json"), '{"platforms":["darwin"]}');
    writeFileSync(join(pfapp, "package.json"), '{"dependencies":{"better-sqlite3":"1"}}');
    expect(packagingProblems("math", pfapp)).toEqual([
      "targets/math/manifest.json declares no ui.window",
      "targets/math/manifest.json declares platforms",
      "no app/next.config.mjs",
      "better-sqlite3 in the production dependencies",
    ]);
  });

  test("removeBinDirs removes .bin only under node_modules", () => {
    const dir = tmp();
    mkdirSync(join(dir, "node_modules", ".bin"), { recursive: true });
    mkdirSync(join(dir, "node_modules", "a", "node_modules", ".bin"), { recursive: true });
    mkdirSync(join(dir, ".bin"));
    expect(removeBinDirs(dir)).toBe(2);
    expect(existsSync(join(dir, ".bin"))).toBe(true);
  });

  test("children never see a signing seed", () => {
    expect(
      childEnv({
        PATH: "/bin",
        PRIMEFORGE_SIGNING_KEY: "a",
        PRIMEFORGE_DEVELOPER_KEY: "b",
        X: undefined,
      }),
    ).toEqual({ PATH: "/bin" });
  });
});
