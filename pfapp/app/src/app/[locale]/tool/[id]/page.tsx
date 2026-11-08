import { readFileSync } from "node:fs";
import path from "node:path";
import { redirect } from "next/navigation";
import { ToolFrame } from "@/components/tool-frame";
import { isLocale, MESSAGES } from "@/lib/i18n/locale";
import { getAppContext } from "@/lib/server/context";

/**
 * `/<locale>/tool/<id>` (design §7.3): the shell around a same-origin iframe of
 * `/c/<content version>/tools/<file>?lang=<locale>`. The python target passes `&prog=<id>` on
 * when this URL has `?prog=` (the program deep link). `?thread=` is the ask panel's: the
 * conversation it opens (Notes' "Open the exercise", the AI queue's links).
 */
export const dynamic = "force-dynamic";

type Bilingual = { en: string; zh: string };

/** A catalog item's kicker (catalog.json; the database keeps titles only), for the recording overlay. */
function kickerOf(dir: string, id: string): Bilingual | null {
  try {
    const cat = JSON.parse(readFileSync(path.join(dir, "catalog.json"), "utf8")) as {
      items?: { id?: unknown; kicker?: Partial<Bilingual> }[];
    };
    const k = cat.items?.find((it) => it.id === id)?.kicker;
    return k && typeof k.en === "string" && typeof k.zh === "string"
      ? { en: k.en, zh: k.zh }
      : null;
  } catch {
    return null;
  }
}

export default async function ToolPage(props: PageProps<"/[locale]/tool/[id]">) {
  const { locale, id } = await props.params;
  if (!isLocale(locale)) redirect("/");
  const app = await getAppContext();
  const content = app.content;
  if (!content) redirect(`/${locale}/empty`);
  const item = app.db
    .prepare("SELECT file, title_en, title_zh FROM catalog_items WHERE id = ?")
    .get<{ file: string; title_en: string; title_zh: string }>(id);
  if (!item) {
    return (
      <p className="p-8 text-sm text-ui-slate" data-testid="tool-not-found">
        {MESSAGES[locale].tool.notFound}
      </p>
    );
  }
  const name = item.file.replace(/^tools\//, "");
  const q = new URLSearchParams({ lang: locale });
  const search = await props.searchParams;
  const prog = search.prog;
  const thread = typeof search.thread === "string" && search.thread ? search.thread : null;
  if (app.target.id === "python" && typeof prog === "string" && prog) q.set("prog", prog);
  const src = `/c/${encodeURIComponent(content.version)}/tools/${encodeURIComponent(name)}?${q}`;
  return (
    <ToolFrame
      key={src}
      toolId={id}
      src={src}
      title={locale === "zh" ? item.title_zh : item.title_en}
      locale={locale}
      python={app.target.id === "python"}
      thread={thread}
      recorder={
        app.target.id === "math"
          ? { title: { en: item.title_en, zh: item.title_zh }, kicker: kickerOf(content.dir, id) }
          : null
      }
    />
  );
}
