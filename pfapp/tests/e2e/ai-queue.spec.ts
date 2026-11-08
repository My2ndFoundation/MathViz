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
  // asked on a python tool page, so about a program: its link opens that program in its tool,
  // and this conversation in its ask panel
  await expect(row.getByTestId("ai-queue-title")).toHaveAttribute(
    "href",
    /^\/en\/tool\/[^?]+\?prog=[^&]+&thread=[^&]+$/,
  );
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

/** A GET /api/ai/jobs body (the shape lib/server/ai-jobs answers), for page.route. */
const jobsBody = (state: "available" | "not_authorised", active = 0) => ({
  ai:
    state === "available"
      ? { available: true, reason: null, state }
      : { available: false, reason: "engine_not_granted", state },
  active: Array.from({ length: active }, (_, i) => ({
    id: `synthetic-${i}`,
    workflow: "ask",
    status: "running",
    threadId: `t-${i}`,
    title: `Synthetic job ${i}`,
    href: null,
    engine: "claude",
    model: null,
    error: null,
    createdAt: "2026-11-07T09:00:00.000Z",
    settledAt: null,
    durationMs: null,
  })),
  recent: [],
});

/** Answer GET /api/ai/jobs from `reply()` (an object as JSON, or a status code to fail with). */
async function fakeJobs(page: Page, reply: () => object | number) {
  await page.route("**/api/ai/jobs", async (route) => {
    const r = reply();
    if (typeof r === "number") await route.fulfill({ status: r, body: "{}" });
    else
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify(r),
      });
  });
}

const fireQueueEvent = (page: Page) =>
  page.evaluate(() => window.dispatchEvent(new Event("pfapp:ai-jobs")));

test("Settings → AI and the indicator are one reader: both turn together, and a failed read keeps the card's last answer", async ({
  page,
}) => {
  await page.goto(`${app.base}/en/settings#ai`);
  const indicator = page.getByTestId("ai-indicator");
  const card = page.getByTestId("set-ai");
  await expect(indicator).toHaveAttribute("data-tone", "ok");
  await expect(card).toHaveAttribute("data-state", "available");
  await expect(page.getByTestId("page-title")).toHaveText("Settings");

  // the engine is revoked after the page loaded: the next read turns both
  let reply: object | number = jobsBody("not_authorised");
  await fakeJobs(page, () => reply);
  await fireQueueEvent(page);
  await expect(indicator).toHaveAttribute("data-tone", "off");
  await expect(card).toHaveAttribute("data-state", "not_authorised");

  // a failed read: the light no longer claims to know; the card keeps the last answer (not page load)
  reply = 500;
  await fireQueueEvent(page);
  await expect(indicator).toHaveAttribute("data-tone", "unknown");
  await expect(card).toHaveAttribute("data-state", "not_authorised");
  // one reader for both: a read is one request, not one per component
  let requests = 0;
  page.on("request", (r) => {
    if (new URL(r.url()).pathname === "/api/ai/jobs") requests++;
  });
  reply = jobsBody("available");
  await fireQueueEvent(page);
  await expect(card).toHaveAttribute("data-state", "available");
  await expect(indicator).toHaveAttribute("data-tone", "ok");
  expect(requests).toBe(1);
});

test("a failed read keeps the queue's rows and their Cancel; becoming visible re-reads", async ({
  page,
}) => {
  let reply: object | number = jobsBody("available", 1);
  await fakeJobs(page, () => reply);
  await page.goto(`${app.base}/en/notes`);
  const indicator = page.getByTestId("ai-indicator");
  await expect(page.getByTestId("ai-indicator-count")).toHaveText("1");
  reply = 500;
  await indicator.click(); // opening the panel reads again, and that read fails
  const queue = page.getByTestId("ai-queue");
  await expect(indicator).toHaveAttribute("data-tone", "unknown");
  const row = queue.getByTestId("ai-queue-active").getByTestId("ai-queue-row");
  await expect(row).toHaveCount(1);
  await expect(row.getByTestId("ai-queue-cancel")).toBeVisible();
  await page.keyboard.press("Escape");

  // the window comes back (no focus event): visibilitychange alone re-reads
  reply = jobsBody("available", 2);
  await page.evaluate(() => document.dispatchEvent(new Event("visibilitychange")));
  await expect(page.getByTestId("ai-indicator-count")).toHaveText("2", { timeout: 5_000 });
  await expect(indicator).toHaveAttribute("data-tone", "ok");
});

