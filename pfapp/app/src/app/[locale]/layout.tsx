import "../globals.css";
import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { Shell } from "@/components/sidebar";
import { isLocale, MESSAGES } from "@/lib/i18n/locale";
import { loadCatalog } from "@/lib/server/catalog";
import { getAppContext } from "@/lib/server/context";

/**
 * The root layout, under the locale segment: the URL's locale is what every page renders in
 * (controller ruling, task 8). `/` picks it from settings.lang (app/route.ts). With a content pack
 * the pages render inside the shell (sidebar + stage); without one, bare (the empty state).
 */
export const dynamic = "force-dynamic";

export async function generateMetadata(props: LayoutProps<"/[locale]">): Promise<Metadata> {
  const { locale } = await props.params;
  const app = await getAppContext();
  return { title: app.target.name[isLocale(locale) ? locale : app.target.defaultLang] };
}

export default async function LocaleLayout(props: LayoutProps<"/[locale]">) {
  const { locale } = await props.params;
  // an unknown locale (or any other first segment): start over from the stored language
  if (!isLocale(locale)) redirect("/");
  const app = await getAppContext();
  const t = MESSAGES[locale];
  const content = app.content;
  // the shell needs tools to list; a pack without catalog rows renders bare, like no pack
  const groups = content ? loadCatalog(app.db) : [];
  return (
    <html lang={locale === "zh" ? "zh-CN" : "en"}>
      <body>
        {content && groups.length ? (
          <Shell
            groups={groups}
            locale={locale}
            appName={{ eyebrow: "MathViz", name: app.target.name[locale] }}
            text={{
              search: t.nav.search,
              searchPlaceholder: t.nav.searchPlaceholder,
              noResults: t.nav.noResults,
              close: t.nav.close,
              collapse: t.nav.collapse,
              expand: t.nav.expand,
              switchTo: t.nav.switchTo,
              switchToLabel: t.nav.switchToLabel,
              contentVersion: t.content.version.replace("{version}", content.version),
            }}
          >
            {props.children}
          </Shell>
        ) : (
          <main className="stage overflow-y-auto">{props.children}</main>
        )}
      </body>
    </html>
  );
}
