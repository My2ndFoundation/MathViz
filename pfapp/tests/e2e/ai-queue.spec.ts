import { readFileSync } from "node:fs";
import path from "node:path";
import { expect, type Page, test } from "@playwright/test";
import {
  type FakePlatformProcess,
  freePort,
  type RunningApp,
  startApp,
  startFakePlatform,
} from "./setup";

/**
 * The top bar and its AI indicator (after Math Test Buddy's) against the built app and the fake
 * platform. A question containing "[hold]" is held open by the fake's `ask` agent
 * (fake-platform-server.ts), so the job can be seen waiting or running, then cancelled from the
 * queue panel.
 *
 * E2E_SHOTS=<dir> also saves screenshots of the top bar and of the queue panel there.
 */

interface Catalog {
  items: { id: string; order: number }[];
}
const firstTool = (): string => {
  const c: Catalog = JSON.parse(readFileSync(process.env.E2E_CATALOG as string, "utf8"));
  return [...c.items].sort((a, b) => a.order - b.order)[0]?.id as string;
};

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

/** The iframe takes the whole stage, and the stage everything below the top bar. */
async function expectFrameFillsStage(page: Page) {
  const frame = page.getByTestId("tool-frame");
  await expect(frame).toHaveAttribute("src", /./);
  const vp = page.viewportSize() as { width: number; height: number };
  const bar = await page.getByTestId("topbar").boundingBox();
  const stage = await page.getByTestId("stage").boundingBox();
  const box = await frame.boundingBox();
  if (!bar || !stage || !box) throw new Error("no layout box");
  expect(bar.y).toBe(0);
  expect(bar.height).toBeLessThanOrEqual(40);
  expect(stage.y).toBeCloseTo(bar.y + bar.height, 0);
  expect(stage.y + stage.height).toBeCloseTo(vp.height, 0);
  expect(box.y).toBeCloseTo(stage.y, 0);
  expect(box.height).toBeCloseTo(stage.height, 0);
  expect(box.y + box.height).toBeCloseTo(vp.height, 0);
  // the frame is the stage's widest part (the ask panel sits beside it)
  expect(box.width).toBeGreaterThan(stage.width / 2 - 1);
}

test("the top bar names the page, and the tool iframe fills the stage under it (wide and narrow)", async ({
  page,
}) => {
  await page.setViewportSize({ width: 1280, height: 800 });
  await page.goto(`${app.base}/en/tool/${firstTool()}`);
  const title = await page.getByTestId("sidebar-item").first().locator(".tx").textContent();
  await expect(page.getByTestId("page-title")).toHaveText(title as string);
  await expect(page.getByTestId("ai-indicator")).toHaveAttribute("data-tone", "ok");
  await expectFrameFillsStage(page);
  await shot(page, "b2-topbar.png");

  await page.setViewportSize({ width: 700, height: 560 });
  await expectFrameFillsStage(page);
  await shot(page, "b2-topbar-narrow.png");
  await page.setViewportSize({ width: 1280, height: 800 });

  await page.getByTestId("nav-notes").click();
  await expect(page.getByTestId("page-title")).toHaveText("Notes");
});

test("a question being answered shows in the indicator and the queue; Cancel there ends it and the ask panel says so", async ({
  page,
}) => {
  await page.goto(`${app.base}/en/tool/${firstTool()}`);
  await expect(page.getByTestId("tool-frame")).toHaveAttribute("data-py-prog", /./);
  const indicator = page.getByTestId("ai-indicator");
  await expect(indicator).toHaveAttribute("data-tone", "ok");
  await expect(page.getByTestId("ai-indicator-count")).toHaveText("0");

  const panel = page.getByTestId("ask-panel");
  await panel.getByTestId("ask-input").fill("[hold] Please wait on this one");
  await panel.getByTestId("ask-submit").click();
  await expect(panel.getByTestId("thinking")).toBeVisible();
  // the ask panel's submit refreshes the indicator at once (no 10 s wait)
  await expect(page.getByTestId("ai-indicator-count")).toHaveText("1", { timeout: 5_000 });
  await expect(indicator).toHaveAttribute("aria-label", /1 in the queue/);

  // Esc closes the panel and focus goes back to the trigger
  await indicator.click();
  const queue = page.getByTestId("ai-queue");
  await expect(queue).toBeVisible();
  await expect(queue.getByTestId("ai-queue-status")).toHaveText("Connected and working");
  await page.keyboard.press("Escape");
  await expect(queue).toHaveCount(0);
  await expect(indicator).toBeFocused();

  await indicator.click();
  const row = queue.getByTestId("ai-queue-active").getByTestId("ai-queue-row");
  await expect(row).toHaveCount(1);
  await expect(row).toHaveAttribute("data-status", /^(queued|running)$/);
  await expect(row).toContainText("Question");
  await expect(row.getByTestId("ai-queue-title")).toHaveText(/\[hold\] Please wait on this one/);
  await expect(row.getByTestId("ai-queue-title")).toHaveAttribute("href", /^\/en\/tool\//);
  await expect(queue.getByTestId("ai-queue-settings")).toHaveAttribute("href", "/en/settings#ai");
  await shot(page, "b2-queue-active.png");

  await row.getByTestId("ai-queue-cancel").click();
  await expect(queue.getByTestId("ai-queue-active")).toHaveCount(0);
  await expect(page.getByTestId("ai-indicator-count")).toHaveText("0");
  const done = queue.getByTestId("ai-queue-recent").getByTestId("ai-queue-row").first();
  await expect(done).toHaveAttribute("data-status", "cancelled");
  await expect(done).toContainText("Cancelled");
  await shot(page, "b2-queue-recent.png");

  // a click outside closes it
  await page.getByTestId("ai-queue-outside").click({ position: { x: 20, y: 300 } });
  await expect(queue).toHaveCount(0);
  await expect(indicator).toBeFocused();

  // the ask panel's own poll sees the job ended
  await expect(panel.getByTestId("thinking")).toHaveCount(0, { timeout: 10_000 });
  await expect(panel.getByTestId("ask-error")).toHaveText("Cancelled.");
});

test("Settings → AI shows what the indicator shows", async ({ page }) => {
  await page.goto(`${app.base}/en/settings#ai`);
  await expect(page.getByTestId("ai-indicator")).toHaveAttribute("data-tone", "ok");
  await expect(page.getByTestId("set-ai")).toHaveAttribute("data-state", "available");
  await expect(page.getByTestId("page-title")).toHaveText("Settings");
});
