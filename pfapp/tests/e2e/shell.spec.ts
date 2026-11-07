import { readFileSync } from "node:fs";
import { expect, type Frame, type Page, test } from "@playwright/test";
import { type RunningApp, startApp } from "./setup";

/**
 * The shell (task 8): sidebar, tool iframe, language switch, ⌘K, the empty state's import. Every
 * expected count and label is read from the extracted pack's catalog.json (E2E_CATALOG), never
 * written here.
 */

type Bi = { en: string; zh: string };
interface Catalog {
  items: { id: string; file: string; group: string; order: number; title: Bi; tag?: Bi }[];
  groups: { id: string; label: Bi }[];
}

const base = () => process.env.E2E_BASE as string;
const catalog = (): Catalog => JSON.parse(readFileSync(process.env.E2E_CATALOG as string, "utf8"));
const ordered = () => [...catalog().items].sort((a, b) => a.order - b.order);
const contentVersion = () => process.env.E2E_CONTENT_VERSION as string;

/** Collect console errors and CSP violations from the page and every frame in it. */
function watch(page: Page) {
  const errors: string[] = [];
  page.on("console", (m) => {
    if (m.type() === "error") errors.push(`${m.location().url}: ${m.text()}`);
  });
  page.on("pageerror", (e) => errors.push(`pageerror: ${e.message}`));
  return errors;
}

async function cspViolations(frame: Frame): Promise<string[]> {
  return frame.evaluate(() => (window as unknown as { __csp?: string[] }).__csp ?? []);
}

test.beforeEach(async ({ page }) => {
  // runs in every frame before its scripts: records CSP violations the page itself would swallow
  await page.addInitScript(() => {
    const w = window as unknown as { __csp: string[] };
    w.__csp = [];
    document.addEventListener("securitypolicyviolation", (e) => {
      w.__csp.push(`${e.violatedDirective} ${e.blockedURI}`);
    });
  });
});

async function setLang(page: Page, lang: "en" | "zh") {
  const { token } = await (await page.request.get(`${base()}/api/session-token`)).json();
  const res = await page.request.put(`${base()}/api/settings`, {
    data: { lang },
    headers: { "x-primeforge-csrf": token, origin: base() },
  });
  expect(res.status()).toBe(200);
}

const toolFrame = async (page: Page): Promise<Frame> => {
  const handle = await page.getByTestId("tool-frame").elementHandle();
  const frame = await handle?.contentFrame();
  if (!frame) throw new Error("no tool frame");
  await frame.waitForLoadState("load");
  return frame;
};

test.describe.configure({ mode: "serial" });

/** The iframe's src. The shell gives it only after hydration (tool-frame.tsx), so wait for it. */
async function frameSrc(page: Page): Promise<string> {
  const frame = page.getByTestId("tool-frame");
  await expect(frame).toHaveAttribute("src", /./);
  return (await frame.getAttribute("src")) ?? "";
}

test("sidebar: every group and tool of the pack, the first highlighted and clickable; the iframe is /c/<ver>/tools/…?lang=en", async ({
  page,
}) => {
  await setLang(page, "en");
  const cat = catalog();
  const items = ordered();
  const [first, second] = items;
  if (!first || !second) throw new Error("the pack has fewer than two tools");
  const errors = watch(page);

  await page.goto(`${base()}/`);
  await expect(page).toHaveURL(`${base()}/en/tool/${first.id}`);

  await expect(page.getByTestId("sidebar-group")).toHaveCount(cat.groups.length);
  await expect(page.getByTestId("sidebar-item")).toHaveCount(cat.items.length);
  await expect(page.getByTestId("sidebar-group-label")).toHaveText(
    cat.groups.map((g) => g.label.en),
    { useInnerText: false },
  );
  // registry order within each group
  for (const g of cat.groups) {
    const want = items.filter((i) => i.group === g.id).map((i) => i.id);
    const got = await page
      .locator(`[data-testid=sidebar-group][data-group="${g.id}"] [data-testid=sidebar-item]`)
      .evaluateAll((els) => els.map((e) => e.getAttribute("data-id")));
    expect(got).toEqual(want);
  }

  const firstLink = page.locator(`[data-testid=sidebar-item][data-id="${first.id}"]`);
  await expect(firstLink).toHaveAttribute("aria-current", "page");
  await expect(page.locator("[data-testid=sidebar-item][aria-current=page]")).toHaveCount(1);

  // another tool, then back to the first by clicking it
  await page.locator(`[data-testid=sidebar-item][data-id="${second.id}"]`).click();
  await expect(page).toHaveURL(`${base()}/en/tool/${second.id}`);
  await expect(firstLink).not.toHaveAttribute("aria-current", "page");
  await firstLink.click();
  await expect(page).toHaveURL(`${base()}/en/tool/${first.id}`);
  await expect(firstLink).toHaveAttribute("aria-current", "page");

  const src = await frameSrc(page);
  expect(src.startsWith(`/c/${contentVersion()}/tools/`)).toBe(true);
  expect(src).toBe(`/c/${contentVersion()}/${first.file}?lang=en`);
  expect(new URL(src, base()).searchParams.get("lang")).toBe("en");

  // the tool page itself: loaded, 0 console errors, 0 CSP violations
  const frame = await toolFrame(page);
  expect(new URL(frame.url()).pathname).toBe(`/c/${contentVersion()}/${first.file}`);
  await expect(frame.locator("body")).not.toBeEmpty();
  await page.waitForTimeout(500);
  expect(await cspViolations(frame)).toEqual([]);
  expect(await cspViolations(page.mainFrame())).toEqual([]);
  expect(errors).toEqual([]);
  // E2E_SCREENSHOT=<file.png>: keep a picture of the shell with the tool open (review evidence)
  if (process.env.E2E_SCREENSHOT) await page.screenshot({ path: process.env.E2E_SCREENSHOT });
});

