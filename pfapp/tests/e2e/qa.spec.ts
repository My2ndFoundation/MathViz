import { readFileSync } from "node:fs";
import path from "node:path";
import { expect, type Frame, type Page, test } from "@playwright/test";
import { expectNoNewWindows, hookWindowOpen } from "./new-windows";
import {
  type FakePlatformProcess,
  freePort,
  type RunningApp,
  startApp,
  startFakePlatform,
} from "./setup";

/**
 * Q&A, notes and "ask the whole library" (plan Task 11) against the built app, with the fake
 * PrimeForge platform (tests/e2e/fake-platform-server.ts) behind PRIMEFORGE_API_URL — the same
 * variables PrimeForge sets, so the app runs its production code path. Which tool a cited program
 * belongs to is read from the extracted pack, never written here.
 *
 * E2E_SHOTS=<dir> also saves screenshots of the ask panel and of /notes there.
 */

interface Catalog {
  items: { id: string; order: number }[];
}
const catalog = (): Catalog => JSON.parse(readFileSync(process.env.E2E_CATALOG as string, "utf8"));
const nthTool = (n: number) =>
  [...catalog().items].sort((a, b) => a.order - b.order)[n]?.id as string;
const firstTool = () => nthTool(0);
const programTool = (programId: string): string =>
  JSON.parse(
    readFileSync(
      path.join(path.dirname(process.env.E2E_CATALOG as string), "source", `${programId}.json`),
      "utf8",
    ),
  ).tool;

let fake: FakePlatformProcess;
let app: RunningApp;

test.describe.configure({ mode: "serial" });

test.beforeAll(async () => {
  const port = await freePort();
  fake = await startFakePlatform(port);
  app = await startApp({
    pfaddon: process.env.E2E_PFADDON as string,
    port,
    env: { PRIMEFORGE_API_URL: fake.url, PRIMEFORGE_API_SECRET: fake.secret },
  });
});

test.afterAll(async () => {
  await app?.stop();
  await fake?.stop();
});

async function shot(page: Page, name: string) {
  const dir = process.env.E2E_SHOTS;
  if (dir) await page.screenshot({ path: path.join(dir, name) });
}

const toolFrame = async (page: Page): Promise<Frame> => {
  await expect(page.getByTestId("tool-frame")).toHaveAttribute("src", /./);
  const frame = await (await page.getByTestId("tool-frame").elementHandle())?.contentFrame();
  if (!frame) throw new Error("no tool frame");
  await frame.waitForLoadState("load");
  return frame;
};

const newWindowLinks = (page: Page) => page.locator('[target="_blank"], [target="_new"]').count();

test("ask panel on a python tool page: answer shown, saved as a note; /notes lists it and search filters it", async ({
  page,
}) => {
  await page.goto(`${app.base}/en/tool/${firstTool()}`);
  const frameEl = page.getByTestId("tool-frame");
  await expect(frameEl).toHaveAttribute("data-py-prog", /./);
  const prog = (await frameEl.getAttribute("data-py-prog")) as string;
  const panel = page.getByTestId("ask-panel");
  await expect(panel.getByTestId("ask-context")).toContainText(prog);
  await expect(panel.getByTestId("ask-submit")).toHaveText("Ask about this program");

  await panel.getByTestId("ask-input").fill("Why is it written this way?");
  await panel.getByTestId("ask-submit").click();
  const answer = panel.locator('[data-testid=qa-message][data-role="assistant"]');
  await expect(answer).toContainText("which kind of division", { timeout: 30_000 });
  await expect(panel.getByTestId("thinking")).toHaveCount(0);
  await expect(panel.locator('[data-testid=qa-message][data-role="user"]')).toHaveText(
    /Why is it written this way\?/,
  );
  // the answer cites the program it was about: a link to it inside its tool
  await expect(answer.getByTestId("citation")).toHaveAttribute(
    "href",
    `/en/tool/${programTool(prog)}?prog=${prog}`,
  );
  await answer.getByTestId("save-note").click();
  await expect(answer.getByTestId("note-saved")).toBeVisible();
  expect(await newWindowLinks(page)).toBe(0);
  await shot(page, "ask-panel.png");

  await page.getByTestId("nav-notes").click();
  await expect(page).toHaveURL(new RegExp(`^${app.base}/en/notes(\\?thread=[^&]+)?$`));
  const notes = page.getByTestId("notes-row");
  await expect(notes).toHaveCount(1);
  await expect(notes.first()).toContainText("Why is it written this way?");
  await expect(page.locator('[data-testid=qa-message][data-saved="true"]')).toContainText(
    "which kind of division",
  );
  await page.getByTestId("notes-search").fill("division");
  await expect(notes).toHaveCount(1);
  await page.getByTestId("notes-search").fill("zzzz-no-such-word");
  await expect(notes).toHaveCount(0);
  await expect(page.getByTestId("notes-empty")).toHaveText("No saved conversation matches.");
  await page.getByTestId("notes-search").fill("");
  await expect(notes).toHaveCount(1);
  // by group: the chip of the catalog group the program's tool is in, and "All"
  const chips = page.getByTestId("notes-chip");
  await expect(chips).toHaveCount(2);
  await chips.nth(1).click();
  await expect(chips.nth(1)).toHaveAttribute("aria-pressed", "true");
  await expect(notes).toHaveCount(1);
  await chips.first().click();
  await expect(notes).toHaveCount(1);
  expect(await newWindowLinks(page)).toBe(0);
  await shot(page, "notes.png");
});

