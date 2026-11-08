import { readFileSync } from "node:fs";
import { expect, type Frame, type Page, test } from "@playwright/test";
import { TARGET } from "./setup";

/**
 * Saving files in PrimeForge's window (design §5.3: `blob:` downloads are refused, a same-origin
 * `<a download>` is saved): a tool page's own `blob:` export goes through /api/exports
 * (components/save-file bridgeDownloads), and the maths app's video recorder — the web shell's,
 * generated from app.html (scripts/recorder.ts) — records a clip and saves it the same way.
 */

interface Catalog {
  items: { id: string; order: number }[];
}
const base = () => process.env.E2E_BASE as string;
const firstTool = () =>
  [...(JSON.parse(readFileSync(process.env.E2E_CATALOG as string, "utf8")) as Catalog).items].sort(
    (a, b) => a.order - b.order,
  )[0]?.id as string;

const toolFrame = async (page: Page): Promise<Frame> => {
  await expect(page.getByTestId("tool-frame")).toHaveAttribute("src", /./);
  const frame = await (await page.getByTestId("tool-frame").elementHandle())?.contentFrame();
  if (!frame) throw new Error("no tool frame");
  await frame.waitForLoadState("load");
  return frame;
};

test("a tool page's blob: export is saved through the app, even when the page revokes at once", async ({
  page,
}) => {
  await page.goto(`${base()}/en/tool/${firstTool()}`);
  const frame = await toolFrame(page);
  // the shell bridges the frame from its own load handler, which can run just after Playwright
  // sees the frame loaded (a student never clicks within that instant)
  await frame.waitForFunction(() => (window as { __mvDownloads?: true }).__mvDownloads === true);
  const saved = page.waitForEvent("download");
  // what the export pages do: a blob URL, an <a download>, click, revoke straight away
  await frame.evaluate(() => {
    const blob = new Blob([JSON.stringify({ hello: "export" })], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "tool-export.json";
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  });
  const d = await saved;
  expect(d.suggestedFilename()).toBe("tool-export.json");
  expect(d.url()).toMatch(new RegExp(`^${base()}/api/exports/[0-9a-f]{32}$`));
  expect(readFileSync(await d.path(), "utf8")).toBe('{"hello":"export"}');
});

test("the tool pages allow eval on the maths app only (the recorder reads the tool through it)", async ({
  page,
}) => {
  await page.goto(`${base()}/en/tool/${firstTool()}`);
  const src = (await page.getByTestId("tool-frame").getAttribute("src")) as string;
  const res = await page.request.get(`${base()}${src}`);
  const csp = res.headers()["content-security-policy"] as string;
  expect(csp.includes("'unsafe-eval'")).toBe(TARGET === "math");
  // and the shell's own policy never
  const shell = await page.request.get(`${base()}/en/tool/${firstTool()}`);
  expect(shell.headers()["content-security-policy"]).not.toContain("'unsafe-eval'");
});

test("the recorder: math only; a short offline clip is recorded and saved", async ({ page }) => {
  test.setTimeout(180_000);
  await page.goto(`${base()}/en/tool/${firstTool()}`);
  await toolFrame(page);
  const btn = page.getByTestId("rec-btn");
  if (TARGET !== "math") {
    await expect(btn).toHaveCount(0);
    return;
  }
  await expect(btn).toHaveText("Record");
  // it floats over the frame's area, not over the ask panel
  const stage = (await page.getByTestId("rec-stage").boundingBox()) as DOMRect;
  const b = (await btn.boundingBox()) as DOMRect;
  expect(b.x + b.width).toBeLessThanOrEqual(stage.x + stage.width);
  await btn.click();
  const panel = page.getByTestId("rec-panel");
  await expect(panel).toBeVisible();
  await expect(panel).toContainText("Offline");
  await panel.locator("#recDur").fill("3");
  const saved = page.waitForEvent("download", { timeout: 150_000 });
  await panel.locator("#recGo").click();
  const d = await saved;
  expect(d.suggestedFilename()).toMatch(
    new RegExp(`^${firstTool()}-16x9-1080p-[0-9.]+s\\.(mp4|webm)$`),
  );
  expect(d.url()).toMatch(/\/api\/exports\/[0-9a-f]{32}$/);
  const size = readFileSync(await d.path()).byteLength;
  expect(size).toBeGreaterThan(10_000);
  // the frame is back where it was
  await expect(page.getByTestId("rec-stage")).not.toHaveClass(/rec-live/);
  expect(await page.getByTestId("tool-frame").evaluate((f) => (f as HTMLElement).style.width)).toBe(
    "",
  );
});
