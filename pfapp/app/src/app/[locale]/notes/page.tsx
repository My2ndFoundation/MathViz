import { redirect } from "next/navigation";
import { NotesView } from "@/components/qa/notes-view";
import { isLocale } from "@/lib/i18n/locale";
import { loadCatalog } from "@/lib/server/catalog";
import { getAppContext } from "@/lib/server/context";

/**
 * `/<locale>/notes?thread=<id>` (design §7.4): the conversations with saved answers, one open
 * beside the list; the filter chips are the catalog's groups (the sidebar's, never hard-coded).
 */
export const dynamic = "force-dynamic";

export default async function NotesPage(props: PageProps<"/[locale]/notes">) {
  const { locale } = await props.params;
  if (!isLocale(locale)) redirect("/");
  const app = await getAppContext();
  const groups = loadCatalog(app.db).map((g) => ({ id: g.id, label: g.label }));
  return (
    // no Suspense: the page is dynamic, so useSearchParams renders on the server as it is
    <NotesView locale={locale} groups={groups} />
  );
}
