import { readFileSync } from "node:fs";
import { connect } from "node:net";
import { networkInterfaces } from "node:os";
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
 * The python app end to end (plan Task 12), started as PrimeForge starts it (app/primeforge-entry.mjs)
 * with the fake platform behind PRIMEFORGE_API_URL and the extracted python pack installed:
 *
 *  - every python page of the web version's registry opens in the shell with 0 console errors and
 *    0 CSP violations (the page count is the registry's, never written here);
 *  - fill-in mode in the iframe makes the shell's "get a hint" available;
 *  - a question about a program is answered; "ask the whole library" answers with citations that
 *    open the program in its tool (`?prog=`);
 *  - the entry listens on 127.0.0.1 only (PrimeForge's app window shows only that origin);
 *  - stopped (SIGTERM) and started again on another port with the same PRIMEFORGE_DATA_DIR, the
 *    note and the question's thread are still there (design §2, anti-goal 4).
 */

type Bi = { en: string; zh: string };
interface Catalog {
  items: { id: string; file: string; order: number; title: Bi }[];
}
interface Registry {
  tools: { id: string; file: string }[];
}
interface ThreadJson {
  id: string;
  messages: { role: string; text: string }[];
}

const MV = path.resolve(__dirname, "..", "..", "..");
const catalog = (): Catalog => JSON.parse(readFileSync(process.env.E2E_CATALOG as string, "utf8"));
const ordered = () => [...catalog().items].sort((a, b) => a.order - b.order);
const registryPages = (): Registry["tools"] =>
  (
    JSON.parse(readFileSync(path.join(MV, "python", "python-tools.json"), "utf8")) as Registry
  ).tools.filter((t) => path.basename(t.file) !== "_skeleton.html");
const programTool = (programId: string): string =>
  JSON.parse(
    readFileSync(
      path.join(path.dirname(process.env.E2E_CATALOG as string), "source", `${programId}.json`),
      "utf8",
    ),
  ).tool;

let fake: FakePlatformProcess;
let app: RunningApp;
/** What the Q&A test left behind for the restart test. */
const saved: { threadId?: string; question?: string } = {};

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

const toolFrame = async (page: Page): Promise<Frame> => {
  await expect(page.getByTestId("tool-frame")).toHaveAttribute("src", /./);
  const frame = await (await page.getByTestId("tool-frame").elementHandle())?.contentFrame();
  if (!frame) throw new Error("no tool frame");
  // the src is set, but the frame may still be on its initial about:blank, which is already
  // "loaded": wait for the navigation to the tool page itself (seen flaking in a full run)
  await expect.poll(() => frame.url()).not.toBe("about:blank");
  await frame.waitForLoadState("load");
  return frame;
};

const cspOf = (frame: Frame): Promise<string[]> =>
  frame.evaluate(() => (window as unknown as { __csp?: string[] }).__csp ?? []);

/** Whether a TCP connection to host:port is accepted. */
const accepts = (host: string, port: number): Promise<boolean> =>
  new Promise((resolve) => {
    const s = connect({ host, port });
    s.setTimeout(1_000);
    s.once("connect", () => {
      s.destroy();
      resolve(true);
    });
    s.once("error", () => resolve(false));
    s.once("timeout", () => {
      s.destroy();
      resolve(false);
    });
  });

test("the entry listens on 127.0.0.1 and on no other address", async () => {
  expect(await accepts("127.0.0.1", app.port)).toBe(true);
  const others = ["::1"];
  for (const list of Object.values(networkInterfaces())) {
    for (const a of list ?? []) if (!a.internal) others.push(a.address);
  }
  // a refusal is immediate; an address that drops the connection times out — all at once
  const got = await Promise.all(others.map(async (h) => [h, await accepts(h, app.port)]));
  expect(got.filter(([, ok]) => ok)).toEqual([]);
});

test("every python page of the registry opens with 0 console errors and 0 CSP violations", async ({
  page,
}) => {
  test.setTimeout(600_000);
  const registry = registryPages();
  const items = ordered();
  // the pack carries exactly the registry's pages: none missing, none extra
  expect(items.map((i) => i.id).sort()).toEqual(registry.map((t) => t.id).sort());
  expect(items.length).toBeGreaterThan(0);

  let current = "";
  const problems: string[] = [];
  page.on("console", (m) => {
    if (m.type() === "error") problems.push(`${current}: console.error ${m.text()}`);
  });
  page.on("pageerror", (e) => problems.push(`${current}: pageerror ${e.message}`));

  for (const it of items) {
    current = it.id;
    await page.goto(`${app.base}/en/tool/${it.id}`);
    const frame = await toolFrame(page);
    expect(new URL(frame.url()).pathname, it.id).toMatch(new RegExp(`/${it.file}$`));
    await expect(frame.locator("body"), it.id).not.toBeEmpty();
    // the page reports its state over the bridge once it has run: its scripts are done
    await expect(page.getByTestId("tool-frame"), it.id).toHaveAttribute(
      "data-py-mode",
      /^(read|blank|trace)$/,
    );
    await page.waitForTimeout(250);
    for (const v of await cspOf(frame)) problems.push(`${it.id}: CSP (tool page) ${v}`);
    for (const v of await cspOf(page.mainFrame())) problems.push(`${it.id}: CSP (shell) ${v}`);
  }
  // one list, so a failure names every page that broke
  expect(problems).toEqual([]);
});

test("fill-in mode in the iframe makes the shell's “get a hint” available", async ({ page }) => {
  const first = ordered()[0];
  if (!first) throw new Error("empty pack");
  await page.goto(`${app.base}/en/tool/${first.id}`);
  const frameEl = page.getByTestId("tool-frame");
  const frame = await toolFrame(page);
  const hint = page.getByTestId("ask-hint");
  // the mode buttons end in their key: "Read  1", "Fill in  2", "Trace  3" (en)
  await frame.getByRole("button", { name: /\s1$/ }).click();
  await expect(frameEl).toHaveAttribute("data-py-mode", "read");
  await expect(hint).toBeDisabled();
  await frame.getByRole("button", { name: /\s2$/ }).click();
  await expect(frameEl).toHaveAttribute("data-py-mode", "blank");
  // a hint is for one blank: the page reports the focused one
  await frame.locator("textarea").first().focus();
  await expect(hint).toBeEnabled();
});

test("a question about a program is answered (and saved as a note)", async ({ page }) => {
  const first = ordered()[0];
  if (!first) throw new Error("empty pack");
  await page.goto(`${app.base}/en/tool/${first.id}`);
  const frameEl = page.getByTestId("tool-frame");
  await expect(frameEl).toHaveAttribute("data-py-prog", /./);
  const panel = page.getByTestId("ask-panel");
  const question = `What does this program print, and why? (${Date.now()})`;
  await panel.getByTestId("ask-input").fill(question);
  const posted = page.waitForResponse(
    (r) => r.request().method() === "POST" && new URL(r.url()).pathname === "/api/threads",
  );
  await panel.getByTestId("ask-submit").click();
  const res = await posted;
  expect(res.status()).toBe(202);
  saved.threadId = ((await res.json()) as { threadId: string }).threadId;
  saved.question = question;

  const answer = panel.locator('[data-testid=qa-message][data-role="assistant"]');
  await expect(answer).toContainText("which kind of division", { timeout: 30_000 });
  await answer.getByTestId("save-note").click();
  await expect(answer.getByTestId("note-saved")).toBeVisible();
});

test("ask the whole library: the answer's citations are links; one opens the program with ?prog=", async ({
  page,
}) => {
  await page.goto(`${app.base}/en/ask`);
  await page.getByTestId("library-input").fill("Fahrenheit");
  await page.getByTestId("library-submit").click();
  const answer = page.locator('[data-testid=qa-message][data-role="assistant"]');
  await expect(answer).toContainText("worked program", { timeout: 30_000 });
  await expect(answer.getByTestId("citation").first()).toBeVisible();

  const cite = answer.locator('[data-testid=citation][data-id^="program:"]').first();
  const programId = ((await cite.getAttribute("data-id")) as string).slice("program:".length);
  await cite.click();
  await expect(page).toHaveURL(`${app.base}/en/tool/${programTool(programId)}?prog=${programId}`);
  await expect(page.getByTestId("tool-frame")).toHaveAttribute(
    "src",
    new RegExp(`[?&]prog=${programId}(&|$)`),
  );
  // and the page inside opened at that program
  await toolFrame(page);
  await expect(page.getByTestId("tool-frame")).toHaveAttribute("data-py-prog", programId);
});

test("restarted on another port with the same data directory, the note and the thread are still there", async ({
  page,
}) => {
  const { threadId, question } = saved;
  if (!threadId || !question) throw new Error("the Q&A test left no thread");
  const dataDir = app.dataDir;
  const oldPort = app.port;
  await app.stop();
  await fake.stop();

  let port = await freePort();
  while (port === oldPort) port = await freePort();
  fake = await startFakePlatform(port);
  app = await startApp({
    port,
    dataDir,
    env: { PRIMEFORGE_API_URL: fake.url, PRIMEFORGE_API_SECRET: fake.secret },
  });
  expect(app.port).not.toBe(oldPort);

  await page.goto(`${app.base}/en/notes`);
  const notes = page.getByTestId("notes-row");
  await expect(notes).toHaveCount(1);
  await expect(notes.first()).toContainText(question);
  // the newest conversation opens beside the list, its saved answer shown
  await expect(page.getByTestId("notes-detail")).toHaveAttribute("data-id", threadId);
  await expect(page.locator('[data-testid=qa-message][data-saved="true"]')).toContainText(
    "which kind of division",
  );

  const res = await page.request.get(`${app.base}/api/threads/${encodeURIComponent(threadId)}`);
  expect(res.status()).toBe(200);
  const thread = (await res.json()) as ThreadJson;
  expect(thread.messages.map((m) => m.role)).toEqual(["user", "assistant"]);
  expect(thread.messages[0]?.text).toBe(question);
  expect(thread.messages[1]?.text).toContain("which kind of division");

  // the content pack (a manual import in the same data directory) is still installed too
  await page.goto(`${app.base}/`);
  await expect(page.getByTestId("sidebar-item")).toHaveCount(catalog().items.length);
});