test("switching to Chinese: group labels in Chinese, the iframe reloads with lang=zh, `/` remembers it", async ({
  page,
}) => {
  await setLang(page, "en");
  const cat = catalog();
  const first = ordered()[0];
  if (!first) throw new Error("empty pack");
  const errors = watch(page);
  await page.goto(`${base()}/en/tool/${first.id}`);
  await toolFrame(page);

  await page.getByTestId("lang-switch").click();
  await expect(page).toHaveURL(`${base()}/zh/tool/${first.id}`);
  await expect(page.getByTestId("sidebar-group-label")).toHaveText(
    cat.groups.map((g) => g.label.zh),
    { useInnerText: false },
  );
  await expect(page.locator(`[data-testid=sidebar-item][data-id="${first.id}"] .tx`)).toHaveText(
    first.title.zh,
  );
  await expect(page.getByTestId("tool-frame")).toHaveAttribute(
    "src",
    `/c/${contentVersion()}/${first.file}?lang=zh`,
  );
  await expect
    .poll(async () => new URL((await toolFrame(page)).url()).searchParams.get("lang"))
    .toBe("zh");
  expect(await page.locator("html").getAttribute("lang")).toBe("zh-CN");

  // the choice is stored: `/` now opens in Chinese
  await page.goto(`${base()}/`);
  await expect(page).toHaveURL(`${base()}/zh/tool/${first.id}`);
  expect(errors).toEqual([]);
  await setLang(page, "en");
});

test("python ?prog= is passed on to the iframe", async ({ page }) => {
  const first = ordered()[0];
  if (!first) throw new Error("empty pack");
  await page.goto(`${base()}/en/tool/${first.id}?prog=some-program`);
  const src = await frameSrc(page);
  const q = new URL(src, base()).searchParams;
  expect(q.get("lang")).toBe("en");
  expect(q.get("prog")).toBe("some-program");
});

test("the shell observes the python page's state: switching the frame to blank mode shows up", async ({
  page,
}) => {
  const first = ordered()[0];
  if (!first) throw new Error("empty pack");
  await page.goto(`${base()}/en/tool/${first.id}`);
  const frameEl = page.getByTestId("tool-frame");
  const frame = await toolFrame(page);
  // trace first, then blank, so each step is a real change whatever the default mode is
  // the mode buttons end in their key: "Read  1", "Fill in  2", "Trace  3" (en)
  await frame.getByRole("button", { name: /\s3$/ }).click();
  await expect(frameEl).toHaveAttribute("data-py-mode", "trace");
  await frame.getByRole("button", { name: /\s2$/ }).click();
  await expect(frameEl).toHaveAttribute("data-py-mode", "blank");
  expect(await frameEl.getAttribute("data-py-prog")).toBeTruthy();
});

test("the shell has the python page's state on load, before any interaction", async ({ page }) => {
  const first = ordered()[0];
  if (!first) throw new Error("empty pack");
  await page.goto(`${base()}/en/tool/${first.id}`);
  const frameEl = page.getByTestId("tool-frame");
  // the page's on-mount message is the only one sent without an interaction
  await expect(frameEl).toHaveAttribute("data-py-mode", /^(read|blank|trace)$/);
  expect(await frameEl.getAttribute("data-py-prog")).toBeTruthy();
});

