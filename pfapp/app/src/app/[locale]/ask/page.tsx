import { redirect } from "next/navigation";
import { LibraryAsk } from "@/components/qa/library-ask";
import { isLocale } from "@/lib/i18n/locale";

/** `/<locale>/ask` (design §7.5): ask the whole library. */
export const dynamic = "force-dynamic";

export default async function AskPage(props: PageProps<"/[locale]/ask">) {
  const { locale } = await props.params;
  if (!isLocale(locale)) redirect("/");
  return (
    <div className="qa-scroll">
      <LibraryAsk locale={locale} />
    </div>
  );
}
