import { readFileSync } from "node:fs";
import { expect, type Page, test } from "@playwright/test";
import { fakeStoreEnv, type RunningApp, startApp, storeDir } from "./setup";

/**
 * Settings and the store install (PR B: items 4 and 5 of the owner's AI feedback). The store is
 * the development fake (fakeStoreEnv) serving the same python pack the other specs import; counts
 * and ids come from the extracted catalog (E2E_CATALOG), never from here.
 */

const base = () => process.env.E2E_BASE as string;
const firstTool = (): string => {
  const cat = JSON.parse(readFileSync(process.env.E2E_CATALOG as string, "utf8")) as {
    items: { id: string; order: number }[];
  };
  const first = [...cat.items].sort((a, b) => a.order - b.order)[0];
  if (!first) throw new Error("empty pack");
  return first.id;
};

function watch(page: Page) {
  const errors: string[] = [];
  page.on("console", (m) => {
    if (m.type() === "error") errors.push(`${m.location().url}: ${m.text()}`);
  });
  page.on("pageerror", (e) => errors.push(`pageerror: ${e.message}`));
  return errors;
}

const noNewWindows = async (page: Page) => {
  expect(await page.locator('[target="_blank"], [target="_new"]').count()).toBe(0);
  expect(await page.content()).not.toContain("window.open");
};

test("Settings: the sidebar links to it; the AI reply language saves and survives a reload", async ({
  page,
}) => {
  const errors = watch(page);
  await page.goto(`${base()}/en/tool/${encodeURIComponent(firstTool())}`);
  await page.getByTestId("nav-settings").click();
  await expect(page).toHaveURL(`${base()}/en/settings`);
  await expect(page.getByTestId("nav-settings")).toHaveAttribute("aria-current", "page");
  await expect(page.getByTestId("settings-panel-general")).toBeVisible();
  // every section is mounted; only the chosen one shows
  await expect(page.getByTestId("settings-panel-content")).toBeHidden();
  await noNewWindows(page);

  const aiLang = page.getByTestId("set-ai-lang");
  await expect(aiLang.getByLabel("Same as the page (default)")).toBeChecked();
  await aiLang.getByLabel("简体中文").check();
  await expect(page.getByTestId("save-status")).toHaveText("Saved");
  await page.reload();
  await expect(page.getByTestId("set-ai-lang").getByLabel("简体中文")).toBeChecked();
  const stored = await (await page.request.get(`${base()}/api/settings`)).json();
  expect(stored.aiLang).toBe("zh");
  // back to the default: the other specs share this app
  await page.getByTestId("set-ai-lang").getByLabel("Same as the page (default)").check();
  await expect(page.getByTestId("save-status")).toHaveText("Saved");
  expect((await (await page.request.get(`${base()}/api/settings`)).json()).aiLang).toBe("page");
  expect(errors).toEqual([]);
});

test("Settings: the section is in the URL hash; the content section shows the installed version", async ({
  page,
}) => {
  await page.goto(`${base()}/en/settings#content`);
  await expect(page.getByTestId("settings-panel-content")).toBeVisible();
  await expect(page.getByTestId("settings-panel-general")).toBeHidden();
  await expect(page.getByTestId("set-installed-version")).toHaveText(
    `Version ${process.env.E2E_CONTENT_VERSION}`,
  );
  await expect(page.getByTestId("set-installed")).toContainText("imported from a file");
  // no platform in this app: the store says so in one line, the import stays
  await expect(page.getByTestId("online-notice")).toBeVisible();
  await expect(page.getByTestId("import-button")).toBeVisible();
  await page.getByTestId("settings-tab-ai").click();
  await expect(page).toHaveURL(`${base()}/en/settings#ai`);
  await expect(page.getByTestId("set-ai")).toHaveAttribute("data-state", "unavailable");
  await noNewWindows(page);
});

test.describe("the content pack from the store", () => {
  let app: RunningApp;
  test.beforeAll(async () => {
    app = await startApp({ env: fakeStoreEnv(storeDir(process.env.E2E_PFADDON as string)) });
  });
  test.afterAll(async () => {
    await app?.stop();
  });

  test("the empty state installs it in one click, with progress, then opens the first tool", async ({
    page,
  }) => {
    const errors = watch(page);
    await page.goto(`${app.base}/`);
    await expect(page).toHaveURL(`${app.base}/en/empty`);
    const action = page.getByTestId("online-action");
    await expect(action).toHaveText("Install");
    await noNewWindows(page);
    await action.click();
    await expect(page.getByTestId("online-progress")).toBeVisible();
    await expect(page).toHaveURL(`${app.base}/en/tool/${encodeURIComponent(firstTool())}`, {
      timeout: 30_000,
    });
    await expect(page.getByTestId("sidebar")).toBeVisible();

    await page.getByTestId("nav-settings").click();
    await page.getByTestId("settings-tab-content").click();
    await expect(page.getByTestId("set-installed")).toContainText("from the PrimeForge store");
    await expect(page.getByTestId("set-installed-version")).toHaveText(
      `Version ${process.env.E2E_CONTENT_VERSION}`,
    );
    await expect(page.getByTestId("online-installed")).toBeDisabled();
    expect(errors).toEqual([]);
  });
});
