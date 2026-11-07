import { redirect } from "next/navigation";
import { ToolFrame } from "@/components/tool-frame";
import { isLocale, MESSAGES } from "@/lib/i18n/locale";
import { getAppContext } from "@/lib/server/context";

/**
 * `/<locale>/tool/<id>` (design §7.3): the shell around a same-origin iframe of
 * `/c/<content version>/tools/<file>?lang=<locale>`. The python target passes `&prog=<id>` on
 * when this URL has `?prog=` (the program deep link).
 */
export const dynamic = "force-dynamic";

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
  const prog = (await props.searchParams).prog;
  if (app.target.id === "python" && typeof prog === "string" && prog) q.set("prog", prog);
  const src = `/c/${encodeURIComponent(content.version)}/tools/${encodeURIComponent(name)}?${q}`;
  return <ToolFrame src={src} title={locale === "zh" ? item.title_zh : item.title_en} />;
}
