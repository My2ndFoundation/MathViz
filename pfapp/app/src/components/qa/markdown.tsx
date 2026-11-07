import { renderMarkdown } from "@/lib/render/markdown";

/** An answer's Markdown through lib/render/markdown (raw HTML escaped; links stay in the app). */
export function Markdown({ source }: { source: string }) {
  // biome-ignore lint/security/noDangerouslySetInnerHtml: renderMarkdown escapes raw HTML (markdown-it html: false)
  return <div className="qa-md" dangerouslySetInnerHTML={{ __html: renderMarkdown(source) }} />;
}