test("the open queue panel is above the top-bar Ask toggle, the collapse edge and the narrow sidebar; Tab stays inside it", async ({
  page,
}) => {
  await page.setViewportSize({ width: 1280, height: 800 });
  await page.goto(`${app.base}/en/tool/${firstTool()}`);
  await expect(page.getByTestId("tool-frame")).toHaveAttribute("data-py-prog", /./);
  await page.getByTestId("ask-hide").click();
  const askToggle = page.getByTestId("ask-toggle");
  await expect(askToggle).toHaveAttribute("aria-pressed", "false");
  const tab = (await askToggle.boundingBox()) as {
    x: number;
    y: number;
    width: number;
    height: number;
  };
  const indicator = page.getByTestId("ai-indicator");
  await indicator.click();
  const queue = page.getByTestId("ai-queue");
  await expect(queue).toBeVisible();
  const cx = tab.x + tab.width / 2;
  const cy = tab.y + tab.height / 2;
  const topAt = (x: number, y: number) =>
    page.evaluate(
      ([px, py]) => {
        const el = document.elementFromPoint(px as number, py as number);
        return el?.closest("[data-testid=ai-queue-scrim]") ? "queue" : (el?.className ?? "none");
      },
      [x, y],
    );
  expect(await topAt(cx, cy)).toBe("queue");
  // a click where the Ask toggle is lands on the queue's scrim (the panel, or the outside that
  // closes it, depending on how wide the top bar's chips are), never on the toggle: the ask panel
  // stays hidden
  await page.mouse.click(cx, cy);
  await expect(page.getByTestId("ask-panel")).toBeHidden();
  await expect(askToggle).toHaveAttribute("aria-pressed", "false");
  if ((await queue.count()) === 0) await indicator.click();
  await expect(queue).toBeVisible();

  // Tab and Shift-Tab wrap inside the panel (aria-modal): never the page or the tool iframe behind
  for (let i = 0; i < 12; i++) {
    await page.keyboard.press("Tab");
    expect(await queue.evaluate((q) => q.contains(document.activeElement))).toBe(true);
  }
  for (let i = 0; i < 12; i++) {
    await page.keyboard.press("Shift+Tab");
    expect(await queue.evaluate((q) => q.contains(document.activeElement))).toBe(true);
  }
  await page.keyboard.press("Escape");
  await expect(queue).toHaveCount(0);

  // the collapse edge (sidebar collapsed)
  await page.getByTestId("sidebar").getByRole("button", { name: "Collapse sidebar" }).click();
  const edge = (await page.getByRole("button", { name: "Expand sidebar" }).boundingBox()) as {
    x: number;
    y: number;
    width: number;
    height: number;
  };
  await indicator.click();
  await expect(queue).toBeVisible();
  expect(await topAt(edge.x + edge.width / 2, edge.y + edge.height / 2)).toBe("queue");
  await page.keyboard.press("Escape");
  await page.getByRole("button", { name: "Expand sidebar" }).click();

  // a narrow window: the open sidebar floats; where it and the panel overlap, the panel is on top
  await page.setViewportSize({ width: 600, height: 700 });
  // the sidebar slides back in (0.22 s): measure it once it is there
  await expect.poll(async () => (await page.getByTestId("sidebar").boundingBox())?.x).toBe(0);
  await indicator.click();
  await expect(queue).toBeVisible();
  const sb = (await page.getByTestId("sidebar").boundingBox()) as { x: number; width: number };
  const q = (await queue.boundingBox()) as { x: number };
  expect(q.x).toBeLessThan(sb.x + sb.width);
  expect(await topAt((q.x + sb.x + sb.width) / 2, 300)).toBe("queue");
  await page.keyboard.press("Escape");
  await page.setViewportSize({ width: 1280, height: 800 });
});