test("the shell opens nothing in a new window (PrimeForge's app window hands those to the system browser)", async ({
  page,
}) => {
  const first = ordered()[0];
  if (!first) throw new Error("empty pack");
  await page.goto(`${base()}/en/tool/${first.id}`);
  await expect(page.getByTestId("tool-frame")).toHaveAttribute("src", /./);
  await expect(page.getByTestId("ask-panel")).toBeVisible();
  // the shell's own DOM only: the tool page inside the iframe is the web version, unchanged
  expect(await page.locator('[target="_blank"], [target="_new"]').count()).toBe(0);
  expect(await page.content()).not.toContain("window.open");
  // the shell's own pages too (with answers in them: tests/e2e/qa.spec.ts)
  for (const p of ["ask", "notes", "settings"]) {
    await page.goto(`${base()}/en/${p}`);
    await expect(
      page.getByTestId(p === "ask" ? "library-ask" : p === "notes" ? "notes-view" : "settings"),
    ).toBeVisible();
    expect([p, await page.locator('[target="_blank"], [target="_new"]').count()]).toEqual([p, 0]);
    expect(await page.content()).not.toContain("window.open");
  }
});

test("⌘K filters by tag and opens the chosen tool", async ({ page }) => {
  const items = ordered();
  const first = items[0];
  // a tool other than the current one, found by a word of its tag that is in no title
  const titles = items.map((i) => i.title.en.toLowerCase()).join("\n");
  let pick: { id: string; word: string } | null = null;
  for (const it of items.slice(1)) {
    for (const w of (it.tag?.en ?? "").split(/[^A-Za-z]+/)) {
      if (w.length >= 5 && !titles.includes(w.toLowerCase())) pick ??= { id: it.id, word: w };
    }
  }
  if (!first || !pick) throw new Error("no tag word to search for");
  await page.goto(`${base()}/en/tool/${first.id}`);
  await page.keyboard.press("ControlOrMeta+k");
  await expect(page.getByTestId("cmdk")).toBeVisible();
  await page.getByTestId("cmdk-input").fill(pick.word);
  const want = items.filter((i) =>
    `${i.title.en}\n${i.tag?.en ?? ""}`
      .toLowerCase()
      .includes((pick as { word: string }).word.toLowerCase()),
  );
  await expect(page.getByTestId("cmdk-option")).toHaveCount(want.length);
  await page.locator(`[data-testid=cmdk-option][data-id="${pick.id}"]`).click();
  await expect(page).toHaveURL(`${base()}/en/tool/${pick.id}`);
  await expect(page.getByTestId("cmdk")).toHaveCount(0);
});

test("a collapsed sidebar is inert (out of the tab order); the edge button brings it back", async ({
  page,
}) => {
  const first = ordered()[0];
  if (!first) throw new Error("empty pack");
  await page.goto(`${base()}/en/tool/${first.id}`);
  const nav = page.getByTestId("sidebar");
  await expect(nav).not.toHaveAttribute("inert");
  await nav.getByRole("button", { name: "Collapse sidebar" }).click();
  await expect(nav).toHaveAttribute("inert", "");
  // Tab from the top of the page never lands on a sidebar link
  for (let i = 0; i < 5; i++) {
    await page.keyboard.press("Tab");
    expect(await page.evaluate(() => !!document.activeElement?.closest("nav"))).toBe(false);
  }
  await page.getByRole("button", { name: "Expand sidebar" }).click();
  await expect(nav).not.toHaveAttribute("inert");
  await page.evaluate(() => localStorage.removeItem("pfapp-sidebar"));
});

test.describe("no content pack", () => {
  let empty: RunningApp;
  test.beforeAll(async () => {
    empty = await startApp();
  });
  test.afterAll(async () => {
    await empty?.stop();
  });

  test("the empty state, then importing a local .pfaddon opens the first tool", async ({
    page,
  }) => {
    const cat = catalog();
    const first = ordered()[0];
    if (!first) throw new Error("empty pack");
    const errors = watch(page);
    await page.goto(`${empty.base}/`);
    await expect(page).toHaveURL(`${empty.base}/en/empty`);
    await expect(page.getByTestId("empty-state")).toBeVisible();
    await expect(page.getByTestId("sidebar")).toHaveCount(0);
    // outside PrimeForge the store install is one line; the import and a way to Settings remain
    await expect(page.getByTestId("online-notice")).toBeVisible();
    await expect(page.getByTestId("online-action")).toHaveCount(0);
    await expect(page.getByTestId("empty-settings")).toHaveAttribute("href", "/en/settings");
    // a tool URL without content goes to the empty state too
    await page.goto(`${empty.base}/en/tool/${first.id}`);
    await expect(page).toHaveURL(`${empty.base}/en/empty`);

    await page.getByTestId("import-file").setInputFiles(process.env.E2E_PFADDON as string);
    await expect(page).toHaveURL(`${empty.base}/en/tool/${first.id}`, { timeout: 60_000 });
    await expect(page.getByTestId("sidebar-item")).toHaveCount(cat.items.length);
    expect(errors).toEqual([]);
  });
});
