import { describe, expect, test } from "bun:test";
import { createHash } from "node:crypto";
import { existsSync, mkdirSync, mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { gzipSync } from "node:zlib";
import {
  addonJsonText,
  addonManifestFor,
  addonStageDir,
  type ContentRelease,
  contentProjectDir,
  decideVersion,
  diffFiles,
  digestOf,
  nextVersion,
  packageFileName,
  parseArgs,
  readPackedAddon,
  readReleases,
  readTar,
  readTree,
  recordPublished,
  releasesPath,
  STAGE,
  sameAddon,
  TARGETS,
  writeReleases,
  writeStage,
} from "../../scripts/stage-addon";

const tmp = () => mkdtempSync(join(tmpdir(), "stage-addon-"));
const sha256 = (b: Buffer | string) => createHash("sha256").update(b).digest("hex");

/** A payload as the extractor writes it: content files plus a provenance.json that agrees. */
function payload(
  target: string,
  content: Record<string, string>,
  o: { sha?: string; clean?: boolean } = {},
): Map<string, Buffer> {
  const files = new Map<string, Buffer>();
  for (const [p, s] of Object.entries(content)) files.set(p, Buffer.from(s));
  const hashes = [...files.keys()]
    .sort()
    .map((p) => ({ path: p, sha256: sha256(files.get(p) as Buffer) }));
  const fingerprint = sha256(hashes.map((f) => `${f.sha256}  ${f.path}\n`).join(""));
  const prov = {
    target,
    sha: o.sha ?? "a".repeat(40),
    clean: o.clean ?? true,
    extractor: "1.0.0",
    fingerprint,
    files: hashes,
  };
  files.set("provenance.json", Buffer.from(`${JSON.stringify(prov, null, 2)}\n`));
  return files;
}

/** pf's ustar subset, enough for a test package: regular files and directories, name ≤ 100. */
function tar(entries: { path: string; data?: Buffer }[]): Buffer {
  const blocks: Buffer[] = [];
  for (const e of entries) {
    const h = Buffer.alloc(512);
    h.write(e.data ? e.path : `${e.path}/`, 0, 100, "utf8");
    h.write("0000644\0", 100, 8, "latin1");
    h.write(`${(e.data?.length ?? 0).toString(8).padStart(11, "0")}\0`, 124, 12, "latin1");
    h.write(e.data ? "0" : "5", 156, 1, "latin1");
    h.write("ustar\0", 257, 6, "latin1");
    blocks.push(h);
    if (e.data && e.data.length > 0) {
      const pad = Buffer.alloc(Math.ceil(e.data.length / 512) * 512);
      e.data.copy(pad);
      blocks.push(pad);
    }
  }
  blocks.push(Buffer.alloc(1024));
  return Buffer.concat(blocks);
}

/** A `.pfaddon` (+ a `.sig` beside it) holding addon.json and `files` under payload/. */
function pfaddon(dir: string, addon: object, files: Map<string, Buffer>, sig = true): string {
  const entries: { path: string; data?: Buffer }[] = [
    { path: "addon.json", data: Buffer.from(`${JSON.stringify(addon, null, 2)}\n`) },
    { path: "payload" },
  ];
  for (const p of [...files.keys()].sort())
    entries.push({ path: `payload/${p}`, data: files.get(p) });
  const file = join(dir, packageFileName((addon as { version: string }).version));
  writeFileSync(file, gzipSync(tar(entries)));
  if (sig) writeFileSync(`${file}.sig`, "sig");
  return file;
}

const addonFor = (t: string, version: string, unpackedBytes = 1) =>
  addonManifestFor({
    appId: `app.primeforge.mathviz.${t}`,
    appName: `Viz ${t}`,
    version,
    minAppVersion: "1.0.1",
    unpackedBytes,
  });

describe("stage-addon", () => {
  // pf dev rebuilds when the content's sources change; they live outside content/<t>/. Math's
  // pages include files at the checkout's root (index.html, tools.json), so it watches all of it.
  const CONTENT_WATCH: Record<string, string[]> = {
    chess: ["../../../chess", "../../extract"],
    crypto: ["../../../cryptography", "../../extract"],
    python: ["../../../python", "../../extract"],
    math: ["../../.."],
  };
  test("each target's content pack is a pf add-on project: content/<t>/primeforge.json", () => {
    for (const t of TARGETS) {
      const p = JSON.parse(readFileSync(join(contentProjectDir(t), "primeforge.json"), "utf8"));
      expect(p).toEqual({
        kind: "addon",
        stage: STAGE,
        build: ["bun", "../../scripts/stage-addon.ts", "--target", t],
        watch: CONTENT_WATCH[t],
      });
      expect(existsSync(join(contentProjectDir(t), "package.json"))).toBe(false);
      expect(addonStageDir(t)).toBe(join(contentProjectDir(t), "dist", "addon"));
    }
  });

  test("the committed release record is well formed, self-consistent, and in its own format", () => {
    const file = releasesPath({});
    const releases = readReleases(file);
    expect(Object.keys(releases).sort()).toEqual([...TARGETS].sort());
    for (const t of TARGETS) {
      const r = releases[t] as ContentRelease;
      expect(r.version).toMatch(/^\d+\.\d+\.\d+$/);
      expect(r.sha).toMatch(/^[0-9a-f]{40}$/);
      expect(r.fingerprint).toBe(sha256(r.files.map((f) => `${f.sha256}  ${f.path}\n`).join("")));
    }
    // writeReleases re-emits it byte for byte: a record moved by record:addon is a one-entry diff
    const copy = join(tmp(), "r.json");
    writeReleases(copy, releases);
    expect(readFileSync(copy).equals(readFileSync(file))).toBe(true);
  });

  test("the version: unchanged content keeps its release's version, a change is a patch above", () => {
    expect(nextVersion(undefined)).toBe("1.0.0");
    expect(nextVersion("1.2.9")).toBe("1.2.10");
    expect(() => nextVersion("1.0")).toThrow("MAJOR.MINOR.PATCH");
    const last: ContentRelease = {
      version: "1.0.3",
      fingerprint: "f".repeat(64),
      sha: "s",
      files: [],
    };
    expect(decideVersion(undefined, "x")).toEqual({ unchanged: false, version: "1.0.0" });
    expect(decideVersion(last, "f".repeat(64))).toEqual({ unchanged: true, version: "1.0.3" });
    expect(decideVersion(last, "e".repeat(64))).toEqual({ unchanged: false, version: "1.0.4" });
  });

  test("addon.json has the desktop's fields in the desktop's order", () => {
    const a = addonFor("chess", "1.0.1", 1234);
    expect(addonJsonText(a)).toBe(
      `${JSON.stringify(
        {
          format: 1,
          id: "app.primeforge.mathviz.chess/content",
          appId: "app.primeforge.mathviz.chess",
          version: "1.0.1",
          kind: "content",
          title: "Viz chess content",
          minAppVersion: "1.0.1",
          unpackedBytes: 1234,
        },
        null,
        2,
      )}\n`,
    );
  });

  test("an already-built package is the same pack whatever its unpackedBytes, not otherwise", () => {
    const a = addonFor("math", "1.0.1", 100);
    expect(sameAddon(a, addonFor("math", "1.0.1", 101))).toBe(true);
    expect(sameAddon(a, addonFor("math", "1.0.2", 100))).toBe(false);
    expect(sameAddon(a, { ...a, minAppVersion: "1.0.4" })).toBe(false);
    expect(sameAddon(a, { ...a, title: "x" })).toBe(false);
  });

  test("the digest is recomputed from the files and held to provenance.json", () => {
    const files = payload("math", { "catalog.json": "{}", "tools/a.html": "<p>a</p>" });
    const d = digestOf(files, "p");
    expect(d.files.map((f) => f.path)).toEqual(["catalog.json", "tools/a.html"]);
    expect(d.bytes).toBe([...files.values()].reduce((n, b) => n + b.length, 0));
    files.set("tools/a.html", Buffer.from("<p>changed</p>"));
    expect(() => digestOf(files, "p")).toThrow("changed after extraction");
    files.delete("provenance.json");
    expect(() => digestOf(files, "p")).toThrow("no provenance.json");
  });

  test("diffFiles names what was added, removed and changed", () => {
    const before = [
      { path: "a", sha256: "1" },
      { path: "b", sha256: "2" },
    ];
    const after = [
      { path: "b", sha256: "3" },
      { path: "c", sha256: "4" },
    ];
    expect(diffFiles(before, after)).toEqual(["  - a", "  ~ b", "  + c"]);
  });

  test("a package is read back from its own bytes; anything outside addon.json + payload/ is refused", () => {
    const dir = tmp();
    const files = payload("crypto", { "catalog.json": "{}" });
    const file = pfaddon(dir, addonFor("crypto", "1.0.1"), files);
    const r = readPackedAddon(file);
    expect(r.manifest.id).toBe("app.primeforge.mathviz.crypto/content");
    expect([...r.payload.keys()].sort()).toEqual(["catalog.json", "provenance.json"]);
    expect(r.digest.fingerprint).toBe(digestOf(files, "x").fingerprint);
    const odd = join(dir, "odd.pfaddon");
    writeFileSync(
      odd,
      gzipSync(
        tar([
          { path: "addon.json", data: Buffer.from("{}") },
          { path: "x", data: Buffer.from("x") },
        ]),
      ),
    );
    expect(() => readPackedAddon(odd)).toThrow("outside payload/");
    const link = Buffer.from(tar([{ path: "l", data: Buffer.from("") }]));
    link[156] = "2".charCodeAt(0);
    expect(() => readTar(link)).toThrow("type");
  });

  test("record:addon: from the signed package, the next version only, idempotent, refusals write nothing", () => {
    const dir = tmp();
    const rec = join(dir, "releases.json");
    const first: ContentRelease = {
      version: "1.0.0",
      fingerprint: "0".repeat(64),
      sha: "s",
      files: [],
    };
    writeReleases(rec, { math: first });
    const before = readFileSync(rec, "utf8");

    const files = payload("math", { "catalog.json": '{"v":2}' }, { sha: "b".repeat(40) });
    const ok = pfaddon(dir, addonFor("math", "1.0.1"), files);
    const r = recordPublished(ok, rec);
    expect(r.already).toBe(false);
    expect(r.entry).toEqual({
      version: "1.0.1",
      fingerprint: digestOf(files, "x").fingerprint,
      sha: "b".repeat(40),
      minAppVersion: "1.0.1",
      files: digestOf(files, "x").files,
    });
    const after = readFileSync(rec, "utf8");
    expect(after).not.toBe(before);
    expect(recordPublished(ok, rec).already).toBe(true);
    expect(readFileSync(rec, "utf8")).toBe(after);

    const refuse = (file: string, msg: string) => {
      const was = readFileSync(rec, "utf8");
      expect(() => recordPublished(file, rec)).toThrow(msg);
      expect(readFileSync(rec, "utf8")).toBe(was);
    };
    const d2 = tmp();
    // the same version with other bytes
    refuse(
      pfaddon(d2, addonFor("math", "1.0.1"), payload("math", { "catalog.json": "{}" })),
      "is recorded with fingerprint",
    );
    // not the next version
    refuse(
      pfaddon(tmp(), addonFor("math", "1.0.3"), payload("math", { "catalog.json": "{}" })),
      "so the next is 1.0.2",
    );
    // extracted from a dirty checkout
    refuse(
      pfaddon(tmp(), addonFor("math", "1.0.2"), payload("math", { a: "a" }, { clean: false })),
      "clean false",
    );
    // provenance for another target
    refuse(pfaddon(tmp(), addonFor("math", "1.0.2"), payload("chess", { a: "a" })), "target chess");
    // no signature beside it
    refuse(pfaddon(tmp(), addonFor("math", "1.0.2"), payload("math", { a: "a" }), false), ".sig");
    // a first release of another target is 1.0.0
    const c = recordPublished(
      pfaddon(tmp(), addonFor("chess", "1.0.0"), payload("chess", { a: "a" })),
      rec,
    );
    expect(c.entry.version).toBe("1.0.0");
    expect(Object.keys(readReleases(rec))).toEqual(["chess", "math"]);
  });

  test("writeStage writes addon.json + payload/ by bytes, from a directory or from a package", () => {
    const files = payload("python", { "catalog.json": "{}", "source/p.json": "[]" });
    const src = tmp();
    for (const [p, b] of files) {
      mkdirSync(join(src, p, ".."), { recursive: true });
      writeFileSync(join(src, p), b);
    }
    const stage = join(tmp(), "dist", "addon");
    mkdirSync(stage, { recursive: true });
    writeFileSync(join(stage, "stale"), "x");
    writeStage(stage, "A", src);
    expect(existsSync(join(stage, "stale"))).toBe(false);
    expect(readFileSync(join(stage, "addon.json"), "utf8")).toBe("A");
    expect(readTree(join(stage, "payload"))).toEqual(files);
    writeStage(stage, Buffer.from("B"), files);
    expect(readTree(join(stage, "payload"))).toEqual(files);
  });

  test("arguments: one target, --release or --status, nothing else", () => {
    expect(parseArgs(["--target", "math"])).toEqual({
      target: "math",
      release: false,
      status: false,
    });
    expect(parseArgs(["--target", "chess", "--release"]).release).toBe(true);
    expect(() => parseArgs(["--target", "math", "--release", "--status"])).toThrow("usage");
    expect(() => parseArgs(["--target", "math", "--force"])).toThrow("usage");
  });
});
