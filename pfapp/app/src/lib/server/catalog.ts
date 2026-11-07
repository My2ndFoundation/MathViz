import type { ShellGroup } from "../catalog";
import type { Db } from "../db/handle";

export type { ShellGroup, ShellItem } from "../catalog";
export { filterCatalog } from "../catalog";

/**
 * The sidebar's data (design §7.2): catalog_groups in the pack's order, each with its
 * catalog_items in registry order. Pure reads; the server components pass the result to the
 * client sidebar as props.
 */

/** The first tool in registry order; null when the catalog is empty (no pack, or none indexed). */
export function firstToolId(db: Db): string | null {
  return (
    db.prepare("SELECT id FROM catalog_items ORDER BY ord LIMIT 1").get<{ id: string }>()?.id ??
    null
  );
}

interface ItemRow {
  id: string;
  grp: string;
  file: string;
  title_en: string;
  title_zh: string;
  tag_en: string | null;
  tag_zh: string | null;
  version: string;
  accent: string;
}

export function loadCatalog(db: Db): ShellGroup[] {
  const groups = db
    .prepare("SELECT id, label_en, label_zh FROM catalog_groups ORDER BY ord")
    .all<{ id: string; label_en: string; label_zh: string }>();
  const rows = db
    .prepare(
      "SELECT id, grp, file, title_en, title_zh, tag_en, tag_zh, version, accent FROM catalog_items ORDER BY ord",
    )
    .all<ItemRow>();
  const out = groups.map(
    (g): ShellGroup => ({ id: g.id, label: { en: g.label_en, zh: g.label_zh }, items: [] }),
  );
  const byId = new Map(out.map((g) => [g.id, g]));
  for (const r of rows) {
    let g = byId.get(r.grp);
    if (!g) {
      // an item whose group the pack did not list: shown under its id rather than dropped
      g = { id: r.grp, label: { en: r.grp, zh: r.grp }, items: [] };
      byId.set(r.grp, g);
      out.push(g);
    }
    g.items.push({
      id: r.id,
      file: r.file,
      title: { en: r.title_en, zh: r.title_zh },
      tag: r.tag_en !== null && r.tag_zh !== null ? { en: r.tag_en, zh: r.tag_zh } : null,
      version: r.version,
      accent: r.accent,
    });
  }
  return out.filter((g) => g.items.length > 0);
}