test("hiding the ask panel keeps the conversation: ask, hide at once, show, the answer is there", async ({
  page,
}) => {
  await page.goto(`${app.base}/en/tool/${firstTool()}`);
  await expect(page.getByTestId("tool-frame")).toHaveAttribute("data-py-prog", /./);
  const panel = page.getByTestId("ask-panel");
  await panel.getByTestId("ask-input").fill("What if I hide the panel now?");
  await panel.getByTestId("ask-submit").click();
  // hidden straight after asking, while the tutor may still be answering (final review I-3)
  await page.getByTestId("ask-hide").click();
  await expect(panel).toBeHidden();
  await expect(page.locator(".ask-wrap")).toHaveAttribute("inert", "");
  // the top bar's toggle is the way back: not pressed, and focus moved to it from the hidden panel
  const toggle = page.getByTestId("topbar").getByTestId("ask-toggle");
  await expect(toggle).toHaveText("Ask AI Tutor");
  await expect(toggle).toHaveAttribute("aria-pressed", "false");
  await expect(toggle).toBeFocused();
  await toggle.click();
  await expect(panel).toBeVisible();
  await expect(toggle).toHaveAttribute("aria-pressed", "true");
  await expect(page.getByTestId("ask-hide")).toBeFocused();
  // the panel reopened the earlier tests' conversation: this question is the latest in it
  await expect(panel.locator('[data-testid=qa-message][data-role="user"]').last()).toHaveText(
    /What if I hide the panel now\?/,
  );
  await expect(
    panel.locator('[data-testid=qa-message][data-role="assistant"]').last(),
  ).toContainText("which kind of division", { timeout: 30_000 });
  await expect(panel.getByTestId("thinking")).toHaveCount(0);
});

test("the top-bar Ask toggle: hides and shows the panel, survives a reload, only on tool pages", async ({
  page,
}) => {
  await page.goto(`${app.base}/en/tool/${firstTool()}`);
  await expect(page.getByTestId("tool-frame")).toHaveAttribute("data-py-prog", /./);
  const panel = page.getByTestId("ask-panel");
  const toggle = page.getByTestId("ask-toggle");
  await expect(panel).toBeVisible();
  await expect(toggle).toHaveAttribute("aria-pressed", "true");
  // hidden from the toggle itself: focus stays on it
  await toggle.click();
  await expect(panel).toBeHidden();
  await expect(toggle).toHaveAttribute("aria-pressed", "false");
  await expect(toggle).toBeFocused();
  // it glows (cyan) and, while the panel is hidden, pulses, unless reduced motion is asked for
  const look = () =>
    toggle.evaluate((b) => {
      const c = getComputedStyle(b);
      return { shadow: c.boxShadow, anim: c.animationName };
    });
  const hiddenLook = await look();
  expect(hiddenLook.shadow).toContain("rgba(45, 212, 234");
  expect(hiddenLook.anim).toBe("ask-glow");
  await page.emulateMedia({ reducedMotion: "reduce" });
  expect((await look()).anim).toBe("none");
  expect((await look()).shadow).toContain("rgba(45, 212, 234");
  await page.emulateMedia({ reducedMotion: "no-preference" });
  // the edge tab it replaces is gone
  await expect(page.getByTestId("ask-open")).toHaveCount(0);
  // remembered across a reload
  await page.reload();
  await expect(page.getByTestId("tool-frame")).toHaveAttribute("data-py-prog", /./);
  await expect(toggle).toHaveAttribute("aria-pressed", "false");
  await expect(panel).toBeHidden();
  await toggle.click();
  await expect(panel).toBeVisible();
  await expect(page.getByTestId("ask-hide")).toBeFocused();
  await page.reload();
  await expect(toggle).toHaveAttribute("aria-pressed", "true");
  await expect(panel).toBeVisible();
  // pressed: lit but calm (no pulse, a smaller glow than when hidden)
  const pressedLook = await look();
  expect(pressedLook.anim).toBe("none");
  expect(pressedLook.shadow).toContain("rgba(45, 212, 234");
  expect(pressedLook.shadow).not.toBe(hiddenLook.shadow);
  // in Chinese
  await page.goto(`${app.base}/zh/tool/${firstTool()}`);
  await expect(toggle).toHaveText("问 AI 导师");
  // not on pages without the panel
  await page.goto(`${app.base}/en/notes`);
  await expect(page.getByTestId("topbar")).toBeVisible();
  await expect(page.getByTestId("ask-toggle")).toHaveCount(0);
});

