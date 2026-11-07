import { readFileSync } from "node:fs";
import path from "node:path";
import { expect, type Frame, type Page, test } from "@playwright/test";
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
const firstTool = () => [...catalog().items].sort((a, b) => a.order - b.order)[0]?.id as string;
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
  await expect(page).toHaveURL(`${app.base}/en/notes`);
  const notes = page.getByTestId("note");
  await expect(notes).toHaveCount(1);
  await expect(notes.first()).toContainText("Why is it written this way?");
  await expect(notes.first()).toContainText("which kind of division");
  await page.getByTestId("notes-search").fill("division");
  await expect(notes).toHaveCount(1);
  await page.getByTestId("notes-search").fill("zzzz-no-such-word");
  await expect(notes).toHaveCount(0);
  await expect(page.getByTestId("notes-empty")).toBeVisible();
  await page.getByTestId("notes-search").fill("");
  await expect(notes).toHaveCount(1);
  expect(await newWindowLinks(page)).toBe(0);
  await shot(page, "notes.png");
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

test("/ask: the answer's citation opens /tool/<id>?prog=<programId> in place", async ({ page }) => {
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
  expect(await newWindowLinks(page)).toBe(0);
  expect(await page.content()).not.toContain("window.open");

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
