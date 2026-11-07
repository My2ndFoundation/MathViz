import { readFileSync } from "node:fs";
import { basename, dirname, join, posix } from "node:path";
import type { Target } from "../app/src/lib/target";
import { type Bilingual, readGroupLabels } from "./labels";

export interface CatalogItem {
  id: string;
  /** Payload-relative: `tools/<basename>`. */
  file: string;
  group: string;
  groupLabel: Bilingual;
  /** Position in the registry — the order the web version lists its tools in. */
  order: number;
  accent: string;
  version: string;
  title: Bilingual;
  kicker?: Bilingual;
  desc?: Bilingual;
  tag?: Bilingual;
}

export interface Catalog {
  target: string;
  items: CatalogItem[];
  groups: { id: string; label: Bilingual }[];
}

/** A registry entry plus where its tool page sits in the MV checkout. */
export interface RegistryTool {
  entry: Record<string, unknown>;
  /** Absolute path of the tool page. */
  srcPath: string;
  /** Payload-relative path the page is copied to. */
  file: string;
}

/**
 * `Target.groupField` names the field as the web navigation pages call it. The math registry
 * (`tools.json`) calls the same field `category`; `cat` is only the gallery's `TOOLS` mirror.
 * The subproject registries use the same name as their pages.
 */
const REGISTRY_FIELD: Record<Target["groupField"], string> = {
  cat: "category",
  phase: "phase",
  chapter: "chapter",
  module: "module",
};

export function readRegistry(target: Target, mvPath: string): RegistryTool[] {
  const regPath = join(mvPath, target.registry);
  const reg = JSON.parse(readFileSync(regPath, "utf8")) as { tools?: unknown };
  if (!Array.isArray(reg.tools) || reg.tools.length === 0) {
    throw new Error(`${target.registry}: no tools`);
  }
  const toolDir = join(mvPath, target.toolDir);
  const seen = new Set<string>();
  return (reg.tools as Record<string, unknown>[]).map((entry) => {
    const id = entry.id;
    const file = entry.file;
    if (typeof id !== "string" || typeof file !== "string") {
      throw new Error(`${target.registry}: entry without id/file`);
    }
    // Registry `file` is relative to the registry's own directory (root: `outputs/x.html`,
    // subprojects: `tools/x.html`); either way it must land directly in toolDir.
    const srcPath = join(dirname(regPath), file);
    if (dirname(srcPath) !== toolDir || !file.endsWith(".html")) {
      throw new Error(`${target.registry}: ${id} file ${file} is not in ${target.toolDir}`);
    }
    const name = basename(file);
    if (seen.has(name)) throw new Error(`${target.registry}: duplicate file ${name}`);
    seen.add(name);
    return { entry, srcPath, file: posix.join("tools", name) };
  });
}

function opt(v: unknown, where: string): Bilingual | undefined {
  if (v === undefined) return undefined;
  const o = v as { en?: unknown; zh?: unknown };
  if (typeof o?.en !== "string" || typeof o?.zh !== "string") {
    throw new Error(`${where}: expected {en, zh}`);
  }
  return { en: o.en, zh: o.zh };
}

export function buildCatalog(target: Target, mvPath: string, tools: RegistryTool[]): Catalog {
  const labels = readGroupLabels(target, mvPath);
  const field = REGISTRY_FIELD[target.groupField];
  const used = new Set<string>();
  const items = tools.map(({ entry, file }, order): CatalogItem => {
    const id = entry.id as string;
    const raw = entry[field];
    if (typeof raw !== "string" && typeof raw !== "number") {
      throw new Error(`${target.registry}: ${id} has no ${field}`);
    }
    const group = String(raw);
    const groupLabel = labels[group];
    if (!groupLabel) throw new Error(`${target.registry}: ${id} group ${group} has no label`);
    used.add(group);
    if (typeof entry.accent !== "string" || typeof entry.version !== "string") {
      throw new Error(`${target.registry}: ${id} lacks accent/version`);
    }
    const title = opt(entry.title, `${id}.title`);
    if (!title) throw new Error(`${target.registry}: ${id} has no title`);
    // Fixed key order: the payload must be byte-identical across runs.
    const item: CatalogItem = {
      id,
      file,
      group,
      groupLabel,
      order,
      accent: entry.accent,
      version: entry.version,
      title,
    };
    for (const k of ["kicker", "desc", "tag"] as const) {
      const v = opt(entry[k], `${id}.${k}`);
      if (v) item[k] = v;
    }
    return item;
  });
  // Groups in the web page's own order, only those that have tools.
  const groups = Object.entries(labels)
    .filter(([g]) => used.has(g))
    .map(([id, label]) => ({ id, label }));
  return { target: target.id, items, groups };
}