test("the ask panel's left edge resizes it: drag, clamp, keyboard, reload, reset; none when narrow", async ({
  page,
}) => {
  await page.goto(`${app.base}/en/tool/${firstTool()}`);
  await expect(page.getByTestId("tool-frame")).toHaveAttribute("data-py-prog", /./);
  const wrap = page.locator(".ask-wrap");
  const frame = page.getByTestId("tool-frame");
  const handle = page.getByTestId("ask-resize");
  const width = async () => Math.round(((await wrap.boundingBox()) as { width: number }).width);
  await expect(handle).toHaveAttribute("role", "separator");
  await expect(handle).toHaveAttribute("aria-orientation", "vertical");
  await expect(handle).toHaveAttribute("aria-valuemin", "280");
  await expect(handle).toHaveAttribute("aria-valuenow", "340");
  expect(await width()).toBe(340);
  const drag = async (dx: number, during?: () => Promise<void>) => {
    const b = (await handle.boundingBox()) as {
      x: number;
      y: number;
      width: number;
      height: number;
    };
    const x = b.x + b.width / 2;
    const y = b.y + b.height / 2;
    await page.mouse.move(x, y);
    await page.mouse.down();
    await page.mouse.move(x + dx / 2, y, { steps: 4 });
    await page.mouse.move(x + dx, y, { steps: 4 });
    await during?.();
    await page.mouse.up();
  };
  // a drag 100 px to the left widens it by 100 px; meanwhile the iframe takes no pointer events
  await drag(-100, async () => {
    expect(await frame.evaluate((f) => getComputedStyle(f).pointerEvents)).toBe("none");
    // the width follows the pointer live, before the button is released
    await expect.poll(width).toBe(440);
  });
  await expect(handle).toHaveAttribute("aria-valuenow", "440");
  expect(await width()).toBe(440);
  expect(await frame.evaluate((f) => getComputedStyle(f).pointerEvents)).toBe("auto");
  // remembered across a reload
  await page.reload();
  await expect(frame).toHaveAttribute("data-py-prog", /./);
  await expect(handle).toHaveAttribute("aria-valuenow", "440");
  expect(await width()).toBe(440);
  // clamped: the tool page keeps at least 480 px, the panel at least 280 px
  await drag(-3000);
  const fw = Math.round(((await frame.boundingBox()) as { width: number }).width);
  expect(fw).toBe(480);
  await expect(handle).toHaveAttribute("aria-valuenow", String(await width()));
  await expect(handle).toHaveAttribute("aria-valuemax", String(await width()));
  await drag(3000);
  expect(await width()).toBe(280);
  await expect(handle).toHaveAttribute("aria-valuenow", "280");
  // the keyboard: ← widens, → narrows, by 16 px
  await handle.focus();
  await page.keyboard.press("ArrowLeft");
  await page.keyboard.press("ArrowLeft");
  await expect(handle).toHaveAttribute("aria-valuenow", "312");
  expect(await width()).toBe(312);
  await page.keyboard.press("ArrowRight");
  await expect(handle).toHaveAttribute("aria-valuenow", "296");
  expect(await width()).toBe(296);
  // double-click: back to the default, and the stored width is gone
  await handle.dblclick();
  await expect(handle).toHaveAttribute("aria-valuenow", "340");
  expect(await width()).toBe(340);
  expect(await page.evaluate(() => localStorage.getItem("pfapp-ask-width"))).toBeNull();
  // a narrow window: the fixed CSS width, no handle (a stored width is not applied)
  await drag(-60);
  await page.setViewportSize({ width: 700, height: 800 });
  await expect(handle).toHaveCount(0);
  expect(await width()).toBe(300);
  await page.setViewportSize({ width: 1400, height: 900 });
  await expect(handle).toHaveAttribute("aria-valuenow", "400");
});

test("the hint button is disabled outside fill-in mode", async ({ page }) => {
  await page.goto(`${app.base}/en/tool/${firstTool()}`);
  const frameEl = page.getByTestId("tool-frame");
  const frame = await toolFrame(page);
  const hint = page.getByTestId("ask-hint");
  // the mode buttons end in their key: "Read  1", "Fill in  2", "Trace  3" (en)
  await frame.getByRole("button", { name: /\s1$/ }).click();
  await expect(frameEl).toHaveAttribute("data-py-mode", "read");
  await expect(hint).toBeDisabled();
  await frame.getByRole("button", { name: /\s3$/ }).click();
  await expect(frameEl).toHaveAttribute("data-py-mode", "trace");
  await expect(hint).toBeDisabled();
  // the question itself is never blocked
  await page.getByTestId("ask-input").fill("What does this do?");
  await expect(page.getByTestId("ask-submit")).toBeEnabled();
});

