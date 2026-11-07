import { redirect } from "next/navigation";
import { SettingsView } from "@/components/settings-view";
import { isLocale } from "@/lib/i18n/locale";
import { aiStatus } from "@/lib/server/ai";
import { getAppContext } from "@/lib/server/context";
import { getAiLang } from "@/lib/server/settings";

/**
 * `/<locale>/settings` (after Math Test Buddy's Settings page): General (interface and AI reply
 * language), Content pack (the installed version, the store row, importing a file), AI (whether
 * the tutor can answer). Reachable with or without a content pack (the empty state links here).
 */
export const dynamic = "force-dynamic";

export default async function SettingsPage(props: PageProps<"/[locale]/settings">) {
  const { locale } = await props.params;
  if (!isLocale(locale)) redirect("/");
  const app = await getAppContext();
  const content = app.content;
  return (
    <div className="qa-scroll">
      <SettingsView
        locale={locale}
        data={{
          aiLang: getAiLang(app.db),
          content: content ? { version: content.version, source: content.source } : null,
          ai: await aiStatus(app),
        }}
      />
    </div>
  );
}
