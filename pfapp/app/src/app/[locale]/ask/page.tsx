import { redirect } from "next/navigation";
import { LibraryAsk } from "@/components/qa/library-ask";
import { isLocale } from "@/lib/i18n/locale";
import { getAppContext } from "@/lib/server/context";

/** `/<locale>/ask[?thread=<id>]` (design §7.5): ask the whole library, or continue a library conversation. */
export const dynamic = "force-dynamic";

export default async function AskPage(props: PageProps<"/[locale]/ask">) {
  const { locale } = await props.params;
  if (!isLocale(locale)) redirect("/");
  const { target } = await getAppContext();
  return (
    <div className="qa-scroll">
      {/* no Suspense: the page is dynamic, so useSearchParams renders on the server as it is */}
      <LibraryAsk
        locale={locale}
        programs={target.subjectTypes.includes("program")}
        example={target.libraryExample[locale]}
      />
    </div>
  );
}
