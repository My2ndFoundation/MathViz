import { describe, expect, test } from "bun:test";
import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import {
  AddonError,
  createAddonsClient,
  type InstalledAddon,
  refusal,
} from "../../app/src/lib/addons/client";
import { createFakeAddons } from "../../app/src/lib/addons/fake";
import { createAddonSync } from "../../app/src/lib/addons/sync";
import { fakeAddonsEnabled } from "../../app/src/lib/server/context";
import { addonJson, tmp } from "../helpers/content-fixtures";

/**
 * The add-on platform client (refusal mapping, list with ETag / 304, "not ours" filtering), the
 * installed-set sync (onChange only on a change) and the development fake's gate and life cycle.
 * No web-version content: the rows and payloads are synthetic.
 */

const APP = "app.primeforge.mathviz.python";
const ID = `${APP}/content`;

type Reply = { status: number; body?: unknown; etag?: string };

/** A client whose fetch answers from `reply` and records what it was asked. */
function clientWith(reply: (url: string, init: RequestInit) => Reply) {
  const calls: { url: string; init: RequestInit }[] = [];
  const client = createAddonsClient({
    apiUrl: "http://platform.test/",
    secret: "s3cret",
    appId: APP,
    fetch: async (url, init) => {
      calls.push({ url, init });
      const r = reply(url, init);
      return new Response(r.status === 304 ? null : JSON.stringify(r.body ?? null), {
        status: r.status,
        headers: r.etag ? { etag: r.etag } : {},
      });
    },
  });
  return { client, calls };
}

const row = (over: Record<string, unknown> = {}) => ({
  addonId: ID,
  kind: "content",
  title: "Content",
  owned: true,
  state: "owned",
  ...over,
});

describe("refusal mapping", () => {
  const cases: [number, unknown, string][] = [
    [409, { action: "get", productId: "p1" }, "addon_not_owned"],
    [409, { error: "app_too_old", minAppVersion: "2.0.0" }, "app_too_old"],
    [409, { error: "signed_out" }, "signed_out"],
    [409, { error: "app_not_installed" }, "app_not_installed"],
    [409, { error: "installing" }, "installing"],
    [503, { error: "offline" }, "offline"],
    [503, { error: "not_configured" }, "unsupported"],
    [403, { error: "addons_not_declared" }, "unsupported"],
    [404, { error: "not_found" }, "not_found"],
    [409, { error: "dependency_cycle", addonId: "x" }, "dependency_cycle"],
    [409, { error: "dependency_unavailable", addonId: "x" }, "dependency_unavailable"],
    [409, { error: "something_new" }, "bad_reply"],
    [500, null, "bad_reply"],
  ];
  for (const [status, body, code] of cases) {
    test(`${status} ${JSON.stringify(body)} → ${code}`, () => {
      expect(refusal(status, body).code).toBe(code as AddonError["code"]);
    });
  }

  test("addon_not_owned keeps the productId, app_too_old the minAppVersion", () => {
    expect(refusal(409, { action: "get", productId: "p1" }).productId).toBe("p1");
    expect(refusal(409, { error: "app_too_old", minAppVersion: "2.0.0" }).minAppVersion).toBe(
      "2.0.0",
    );
  });

  test("install surfaces the refusal; the id travels encoded once, with the bearer", async () => {
    const { client, calls } = clientWith(() => ({ status: 409, body: { error: "signed_out" } }));
    const e = await client.install(ID).catch((x) => x);
    expect(e).toBeInstanceOf(AddonError);
    expect((e as AddonError).code).toBe("signed_out");
    expect(calls[0]?.url).toBe(`http://platform.test/addons/v1/${encodeURIComponent(ID)}/install`);
    expect(calls[0]?.url).toContain("%2F");
    expect(((calls[0]?.init.headers ?? {}) as Record<string, string>).authorization).toBe(
      "Bearer s3cret",
    );
  });

  test("install / update accept 200 and 202 with a state; get accepts 202", async () => {
    const { client } = clientWith((url) =>
      url.endsWith("/get")
        ? { status: 202, body: { opened: true } }
        : url.endsWith("/install")
          ? { status: 202, body: { state: "installing" } }
          : { status: 200, body: { state: "installed" } },
    );
    expect(await client.install(ID)).toEqual({ state: "installing" });
    expect(await client.update(ID)).toEqual({ state: "installed" });
    expect(await client.get(ID)).toEqual({ opened: true });
  });

  test("a platform that does not answer is unreachable", async () => {
    const client = createAddonsClient({
      apiUrl: "http://platform.test",
      secret: "s",
      appId: APP,
      fetch: async () => {
        throw new TypeError("fetch failed");
      },
    });
    expect(((await client.list().catch((x) => x)) as AddonError).code).toBe("unreachable");
  });
});

