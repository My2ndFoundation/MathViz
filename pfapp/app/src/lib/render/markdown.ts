// After MathTestBuddy trainer/src/lib/render/markdown.ts (commit c7df343). Kept: markdown-it with
// raw HTML escaped (html: false), no linkify or typographer, images with a scheme or a
// protocol-relative source shown as their alt text. Dropped: KaTeX (phase 1 is python only; the
// maths targets add it in phase 2) and the `kp:` links. Added: links leave the app only as text.
import MarkdownIt from "markdown-it";

/**
 * An AI answer (Markdown) → HTML. Pure, no I/O: the client components render with it.
 *
 * Links: the app runs in PrimeForge Desktop's own window, which hands any other origin (and any
 * target=_blank) to the system browser (design §5.3). So a link is a link only when it stays in
 * this app — a path (`/en/tool/x`, `tool/x`), a query or a fragment; it is rendered without a
 * target and navigates in place. Anything else (a scheme, `//host`, a backslash a browser would
 * read as a slash) is rendered as its text, with the address after it in parentheses: readable,
 * never clickable.
 */
const md = new MarkdownIt({ html: false, linkify: false, typographer: false });

const hasScheme = (href: string) => /^[a-z][a-z0-9+.-]*:/i.test(href);

/** Whether `href` (as written) stays in this app. */
export function isLocalHref(href: string): boolean {
  const h = href.trim();
  if (h === "" || h.includes("\\")) return false;
  if (hasScheme(h) || h.startsWith("//")) return false;
  return true;
}

interface Env {
  links?: { local: boolean; href: string; auto: boolean }[];
}

const defaultLinkOpen = md.renderer.rules.link_open;
md.renderer.rules.link_open = (tokens, idx, options, env: Env, self) => {
  const token = tokens[idx];
  const href = token?.attrGet("href") ?? "";
  const local = isLocalHref(href);
  env.links ??= [];
  env.links.push({ local, href, auto: token?.markup === "autolink" });
  if (!local) return "";
  token?.attrs?.splice(0, token.attrs.length, ["href", href]);
  return defaultLinkOpen
    ? defaultLinkOpen(tokens, idx, options, env, self)
    : self.renderToken(tokens, idx, options);
};

const defaultLinkClose = md.renderer.rules.link_close;
md.renderer.rules.link_close = (tokens, idx, options, env: Env, self) => {
  const link = env.links?.pop();
  if (link && !link.local) return link.auto ? "" : ` (${md.utils.escapeHtml(link.href)})`;
  return defaultLinkClose
    ? defaultLinkClose(tokens, idx, options, env, self)
    : self.renderToken(tokens, idx, options);
};

const defaultImage = md.renderer.rules.image;
md.renderer.rules.image = (tokens, idx, options, env, self) => {
  const token = tokens[idx];
  const src = token?.attrGet("src") ?? "";
  if (!isLocalHref(src)) {
    return md.utils.escapeHtml(self.renderInlineAsText(token?.children ?? [], options, env));
  }
  return defaultImage
    ? defaultImage(tokens, idx, options, env, self)
    : self.renderToken(tokens, idx, options);
};

export function renderMarkdown(src: unknown): string {
  return md.render(String(src ?? ""), {} satisfies Env);
}
