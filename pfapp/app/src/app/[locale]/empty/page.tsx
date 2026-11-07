import { redirect } from "next/navigation";
import { EmptyState } from "@/components/empty-state";
import { isLocale, MESSAGES } from "@/lib/i18n/locale";
import { firstToolId } from "@/lib/server/catalog";
import { getAppContext } from "@/lib/server/context";

/**
 * No content pack. Each visit looks for one again (a store install since the app started, which
 * nothing else would notice); once there is one, `/<locale>` opens its first tool.
 */
export const dynamic = "force-dynamic";

export default async function Empty(props: PageProps<"/[locale]/empty">) {
  const { locale } = await props.params;
  if (!isLocale(locale)) redirect("/");
  const app = await getAppContext();
  // leave only when there is a tool to open — the test `/<locale>` uses — so a pack without
  // catalog rows shows this page instead of bouncing between the two
  const content = app.content ?? (await app.refreshContent());
  if (content && firstToolId(app.db)) redirect(`/${locale}`);
  const t = MESSAGES[locale];
  return (
    <EmptyState
      locale={locale}
      text={{
        none: t.content.none,
        noneBody: t.content.noneBody,
        fromStore: t.content.fromStore,
        fromStoreBody: t.content.fromStoreBody,
        importLocal: t.content.importLocal,
        importing: t.content.importing,
        errors: t.error,
      }}
    />
  );
}
