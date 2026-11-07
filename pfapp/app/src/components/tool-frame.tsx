/**
 * The tool view (design §7.3): the web version's page, as it is, in a same-origin iframe of
 * /c/<content version>/tools/<file>. Keyed by src, so a new language or program is a fresh load.
 */
export function ToolFrame({ src, title }: { src: string; title: string }) {
  return (
    <iframe key={src} className="tool-frame" data-testid="tool-frame" src={src} title={title} />
  );
}