describe("list", () => {
  test("rows parsed, another app's and malformed rows dropped, the ETag kept", async () => {
    const { client } = clientWith(() => ({
      status: 200,
      etag: '"e1"',
      body: {
        offline: false,
        addons: [row(), row({ addonId: "app.primeforge.other/content" }), { addonId: ID }],
      },
    }));
    const r = await client.list();
    if (r.notModified) throw new Error("expected a list");
    expect(r.etag).toBe('"e1"');
    expect(r.list.supported).toBe(true);
    expect(r.list.addons.map((a) => a.addonId)).toEqual([ID]);
    expect(r.list.addons[0]?.installedVersion).toBeNull();
  });

  test("If-None-Match is sent, and a 304 is notModified with the ETag", async () => {
    const { client, calls } = clientWith(() => ({ status: 304, etag: '"e1"' }));
    expect(await client.list('"e1"')).toEqual({ notModified: true, etag: '"e1"' });
    expect(((calls[0]?.init.headers ?? {}) as Record<string, string>)["if-none-match"]).toBe(
      '"e1"',
    );
  });

  test("404, 403 and 503 not_configured read as unsupported; 503 offline throws", async () => {
    for (const r of [
      { status: 404 },
      { status: 403 },
      { status: 503, body: { error: "not_configured" } },
    ]) {
      const got = await clientWith(() => r).client.list();
      expect(got).toEqual({
        notModified: false,
        etag: null,
        list: { supported: false, offline: false, addons: [] },
      });
    }
    const off = clientWith(() => ({ status: 503, body: { error: "offline" } })).client;
    expect(((await off.list().catch((x) => x)) as AddonError).code).toBe("offline");
  });

  test("supported: false in the body is kept", async () => {
    const { client } = clientWith(() => ({
      status: 200,
      body: { supported: false, offline: false, addons: [] },
    }));
    const r = await client.list();
    expect(!r.notModified && r.list.supported).toBe(false);
  });

  test("installed: only this app's; 404 / 503 not_configured → unsupported", async () => {
    const mine = { addonId: ID, kind: "content", version: "1.0.0", path: "/x" };
    const other = { ...mine, addonId: "app.primeforge.other/content" };
    const ok = clientWith(() => ({ status: 200, body: { addons: [mine, other] } })).client;
    expect(await ok.installed()).toEqual([mine]);
    expect(await clientWith(() => ({ status: 404 })).client.installed()).toBe("unsupported");
    expect(
      await clientWith(() => ({
        status: 503,
        body: { error: "not_configured" },
      })).client.installed(),
    ).toBe("unsupported");
  });
});

describe("installed-set sync", () => {
  const a = (version: string): InstalledAddon => ({
    addonId: ID,
    kind: "content",
    version,
    path: `/addons/content/${version}/payload`,
  });

  function harness(first: InstalledAddon[] | "unsupported") {
    let answer: InstalledAddon[] | "unsupported" | Error = first;
    let changes = 0;
    const sync = createAddonSync({
      client: {
        async installed() {
          if (answer instanceof Error) throw answer;
          return answer;
        },
      },
      onChange: async () => {
        changes++;
      },
    });
    return {
      sync,
      set: (x: typeof answer) => {
        answer = x;
      },
      changes: () => changes,
    };
  }

  test("onChange runs only when the installed set changes", async () => {
    const h = harness([]);
    h.sync.observe([]); // what the content was located with
    expect(await h.sync.refresh()).toBe(false);
    expect(h.changes()).toBe(0);
    h.set([a("1.0.0")]);
    expect(await h.sync.refresh()).toBe(true);
    expect(h.changes()).toBe(1);
    expect(await h.sync.refresh()).toBe(false);
    h.set([a("1.1.0")]);
    expect(await h.sync.refresh()).toBe(true);
    h.set("unsupported");
    expect(await h.sync.refresh()).toBe(true);
    expect(h.changes()).toBe(3);
  });

  test("order does not count as a change; a failing platform is no change", async () => {
    const other = { ...a("2.0.0"), addonId: `${APP}/extra` };
    const h = harness([a("1.0.0"), other]);
    h.sync.observe([other, a("1.0.0")]);
    expect(await h.sync.refresh()).toBe(false);
    h.set(new Error("down"));
    expect(await h.sync.refresh()).toBe(false);
    expect(h.changes()).toBe(0);
  });

  test("observe() moves the baseline: an answer the content already used is no change", async () => {
    const h = harness([a("1.0.0")]);
    h.sync.observe([a("1.0.0")]);
    expect(await h.sync.refresh()).toBe(false);
    expect(h.changes()).toBe(0);
  });

  test("concurrent refreshes share runs (one running, one queued)", async () => {
    let calls = 0;
    const sync = createAddonSync({
      client: {
        async installed() {
          calls++;
          await new Promise((r) => setTimeout(r, 5));
          return [];
        },
      },
      onChange: async () => {},
    });
    await Promise.all([sync.refresh(), sync.refresh(), sync.refresh(), sync.refresh()]);
    expect(calls).toBe(2);
  });

  test("installed() throwing inside onChange (the locate) clears the baseline: the next refresh reloads (review I1)", async () => {
    let fail = false;
    let changes = 0;
    let served = null as string | null;
    const answer = [a("1.0.0")];
    const sync: ReturnType<typeof createAddonSync> = createAddonSync({
      client: { installed: async () => answer },
      onChange: async () => {
        changes++;
        // as context.ts: locate asks installed() through a wrapper; a failure forgets the baseline
        try {
          if (fail) throw new Error("timeout");
          sync.observe(answer);
          served = "store";
        } catch {
          sync.forget();
          served = null;
        }
      },
    });
    fail = true;
    expect(await sync.refresh()).toBe(true);
    expect(served).toBeNull();
    fail = false;
    expect(await sync.refresh()).toBe(true);
    expect(served).toBe("store");
    expect(changes).toBe(2);
    expect(await sync.refresh()).toBe(false);
  });

  test("onChange rejecting: refresh() still resolves, the queue keeps working, the next tick retries (review M1)", async () => {
    let reject = true;
    let changes = 0;
    const logged: string[] = [];
    const sync = createAddonSync({
      client: {
        async installed() {
          await new Promise((r) => setTimeout(r, 5));
          return [a("1.0.0")];
        },
      },
      onChange: async () => {
        changes++;
        if (reject) throw new Error("EACCES");
      },
      log: (e) => logged.push(e),
    });
    // one running (it rejects inside), one queued behind it: both must resolve
    const [first, second] = await Promise.all([sync.refresh(), sync.refresh()]);
    expect(first).toBe(true);
    expect(second).toBe(true); // the baseline was cleared, so the queued run reloads again
    expect(logged).toContain("addons.reload_failed");
    reject = false;
    expect(await sync.refresh()).toBe(true);
    expect(await sync.refresh()).toBe(false);
    expect(changes).toBe(3);
  });

  test("without a client nothing runs", async () => {
    const sync = createAddonSync({ client: null, onChange: async () => {} });
    expect(await sync.refresh()).toBe(false);
  });
});

