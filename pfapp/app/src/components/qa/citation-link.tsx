import Link from "next/link";
import type { Locale } from "@/lib/i18n/locale";
import type { Citation } from "./api";

/**
 * A library item an answer relied on, as a link to its page in this app: `/<locale>/tool/<id>`,
 * or for a python program `/<locale>/tool/<tool>?prog=<program>` (the tool page passes `prog`
 * on to the iframe). In place, never a new window (design §5.3).
 */
export function CitationLink({ citation, locale }: { citation: Citation; locale: Locale }) {
  return (
    <Link
      href={`/${locale}${citation.href}`}
      className="qa-cite"
      data-testid="citation"
      data-id={citation.id}
    >
      {citation.title[locale] || citation.id}
    </Link>
  );
}
