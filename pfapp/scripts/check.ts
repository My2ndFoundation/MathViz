/**
 * bun run check:content [--mathviz <path>] [--payload <dir>]
 *
 * pfapp's content gate (design §9). The web version is the only content source; this checks that
 * what the extractor packs for each target is exactly that source, in the same tree:
 *
 *   提取一致   every payload file is accounted for: one tools/ page per registry entry, byte-identical
 *              to the web page; catalog items match the registry entry for entry; python sources
 *              are the .py text verbatim; provenance lists every file with its hash; nothing extra.
 *   组标签一致 catalog groups / item labels equal the labels on the web navigation page.
 *   提取确定   two fresh extractions of the same tree are byte-identical.
 *   无 .html   no tracked .html under pfapp/ (design §3).
 *
 * It never compares against a previously published pack: a legitimate web change must not turn
 * this red (that comparison belongs to PFD's build script). Counts are always derived from the
 * registries, never written here — adding a web page must not turn this red either.
 *
 * Runs with requireClean:false: the pre-commit hook calls it mid-commit, on the working tree.
 * `--payload <dir>` verifies existing extractions in `<dir>/<target>/payload/` instead of making
 * fresh ones (used by the negative controls to show a stale pack goes red).
 */
import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import { existsSync, mkdtempSync, readdirSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { basename, dirname, join, resolve } from "node:path";
import { isDeepStrictEqual } from "node:util";
import { loadTarget, type Target, type TargetId } from "../app/src/lib/target";
import { extract, readGroupLabels } from "../extract/index";

const IDS: TargetId[] = ["math", "chess", "crypto", "python"];
// Restated on purpose, independent of extract/catalog.ts: tools.json calls the group `category`.
const REG_FIELD: Record<TargetId, string> = {
  math: "category",
  chess: "phase",
  crypto: "chapter",
  python: "module",
};
const NAV_PAGE: Record<TargetId, string> = {
  math: "index.html",
  chess: "chess/app.html",
  crypto: "cryptography/app.html",
  python: "python/app.html",
};

const sha256 = (b: Buffer | string) => createHash("sha256").update(b).digest("hex");

function walk(root: string, rel = ""): string[] {
  const out: string[] = [];
  for (const e of readdirSync(join(root, rel), { withFileTypes: true })) {
    const p = rel ? `${rel}/${e.name}` : e.name;
    if (e.isDirectory()) out.push(...walk(root, p));
    else out.push(p);
  }
  return out.sort();
}

let failed = 0;
function report(name: string, problems: string[], okDetail: string) {
  if (problems.length === 0) {
    console.log(`  ok    ${name}（${okDetail}）`);
    return;
  }
  failed++;
  console.log(`  FAIL  ${name}`);
  for (const p of problems.slice(0, 20)) console.log(`        - ${p}`);
  if (problems.length > 20) console.log(`        … 另有 ${problems.length - 20} 条`);
}

type Entry = Record<string, unknown>;
const registryOf = (t: Target, mv: string): Entry[] => {
  const reg = JSON.parse(readFileSync(join(mv, t.registry), "utf8")) as { tools?: Entry[] };
  return Array.isArray(reg.tools) ? reg.tools : [];
};

/** Registry entries whose page is missing — asserted before extracting, so it reads as a finding. */
function missingPages(t: Target, mv: string): string[] {
  const regDir = dirname(join(mv, t.registry));
  return registryOf(t, mv)
    .filter((e) => typeof e.file !== "string" || !existsSync(join(regDir, e.file)))
    .map((e) => `注册表条目 ${String(e.id)} 指向的页面不存在：${String(e.file)}`);
}

/** Expected `source/<id>.json` → absolute .py path, for chapters whose tool is registered. */
function pythonSources(mv: string, reg: Entry[]): Map<string, string> {
  const tools = new Set(reg.map((e) => e.id));
  const root = join(mv, "python/programs");
  const out = new Map<string, string>();
  for (const ch of readdirSync(root).filter((d) => d.startsWith("ch"))) {
    const c = JSON.parse(readFileSync(join(root, ch, "chapter.json"), "utf8")) as {
      tool: string;
      programs: { id: string; file: string }[];
    };
    if (!tools.has(c.tool)) continue;
    for (const p of c.programs) out.set(`source/${p.id}.json`, join(root, ch, p.file));
  }
  return out;
}

interface CatItem {
  id: string;
  file: string;
  group: string;
  groupLabel: unknown;
  order: number;
  accent: unknown;
  version: unknown;
  title: unknown;
}
interface Cat {
  target: string;
  items: CatItem[];
  groups: { id: string; label: unknown }[];
}

/** 提取一致: the payload vs. the web sources in `mv`. */
function verifyPayload(t: Target, mv: string, payload: string): string[] {
  const bad: string[] = [];
  const reg = registryOf(t, mv);
  const regDir = dirname(join(mv, t.registry));
  if (!existsSync(join(payload, "catalog.json"))) return [`${payload} 里没有 catalog.json`];
  const cat = JSON.parse(readFileSync(join(payload, "catalog.json"), "utf8")) as Cat;

  // Catalog ↔ registry, entry for entry.
  if (cat.target !== t.id) bad.push(`catalog.target = ${cat.target}，应为 ${t.id}`);
  if (cat.items.length !== reg.length) {
    bad.push(`catalog 条数 ${cat.items.length} ≠ 注册表 ${t.registry} 条数 ${reg.length}`);
  }
  const regIds = new Set(reg.map((e) => e.id));
  const catIds = new Set(cat.items.map((i) => i.id));
  for (const e of reg)
    if (!catIds.has(e.id as string)) bad.push(`注册表有、catalog 没有：${String(e.id)}`);
  for (const i of cat.items) if (!regIds.has(i.id)) bad.push(`catalog 有、注册表没有：${i.id}`);
  for (const [n, e] of reg.entries()) {
    const i = cat.items[n];
    if (!i || i.id !== e.id) continue; // order / membership already reported above
    const want = {
      file: `tools/${basename(e.file as string)}`,
      group: String(e[REG_FIELD[t.id]]),
      order: n,
      accent: e.accent,
      version: e.version,
      title: e.title,
    };
    const got = {
      file: i.file,
      group: i.group,
      order: i.order,
      accent: i.accent,
      version: i.version,
      title: i.title,
    };
    if (!isDeepStrictEqual(got, want)) bad.push(`catalog 条目 ${i.id} 与注册表不一致`);
  }
  if (bad.length === 0) {
    const order = cat.items.map((i) => i.id).join("\n");
    if (order !== reg.map((e) => e.id).join("\n")) bad.push("catalog 顺序与注册表不同");
  }

  // Expected payload file set → source bytes (null: generated, checked separately).
  const expected = new Map<string, string | null>([
    ["catalog.json", null],
    ["provenance.json", null],
  ]);
  for (const e of reg) {
    if (typeof e.file === "string") expected.set(`tools/${basename(e.file)}`, join(regDir, e.file));
  }
  const py = t.id === "python" ? pythonSources(mv, reg) : new Map<string, string>();
  for (const k of py.keys()) expected.set(k, null);

  const actual = walk(payload);
  for (const f of actual) if (!expected.has(f)) bad.push(`payload 里有注册表之外的文件：${f}`);
  for (const f of expected.keys()) if (!actual.includes(f)) bad.push(`payload 缺文件：${f}`);

  for (const [f, src] of expected) {
    if (!src || !actual.includes(f) || !existsSync(src)) continue;
    if (sha256(readFileSync(join(payload, f))) !== sha256(readFileSync(src))) {
      bad.push(`${f} 与网页版 ${src.slice(mv.length + 1)} 的 sha256 不同`);
    }
  }
  for (const [f, pyPath] of py) {
    if (!actual.includes(f)) continue;
    const obj = JSON.parse(readFileSync(join(payload, f), "utf8")) as { source?: unknown };
    if (!existsSync(pyPath)) bad.push(`${f}：网页版 ${pyPath} 不存在`);
    else if (obj.source !== readFileSync(pyPath, "utf8")) bad.push(`${f} 的 source 不是 .py 原文`);
    if ("run" in obj) bad.push(`${f} 带了 run（预期输出不得离开网页版）`);
  }

  // Provenance lists exactly the other files, with their real hashes, and the fingerprint follows.
  if (actual.includes("provenance.json")) {
    const prov = JSON.parse(readFileSync(join(payload, "provenance.json"), "utf8")) as {
      target?: string;
      fingerprint?: string;
      files?: { path: string; sha256: string }[];
    };
    const real = actual
      .filter((f) => f !== "provenance.json")
      .map((path) => ({ path, sha256: sha256(readFileSync(join(payload, path))) }));
    if (prov.target !== t.id) bad.push(`provenance.target = ${prov.target}`);
    if (!isDeepStrictEqual(prov.files, real)) bad.push("provenance.files 与 payload 实际文件不符");
    const fp = sha256(real.map((f) => `${f.sha256}  ${f.path}\n`).join(""));
    if (prov.fingerprint !== fp) bad.push("provenance.fingerprint 与 payload 实际内容不符");
  }
  return bad;
}

/** 组标签一致: catalog labels vs. the labels on the web navigation page. */
function verifyLabels(t: Target, mv: string, payload: string): string[] {
  const bad: string[] = [];
  const labels = readGroupLabels(t, mv);
  const page = readFileSync(join(mv, NAV_PAGE[t.id]), "utf8");
  // Independent of the slicer: both strings must literally occur on the page.
  for (const [g, l] of Object.entries(labels)) {
    if (!page.includes(l.en) || !page.includes(l.zh))
      bad.push(`组 ${g} 的标签不在 ${NAV_PAGE[t.id]} 原文里`);
  }
  const p = join(payload, "catalog.json");
  if (!existsSync(p)) return [...bad, "没有 catalog.json"];
  const cat = JSON.parse(readFileSync(p, "utf8")) as Cat;
  const used = new Set(registryOf(t, mv).map((e) => String(e[REG_FIELD[t.id]])));
  for (const g of used)
    if (!labels[g]) bad.push(`注册表用到的组 ${g} 在 ${NAV_PAGE[t.id]} 里没有标签`);
  const want = Object.entries(labels)
    .filter(([g]) => used.has(g))
    .map(([id, label]) => ({ id, label }));
  if (!isDeepStrictEqual(cat.groups, want)) {
    bad.push(`catalog.groups 与 ${NAV_PAGE[t.id]} 的组标签不一致`);
  }
  for (const i of cat.items) {
    if (!isDeepStrictEqual(i.groupLabel, labels[i.group])) {
      bad.push(`catalog 条目 ${i.id} 的组标签与 ${NAV_PAGE[t.id]} 不一致`);
    }
  }
  return bad;
}

/** 提取确定: two directories hold byte-identical payloads. */
function sameBytes(a: string, b: string): string[] {
  const fa = walk(a);
  const fb = walk(b);
  if (!isDeepStrictEqual(fa, fb)) return ["两次提取的文件列表不同"];
  return fa
    .filter((f) => sha256(readFileSync(join(a, f))) !== sha256(readFileSync(join(b, f))))
    .map((f) => `两次提取 ${f} 字节不同`);
}

function trackedHtml(mv: string): string[] {
  const out = execFileSync("git", ["-C", mv, "ls-files", "-z", "--", "pfapp"], {
    encoding: "utf8",
  });
  return out.split("\0").filter((f) => /\.html?$/i.test(f));
}

async function main(argv: string[]) {
  const flags: Record<string, string> = {};
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i] as string;
    const v = argv[i + 1];
    if ((a === "--mathviz" || a === "--payload") && v) {
      flags[a.slice(2)] = v;
      i++;
    } else {
      console.error("usage: bun run check:content [--mathviz <path>] [--payload <dir>]");
      process.exit(2);
    }
  }
  const mv = resolve(flags.mathviz ?? join(import.meta.dir, "../.."));
  const given = flags.payload ? resolve(flags.payload) : undefined;
  const tmp = mkdtempSync(join(tmpdir(), "pfapp-check-"));
  const opts = { requireClean: false } as const;
  console.log(`pfapp check:content — ${mv}${given ? `（payload: ${given}）` : ""}`);

  try {
    for (const id of IDS) {
      const t = loadTarget(id);
      const missing = missingPages(t, mv);
      if (missing.length > 0) {
        report(`提取一致 · ${id}`, missing, "");
        continue;
      }
      const a = join(tmp, id, "a");
      const b = join(tmp, id, "b");
      let r: { tools: number; files: string[] };
      try {
        r = await extract(t, mv, a, opts);
        await extract(t, mv, b, opts);
      } catch (e) {
        report(`提取一致 · ${id}`, [`提取器报错：${e instanceof Error ? e.message : e}`], "");
        continue;
      }
      const payload = given ? join(given, id, "payload") : join(a, "payload");
      if (given && !existsSync(payload)) {
        report(`提取一致 · ${id}`, [`${payload} 不存在`], "");
        continue;
      }
      report(
        `提取一致 · ${id}`,
        verifyPayload(t, mv, payload),
        `${registryOf(t, mv).length} 页，${walk(payload).length} 个文件`,
      );
      report(`组标签一致 · ${id}`, verifyLabels(t, mv, payload), `取自 ${NAV_PAGE[id]}`);
      report(
        `提取确定 · ${id}`,
        sameBytes(join(a, "payload"), join(b, "payload")),
        `两次提取 ${r.files.length} 个文件逐字节相同`,
      );
    }
    const html = trackedHtml(mv);
    report(
      "pfapp/ 下无被跟踪的 .html",
      html.map((f) => `被 git 跟踪：${f}`),
      "0 个",
    );
  } finally {
    rmSync(tmp, { recursive: true, force: true });
  }

  if (failed > 0) {
    console.log(`\npfapp check:content：${failed} 项未通过`);
    process.exit(1);
  }
  console.log("\npfapp check:content：全部通过");
}

main(process.argv.slice(2)).catch((e: unknown) => {
  console.error(e instanceof Error ? (e.stack ?? e.message) : e);
  process.exit(1);
});
