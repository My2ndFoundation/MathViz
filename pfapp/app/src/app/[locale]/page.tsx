import { redirect } from "next/navigation";
import { isLocale } from "@/lib/i18n/locale";
import { getAppContext } from "@/lib/server/context";

/** `/<locale>`: the first tool of the catalog, or the empty state when there is no content pack. */
export const dynamic = "force-dynamic";

export default async function LocaleHome(props: PageProps<"/[locale]">) {
  const { locale } = await props.params;
  if (!isLocale(locale)) redirect("/");
  const app = await getAppContext();
  if (!app.content) redirect(`/${locale}/empty`);
  const first = app.db
    .prepare("SELECT id FROM catalog_items ORDER BY ord LIMIT 1")
    .get<{ id: string }>();
  if (!first) redirect(`/${locale}/empty`);
  redirect(`/${locale}/tool/${encodeURIComponent(first.id)}`);
}
