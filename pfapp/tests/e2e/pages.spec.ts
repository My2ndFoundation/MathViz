import { readFileSync } from "node:fs";
import { expect, type Frame, type Page, test } from "@playwright/test";
import { IS_PYTHON, TARGET } from "./setup";

/**
 * Every tool page of the pack opens in the app with 0 console errors and 0 CSP violations — on
 * the maths, chess and cryptography apps (python.spec has its own, which also waits for the python
 * bridge). Added after chess 1.0.0 shipped two pages that could not run: their algorithm stepper
 * compiles code with `new Function`, which the tool pages' policy refused, and no test had opened
 * any page but the first.
 */

interface Catalog {
  items: { id: string; file: string; order: number }[];
}
const base = () => process.env.E2E_BASE as string;
const ordered = () =>
  [...(JSON.parse(readFileSync(process.env.E2E_CATALOG as string, "utf8")) as Catalog).items].sort(
    (a, b) => a.order - b.order,
  );

test.beforeEach(async ({ page }) => {
  // in every frame before its scripts: CSP violations the page itself would swallow
  await page.addInitScript(() => {
    const w = window as unknown as { __csp: string[] };
    w.__csp = [];
    document.addEventListener("securitypolicyviolation", (e) => {
      w.__csp.push(`${e.violatedDirective} ${e.blockedURI}`);
    });
  });
});

const toolFrame = async (page: Page): Promise<Frame> => {
  await expect(page.getByTestId("tool-frame")).toHaveAttribute("src", /./);
  const frame = await (await page.getByTestId("tool-frame").elementHandle())?.contentFrame();
  if (!frame) throw new Error("no tool frame");
  await frame.waitForLoadState("load");
  return frame;
};
const cspOf = (frame: Frame): Promise<string[]> =>
  frame.evaluate(() => (window as unknown as { __csp?: string[] }).__csp ?? []);

test(`every ${TARGET} page of the pack opens with 0 console errors and 0 CSP violations`, async ({
  page,
}) => {
  test.skip(IS_PYTHON, "python.spec covers the python pages (and their bridge)");
  test.setTimeout(600_000);
  const items = ordered();
  expect(items.length).toBeGreaterThan(0);
  let current = "";
  const problems: string[] = [];
  page.on("console", (m) => {
    if (m.type() === "error") problems.push(`${current}: console.error ${m.text()}`);
  });
  page.on("pageerror", (e) => problems.push(`${current}: pageerror ${e.message}`));
  for (const it of items) {
    current = it.id;
    await page.goto(`${base()}/en/tool/${it.id}`);
    const frame = await toolFrame(page);
    // the frame may still be on about:blank when its src is first set
    await expect
      .poll(() => new URL(frame.url()).pathname, { message: it.id })
      .toMatch(new RegExp(`/${it.file}$`));
    await frame.waitForLoadState("load");
    await expect(frame.locator("body"), it.id).not.toBeEmpty();
    // a page's start-up work (the chess stepper compiles its source on load) has run by now
    await page.waitForTimeout(500);
    for (const v of await cspOf(frame)) problems.push(`${it.id}: CSP (tool page) ${v}`);
    for (const v of await cspOf(page.mainFrame())) problems.push(`${it.id}: CSP (shell) ${v}`);
  }
  // one list, so a failure names every page that broke
  expect(problems).toEqual([]);
});
