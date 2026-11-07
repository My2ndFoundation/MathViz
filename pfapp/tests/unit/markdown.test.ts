import { describe, expect, test } from "bun:test";
import { isLocalHref, renderMarkdown } from "../../app/src/lib/render/markdown";

describe("renderMarkdown", () => {
  test("raw HTML is escaped", () => {
    const html = renderMarkdown('<script>alert(1)</script> <img src=x onerror="y">');
    expect(html).not.toContain("<script");
    expect(html).not.toContain("<img");
    expect(html).toContain("&lt;script&gt;");
  });

  test("code blocks and inline code render", () => {
    const html = renderMarkdown("Use `//` here:\n\n```python\nx = 1 // 2\n```");
    expect(html).toContain("<code>//</code>");
    expect(html).toContain('<code class="language-python">x = 1 // 2');
  });

  test("a link inside the app is a link, with no target", () => {
    const html = renderMarkdown("See [the program](/en/tool/py-basics?prog=x) and [here](#top).");
    expect(html).toContain('<a href="/en/tool/py-basics?prog=x">the program</a>');
    expect(html).toContain('<a href="#top">here</a>');
    expect(html).not.toContain("target");
  });

  test("a link elsewhere is text, never an anchor", () => {
    for (const href of [
      "https://example.com/a",
      "http://127.0.0.1:9/x",
      "//example.com",
      "mailto:a@b.c",
      "tool:py-basics",
    ]) {
      const html = renderMarkdown(`Read [this](${href}) now.`);
      expect([href, html.includes("<a")]).toEqual([href, false]);
      expect(html).toContain("Read this (");
    }
    const auto = renderMarkdown("Go to <https://example.com>.");
    expect(auto).not.toContain("<a");
    expect(auto).toContain("https://example.com");
    // markdown-it percent-encodes a backslash, so `/\\host` is a plain path here, not `//host`
    expect(renderMarkdown("[x](/\\example.com)")).toContain('href="/%5Cexample.com"');
    // a javascript: link is not even a link to markdown-it; it stays literal text
    expect(renderMarkdown("[x](javascript:alert(1))")).not.toContain("<a");
  });

  test("nested emphasis inside a dropped link keeps its markup; links after it are unaffected", () => {
    const html = renderMarkdown("[**bold**](https://x.org) then [in](/en/notes)");
    expect(html).toContain("<strong>bold</strong> (https://x.org)");
    expect(html).toContain('<a href="/en/notes">in</a>');
  });

  test("images from elsewhere are their alt text", () => {
    expect(renderMarkdown("![a chart](https://x.org/c.png)")).not.toContain("<img");
    expect(renderMarkdown("![a chart](https://x.org/c.png)")).toContain("a chart");
  });

  test("isLocalHref", () => {
    expect(isLocalHref("/en/tool/x")).toBe(true);
    expect(isLocalHref("tool/x")).toBe(true);
    expect(isLocalHref("?prog=x")).toBe(true);
    expect(isLocalHref("//x")).toBe(false);
    expect(isLocalHref("HTTPS://x")).toBe(false);
    expect(isLocalHref("")).toBe(false);
  });
});
