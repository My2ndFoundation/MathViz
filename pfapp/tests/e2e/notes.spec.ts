import { readFileSync } from "node:fs";
import path from "node:path";
import { expect, type Page, test } from "@playwright/test";
import { expectNoNewWindows, hookWindowOpen } from "./new-windows";
import {
  type FakePlatformProcess,
  freePort,
  type RunningApp,
  startApp,
  startFakePlatform,
} from "./setup";

/**
 * The notes page (two panes, one row per conversation, follow-ups in place) against the built app
 * with the fake platform, in a data directory of its own so the counts are this spec's. Which tool
 * a program belongs to is read from the extracted pack, never written here.
 *
 * E2E_SHOTS=<dir> also saves screenshots of the two panes, wide and narrow, there.
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
const state: { prog?: string; threadId?: string } = {};

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

const ANSWER = "which kind of division";

async function shot(page: Page, name: string) {
  const dir = process.env.E2E_SHOTS;
  if (dir) await page.screenshot({ path: path.join(dir, name) });
}

test("no notes yet: the page says where answers are saved", async ({ page }) => {
  await page.goto(`${app.base}/en/notes`);
  await expect(page.getByTestId("notes-empty")).toContainText("Save as note");
  await expect(page.getByTestId("notes-row")).toHaveCount(0);
  await expect(page.getByTestId("notes-detail")).toHaveCount(0);
});

test("a saved answer is one row; earlier messages fold; a follow-up is answered in place and shows on the tool page", async ({
  page,
}) => {
  await hookWindowOpen(page);
  await page.goto(`${app.base}/en/tool/${firstTool()}`);
  const frameEl = page.getByTestId("tool-frame");
  await expect(frameEl).toHaveAttribute("data-py-prog", /./);
  const prog = (await frameEl.getAttribute("data-py-prog")) as string;
  state.prog = prog;
  const panel = page.getByTestId("ask-panel");
  const answers = panel.locator('[data-testid=qa-message][data-role="assistant"]');
  await panel.getByTestId("ask-input").fill("First question, not saved?");
  await panel.getByTestId("ask-submit").click();
  await expect(answers).toHaveCount(1, { timeout: 30_000 });
  await expect(panel.getByTestId("thinking")).toHaveCount(0);
  await panel.getByTestId("ask-input").fill("Second question, saved?");
  await panel.getByTestId("ask-submit").click();
  await expect(answers).toHaveCount(2, { timeout: 30_000 });
  await expect(panel.getByTestId("thinking")).toHaveCount(0);
  await answers.nth(1).getByTestId("save-note").click();
  await expect(answers.nth(1).getByTestId("note-saved")).toBeVisible();

  await page.getByTestId("nav-notes").click();
  const rows = page.getByTestId("notes-row");
  await expect(rows).toHaveCount(1);
  await expect(rows.first()).toContainText("First question, not saved?");
  await expect(rows.first().getByTestId("notes-row-followups")).toHaveText("No follow-ups");
  // the newest conversation is selected, and the selection is in the URL
  await expect(page).toHaveURL(/[?&]thread=[^&]+/);
  const threadId = new URL(page.url()).searchParams.get("thread") as string;
  state.threadId = threadId;
  await expect(rows.first()).toHaveAttribute("aria-current", "true");
  const detail = page.getByTestId("notes-detail");
  await expect(detail).toHaveAttribute("data-id", threadId);
  await expect(detail.getByTestId("notes-question")).toHaveText("First question, not saved?");
  await expect(detail.getByTestId("notes-subject")).toContainText("Program:");
  await expect(rows.first()).toBeVisible();

  // before the question the first saved answer replied to: folded behind a toggle (Q1, A1);
  // that question itself stays in view above its answer
  const shown = detail.getByTestId("qa-message");
  await expect(shown).toHaveCount(2);
  await expect(shown.first()).toHaveAttribute("data-role", "user");
  await expect(shown.first()).toHaveText(/Second question, saved\?/);
  await expect(shown.nth(1)).toHaveAttribute("data-saved", "true");
  await expect(shown.nth(1)).toContainText("Saved answer");
  const earlier = detail.getByTestId("notes-earlier");
  await expect(earlier).toHaveText("Show 2 earlier messages");
  await earlier.click();
  await expect(shown).toHaveCount(4);
  await expect(shown.first()).toContainText("First question, not saved?");
  await earlier.click();
  await expect(shown).toHaveCount(2);

  // a follow-up continues the same conversation, answered in place with a Save control
  await detail.getByTestId("notes-followup-input").fill("A follow-up from the notes page?");
  await detail.getByTestId("notes-followup-submit").click();
  await expect(shown).toHaveCount(4, { timeout: 30_000 });
  await expect(detail.getByTestId("thinking")).toHaveCount(0);
  await expect(shown.nth(2)).toHaveText(/A follow-up from the notes page\?/);
  await expect(shown.nth(3)).toContainText(ANSWER);
  await expect(shown.nth(3).getByTestId("save-note")).toBeVisible();
  await expect(rows.first().getByTestId("notes-row-followups")).toHaveText("1 follow-up");
  await shot(page, "notes-wide.png");

  // reload keeps the selection
  await page.reload();
  await expect(page.getByTestId("notes-detail")).toHaveAttribute("data-id", threadId);
  await expect(page.getByTestId("notes-detail").getByTestId("qa-message")).toHaveCount(4);

  // "Open the exercise": the program in its tool, whose ask panel shows the follow-up
  const open = page.getByTestId("notes-open");
  await expect(open).toHaveAttribute("href", `/en/tool/${programTool(prog)}?prog=${prog}`);
  await open.click();
  await expect(page).toHaveURL(`${app.base}/en/tool/${programTool(prog)}?prog=${prog}`);
  await expect(page.getByTestId("tool-frame")).toHaveAttribute("data-py-prog", prog);
  await expect(panel.locator('[data-testid=qa-message][data-role="user"]').last()).toHaveText(
    /A follow-up from the notes page\?/,
  );
  await expectNoNewWindows(page);

  // back keeps the selection too
  await page.goBack();
  await expect(page.getByTestId("notes-detail")).toHaveAttribute("data-id", threadId);
});

test("a narrow window shows one pane at a time: list, then the conversation with a back control", async ({
  page,
}) => {
  await page.setViewportSize({ width: 700, height: 900 });
  await page.goto(`${app.base}/en/notes`);
  // a narrow window's sidebar floats over the stage until it is collapsed (the shell's own rule)
  await page.getByTestId("sidebar").getByRole("button", { name: "Collapse sidebar" }).click();
  // inside the stage: while the page streams in, Next keeps a hidden copy of it outside the shell
  const stage = page.getByTestId("stage");
  const list = stage.getByTestId("notes-list-pane");
  const detail = stage.getByTestId("notes-detail-pane");
  await expect(list).toBeVisible();
  await expect(detail).toBeHidden();
  await page.getByTestId("notes-row").first().click();
  await expect(detail).toBeVisible();
  await expect(list).toBeHidden();
  await shot(page, "notes-narrow-detail.png");
  await page.getByTestId("notes-back").click();
  await expect(list).toBeVisible();
  await expect(detail).toBeHidden();
  // the back control is for narrow windows only
  await page.setViewportSize({ width: 1400, height: 900 });
  await expect(list).toBeVisible();
  await expect(detail).toBeVisible();
  await expect(page.getByTestId("notes-back")).toBeHidden();
});

test("Delete asks first, removes the notes, and keeps the conversation", async ({ page }) => {
  const { threadId, prog } = state;
  if (!threadId || !prog) throw new Error("the earlier test left no thread");
  await page.goto(`${app.base}/en/notes?thread=${encodeURIComponent(threadId)}`);
  await page.getByTestId("notes-delete").click();
  await page.getByTestId("notes-delete-no").click();
  await expect(page.getByTestId("notes-row")).toHaveCount(1);
  await page.getByTestId("notes-delete").click();
  await page.getByTestId("notes-delete-yes").click();
  await expect(page.getByTestId("notes-row")).toHaveCount(0);
  await expect(page.getByTestId("notes-empty")).toContainText("Save as note");
  const res = await page.request.get(`${app.base}/api/threads/${encodeURIComponent(threadId)}`);
  expect(res.status()).toBe(200);
  const t = (await res.json()) as { messages: { noteId: string | null }[] };
  expect(t.messages.length).toBe(6);
  expect(t.messages.every((m) => m.noteId === null)).toBe(true);
});

test("a library conversation: Open lands on Ask the library with it reopened, and a follow-up there continues it", async ({
  page,
}) => {
  await page.goto(`${app.base}/en/ask`);
  await page.getByTestId("library-input").fill("Where is Fahrenheit converted?");
  await page.getByTestId("library-submit").click();
  const answers = page.locator('[data-testid=qa-message][data-role="assistant"]');
  await expect(answers).toHaveCount(1, { timeout: 30_000 });
  await expect(page.getByTestId("thinking")).toHaveCount(0);
  // the page's URL follows its conversation
  await expect(page).toHaveURL(/\/en\/ask\?thread=[^&]+$/);
  await answers.first().getByTestId("save-note").click();
  await expect(answers.first().getByTestId("note-saved")).toBeVisible();

  await page.goto(`${app.base}/en/notes`);
  await expect(page.getByTestId("notes-row")).toHaveCount(1);
  const threadId = await page.getByTestId("notes-row").first().getAttribute("data-id");
  await expect(page.getByTestId("notes-subject")).toHaveText("The whole library");
  const open = page.getByTestId("notes-open");
  await expect(open).toHaveText("Open “Ask the whole library”");
  await expect(open).toHaveAttribute("href", `/en/ask?thread=${threadId}`);
  await open.click();
  await expect(page).toHaveURL(`${app.base}/en/ask?thread=${threadId}`);
  const users = page.locator('[data-testid=qa-message][data-role="user"]');
  await expect(users).toHaveCount(1);
  await expect(users.first()).toHaveText(/Where is Fahrenheit converted\?/);

  await page.getByTestId("library-input").fill("And a follow-up on the library page?");
  await page.getByTestId("library-submit").click();
  await expect(answers).toHaveCount(2, { timeout: 30_000 });
  await expect(users).toHaveCount(2);
  const res = await page.request.get(`${app.base}/api/threads/${threadId}`);
  const t = (await res.json()) as { messages: { role: string }[] };
  expect(t.messages.map((m) => m.role)).toEqual(["user", "assistant", "user", "assistant"]);
  // a reload keeps it; "New conversation" leaves it
  await page.reload();
  await expect(users).toHaveCount(2);
  await page.getByTestId("ask-new").click();
  await expect(page).toHaveURL(`${app.base}/en/ask`);
  await expect(users).toHaveCount(0);
});
