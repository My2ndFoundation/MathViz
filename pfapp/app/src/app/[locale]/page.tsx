import { redirect } from "next/navigation";
import { isLocale } from "@/lib/i18n/locale";
import { firstToolId } from "@/lib/server/catalog";
import { getAppContext } from "@/lib/server/context";

/** `/<locale>`: the first tool of the catalog, or the empty state when there is no content pack. */
export const dynamic = "force-dynamic";

export default async function LocaleHome(props: PageProps<"/[locale]">) {
  const { locale } = await props.params;
  if (!isLocale(locale)) redirect("/");
  const app = await getAppContext();
  // the same test as the empty page's (catalog rows, not just a pack), so the two cannot loop
  const first = app.content ? firstToolId(app.db) : null;
  if (!first) redirect(`/${locale}/empty`);
  redirect(`/${locale}/tool/${encodeURIComponent(first)}`);
}