describe("the development fake", () => {
  test("honoured in development, and in a production build only with MATHVIZ_E2E=1", () => {
    const on = { MATHVIZ_FAKE_ADDONS: "1", MATHVIZ_FAKE_ADDONS_DIR: "/x" };
    expect(fakeAddonsEnabled(on)).toBe(true);
    expect(fakeAddonsEnabled({ ...on, NODE_ENV: "production" })).toBe(false);
    expect(fakeAddonsEnabled({ ...on, NODE_ENV: "production", MATHVIZ_E2E: "1" })).toBe(true);
    expect(fakeAddonsEnabled({ ...on, MATHVIZ_FAKE_ADDONS: "0" })).toBe(false);
    expect(fakeAddonsEnabled({ MATHVIZ_FAKE_ADDONS: "1" })).toBe(false);
  });

  function store(version = "1.2.0") {
    const root = tmp("fake-store");
    mkdirSync(join(root, "content", "payload"), { recursive: true });
    writeFileSync(join(root, "content", "addon.json"), addonJson(APP, version));
    writeFileSync(join(root, "content", "payload", "catalog.json"), "{}");
    // not this app's pack: ignored
    mkdirSync(join(root, "junk", "payload"), { recursive: true });
    return root;
  }

  test("owned → installing with progress → installed, reported at the payload in place", async () => {
    let now = 1000;
    const root = store();
    const fake = createFakeAddons({
      appId: APP,
      root,
      stateFile: join(tmp("fake-state"), "s.json"),
      now: () => now,
      installMs: 100,
    });
    const first = await fake.list();
    if (first.notModified) throw new Error("expected a list");
    expect(first.list.addons.map((r) => [r.addonId, r.state])).toEqual([[ID, "owned"]]);
    expect(await fake.list(first.etag)).toEqual({ notModified: true, etag: first.etag as string });
    expect(await fake.install(ID)).toEqual({ state: "installing" });
    now += 50;
    const mid = await fake.list();
    expect(!mid.notModified && mid.list.addons[0]?.state).toBe("installing");
    expect(!mid.notModified && (mid.list.addons[0]?.progress?.receivedBytes ?? 0) > 0).toBe(true);
    expect(await fake.installed()).toEqual([]);
    now += 60;
    expect(await fake.installed()).toEqual([
      { addonId: ID, kind: "content", version: "1.2.0", path: join(root, "content", "payload") },
    ]);
    expect(await fake.install(ID)).toEqual({ state: "installed" });
  });

  test("a paid pack refuses install with addon_not_owned", async () => {
    const fake = createFakeAddons({
      appId: APP,
      root: store(),
      stateFile: join(tmp("fake-state"), "s.json"),
      paid: ["content"],
    });
    const r = await fake.list();
    expect(!r.notModified && r.list.addons[0]?.state).toBe("available");
    expect(((await fake.install(ID).catch((x) => x)) as AddonError).code).toBe("addon_not_owned");
  });
});
