import { redirect } from "next/navigation";
import { NotesView } from "@/components/qa/notes-view";
import { isLocale } from "@/lib/i18n/locale";

/** `/<locale>/notes` (design §7.4): saved answers, searchable and deletable. */
export const dynamic = "force-dynamic";

export default async function NotesPage(props: PageProps<"/[locale]/notes">) {
  const { locale } = await props.params;
  if (!isLocale(locale)) redirect("/");
  return (
    <div className="qa-scroll">
      <NotesView locale={locale} />
    </div>
  );
}
