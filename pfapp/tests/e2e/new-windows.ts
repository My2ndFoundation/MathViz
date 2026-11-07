import { expect, type Page } from "@playwright/test";

/**
 * "The shell opens nothing in a new window" (PrimeForge's app window hands `target=_blank` and
 * `window.open` to the system browser). The rendered DOM alone cannot show that — a component that
 * calls window.open on a click leaves no trace in page.content() — so this checks three things:
 *
 *   1. no `target="_blank"` / `_new` element in the shell's DOM;
 *   2. nothing called window.open since the page loaded (hookWindowOpen, before any script runs);
 *   3. no JavaScript the page loaded from /_next/static/ contains `window.open(` or a `"_blank"`
 *      / `"_new"` string literal — the code that could do either, whether or not it ran.
 *
 * The tool page inside the iframe is the web version, unchanged, and is not the shell's: only the
 * top document's own scripts are read.
 */

export const OPENS_WINDOW = /window\.open\s*\(|["'`]_(blank|new)["'`]/;

/** Record window.open calls instead of opening anything; call before page.goto. */
export async function hookWindowOpen(page: Page): Promise<void> {
  await page.addInitScript(() => {
    const w = window as unknown as { __opened: string[] };
    w.__opened = [];
    window.open = (url?: string | URL) => {
      w.__opened.push(String(url ?? ""));
      return null;
    };
  });
}

/** The shell's scripts the page has loaded so far (from the resource timing entries). */
async function shellScripts(page: Page): Promise<string[]> {
  return page.evaluate(() =>
    performance
      .getEntriesByType("resource")
      .map((e) => e.name)
      .filter((u) => new URL(u).pathname.startsWith("/_next/static/") && /\.js(\?|$)/.test(u)),
  );
}

export async function expectNoNewWindows(page: Page): Promise<void> {
  expect(await page.locator('[target="_blank"], [target="_new"]').count()).toBe(0);
  const opened = await page.evaluate(
    () => (window as unknown as { __opened?: string[] }).__opened ?? null,
  );
  expect(opened, "hookWindowOpen() was not installed before the page loaded").not.toBeNull();
  expect(opened).toEqual([]);
  const urls = await shellScripts(page);
  expect(urls.length).toBeGreaterThan(0);
  const offenders: string[] = [];
  for (const url of urls) {
    const body = await (await page.request.get(url)).text();
    const m = OPENS_WINDOW.exec(body);
    if (m)
      offenders.push(
        `${new URL(url).pathname}: …${body.slice(Math.max(0, m.index - 60), m.index + 40)}…`,
      );
  }
  expect(offenders).toEqual([]);
}