test("the hint button is enabled in fill-in mode with a blank focused, and a hint comes back", async ({
  page,
}) => {
  await page.goto(`${app.base}/en/tool/${firstTool()}`);
  const frameEl = page.getByTestId("tool-frame");
  const frame = await toolFrame(page);
  const hint = page.getByTestId("ask-hint");
  await frame.getByRole("button", { name: /\s2$/ }).click();
  await expect(frameEl).toHaveAttribute("data-py-mode", "blank");
  // the page's blanks are textareas; focusing one reports its id over the bridge
  await frame.locator("textarea").first().focus();
  await expect(page.getByTestId("ask-context")).toContainText(/blank \S+/);
  await expect(hint).toBeEnabled();
  await hint.click();
  const panel = page.getByTestId("ask-panel");
  await expect(panel.locator('[data-testid=qa-message][data-role="user"]').last()).toContainText(
    "Could I have a hint for blank",
  );
  await expect(
    panel.locator('[data-testid=qa-message][data-role="assistant"]').last(),
  ).toContainText("which kind of division", { timeout: 30_000 });
  await expect(panel.getByTestId("thinking")).toHaveCount(0);
  await expect(panel.getByTestId("ask-error")).toHaveCount(0);
});

test("the ask panel reopens the conversation: ask, reload, the Q&A is there and a follow-up continues it", async ({
  page,
}) => {
  // a tool no earlier test asked about: nothing to reopen yet, so the counts below are this test's
  await page.goto(`${app.base}/en/tool/${nthTool(1)}`);
  await expect(page.getByTestId("tool-frame")).toHaveAttribute("data-py-prog", /./);
  const panel = page.getByTestId("ask-panel");
  const users = panel.locator('[data-testid=qa-message][data-role="user"]');
  const answers = panel.locator('[data-testid=qa-message][data-role="assistant"]');
  await expect(users).toHaveCount(0);
  await panel.getByTestId("ask-input").fill("Will this still be here after a reload?");
  await panel.getByTestId("ask-submit").click();
  await expect(answers).toHaveCount(1, { timeout: 30_000 });
  await expect(panel.getByTestId("thinking")).toHaveCount(0);

  await page.reload();
  await expect(page.getByTestId("tool-frame")).toHaveAttribute("data-py-prog", /./);
  await expect(users).toHaveCount(1);
  await expect(users.first()).toHaveText(/Will this still be here after a reload\?/);
  await expect(answers.first()).toContainText("which kind of division");
  await expect(panel.getByTestId("ask-new")).toBeVisible();

  // a question now follows that conversation up rather than starting another
  await panel.getByTestId("ask-input").fill("And a follow-up?");
  await panel.getByTestId("ask-submit").click();
  await expect(answers).toHaveCount(2, { timeout: 30_000 });
  await expect(users).toHaveCount(2);
  await expect(users.last()).toHaveText(/And a follow-up\?/);
});

test("/ask: the answer's citation opens /tool/<id>?prog=<programId> in place", async ({ page }) => {
  await hookWindowOpen(page);
  await page.goto(`${app.base}/en`);
  await page.getByTestId("nav-ask").click();
  await expect(page).toHaveURL(`${app.base}/en/ask`);
  await page.getByTestId("library-input").fill("Fahrenheit");
  await page.getByTestId("library-submit").click();
  const answer = page.locator('[data-testid=qa-message][data-role="assistant"]');
  await expect(answer).toContainText("worked program", { timeout: 30_000 });

  // an in-app Markdown link is a link; the outside one is text, and nothing opens a new window
  await expect(answer.locator('a[href="/en/notes"]')).toHaveCount(1);
  await expect(answer.locator('a[href^="http"]')).toHaveCount(0);
  await expect(answer).toContainText("https://docs.python.org/3/");
  await expectNoNewWindows(page);

  const cite = answer.locator('[data-testid=citation][data-id^="program:"]').first();
  const programId = ((await cite.getAttribute("data-id")) as string).slice("program:".length);
  const href = `/en/tool/${programTool(programId)}?prog=${programId}`;
  await expect(cite).toHaveAttribute("href", href);
  await cite.click();
  await expect(page).toHaveURL(`${app.base}${href}`);
  await expect(page.getByTestId("tool-frame")).toHaveAttribute(
    "src",
    new RegExp(`[?&]prog=${programId}(&|$)`),
  );
  expect(page.context().pages()).toHaveLength(1);
});
