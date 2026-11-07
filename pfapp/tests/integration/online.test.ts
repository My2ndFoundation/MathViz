import {
  afterAll,
  afterEach,
  beforeAll,
  describe,
  expect,
  setDefaultTimeout,
  test,
} from "bun:test";
import { POST as getRoute } from "../../app/src/app/api/content/online/get/route";
import { POST as installRoute } from "../../app/src/app/api/content/online/install/route";
import { GET as onlineRoute } from "../../app/src/app/api/content/online/route";
import { POST as updateRoute } from "../../app/src/app/api/content/online/update/route";
import { contentAddonId } from "../../app/src/lib/content/pfaddon";
import { migrationsDir } from "../../app/src/lib/db/open";
import { CSRF_HEADER } from "../../app/src/lib/http/guard";
import { type AppContext, createAppContext, setAppContext } from "../../app/src/lib/server/context";
import { loadTarget } from "../../app/src/lib/target";
import { extractPayload, tmp } from "../helpers/content-fixtures";
import { type FakePlatform, startFakePlatform } from "./fake-platform";

/**
 * /api/content/online{,/install,/update,/get} against the fake platform's /addons/v1 over real
 * HTTP, through the real client: the one row of this app's content pack, ETag / 304, the refusals
 * as HTTP codes, and a finished store install reaching the served content (the sync behind the
 * list route). The payload is the real python one; nothing about its content is asserted.
 */

setDefaultTimeout(60_000);

const PY = loadTarget("python");
const MIGRATIONS = migrationsDir(`${import.meta.dir}/../..`);
const ORIGIN = `http://127.0.0.1:${PY.port}`;
const ID = contentAddonId(PY.appId);

let PAYLOAD = "";
let fake: FakePlatform | null = null;
let ctx: AppContext | null = null;

beforeAll(async () => {
  PAYLOAD = await extractPayload("python");
}, 60_000);

afterEach(async () => {
  setAppContext(null);
  ctx?.close();
  ctx = null;
  await fake?.close();
  fake = null;
});

afterAll(() => setAppContext(null));

async function start(
  setup: (f: FakePlatform, addonsDir: string) => void = () => {},
): Promise<{ c: AppContext; f: FakePlatform }> {
  const f = await startFakePlatform({ appPort: PY.port });
  fake = f;
  const addonsDir = tmp("online-addons");
  f.addons.supported = true;
  f.addons.addonsDir = addonsDir;
  f.addons.offer = { addonId: ID, version: "1.4.0", payload: PAYLOAD, title: "Python content" };
  setup(f, addonsDir);
  const c = await createAppContext(
    {
      PRIMEFORGE_DATA_DIR: tmp("online-data"),
      PRIMEFORGE_ADDONS_DIR: addonsDir,
      PRIMEFORGE_API_URL: f.url,
      PRIMEFORGE_API_SECRET: f.secret,
      MATHVIZ_TARGET: "python",
    },
    { migrationsDir: MIGRATIONS, log: () => {} },
  );
  ctx = c;
  setAppContext(c);
  return { c, f };
}

function req(path: string, init: RequestInit & { headers?: Record<string, string> } = {}) {
  return new Request(`${ORIGIN}${path}`, {
    ...init,
    headers: { host: `127.0.0.1:${PY.port}`, "sec-fetch-site": "same-origin", ...init.headers },
  });
}

const list = (headers: Record<string, string> = {}, q = "?lang=en") =>
  onlineRoute(req(`/api/content/online${q}`, { headers }));

const post = (c: AppContext, h: (r: Request) => Promise<Response>, verb: string, csrf = true) =>
  h(
    req(`/api/content/online/${verb}`, {
      method: "POST",
      headers: csrf ? { [CSRF_HEADER]: c.csrfToken } : {},
    }),
  );

describe("GET /api/content/online", () => {
  test("one row, this app's content pack (other rows dropped); ETag → 304", async () => {
    await start();
    const res = await list();
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.supported).toBe(true);
    expect(body.offline).toBe(false);
    expect(body.addon.addonId).toBe(ID);
    expect(body.addon.state).toBe("owned");
    expect(body.addon.latestVersion).toBe("1.4.0");
    expect(body.addon.summary).toBe("The tools and programs.");
    const etag = res.headers.get("etag");
    expect(etag).toMatch(/^"en~/);
    const again = await list({ "if-none-match": etag as string });
    expect(again.status).toBe(304);
    // the summary follows the asked language, and so does the ETag
    const zh = await list({ "if-none-match": etag as string }, "?lang=zh");
    expect(zh.status).toBe(200);
    expect((await zh.json()).addon.summary).toBe("工具与程序。");
  });

  test("an older desktop: supported false; a platform that does not answer: offline", async () => {
    const { f } = await start((x) => {
      x.addons.supported = false;
    });
    expect(await (await list()).json()).toEqual({ supported: false, offline: false, addon: null });
    await f.close();
    expect(await (await list()).json()).toEqual({ supported: true, offline: true, addon: null });
  });

  test("no platform at all: supported false, and the actions answer 503 unsupported", async () => {
    const c = await createAppContext(
      { PRIMEFORGE_DATA_DIR: tmp("online-none"), MATHVIZ_TARGET: "python" },
      { migrationsDir: MIGRATIONS, log: () => {} },
    );
    ctx = c;
    setAppContext(c);
    expect(await (await list()).json()).toEqual({ supported: false, offline: false, addon: null });
    const r = await post(c, installRoute, "install");
    expect(r.status).toBe(503);
    expect((await r.json()).error.code).toBe("unsupported");
  });

  test("the store without this app's pack: addon null", async () => {
    await start((x) => {
      x.addons.offer = null;
    });
    expect((await (await list()).json()).addon).toBeNull();
  });
});

describe("install / update / get", () => {
  test("install → 202 installing; the finished install becomes the served content", async () => {
    const { c, f } = await start();
    expect(c.content).toBeNull();
    const r = await post(c, installRoute, "install");
    expect(r.status).toBe(202);
    expect(await r.json()).toEqual({ state: "installing" });
    const mid = await (await list()).json();
    expect(mid.addon.state).toBe("installing");
    expect(mid.addon.progress).toEqual({ receivedBytes: 40, totalBytes: 100 });
    expect(c.content).toBeNull();
    f.finishInstall();
    // the list changed, so the route asked /installed again before answering
    const done = await (await list()).json();
    expect(done.addon.state).toBe("installed");
    expect(done.addon.installedVersion).toBe("1.4.0");
    expect(c.content?.source).toBe("store");
    expect(c.content?.version).toBe("1.4.0");
  });

  test("the 10 s poll (addonSync.refresh) notices an install the page never asked about", async () => {
    const { c, f } = await start();
    // nothing changed since the content was located: no reload
    expect(await c.addonSync.refresh()).toBe(false);
    await post(c, installRoute, "install");
    f.finishInstall();
    expect(c.content).toBeNull();
    expect(await c.addonSync.refresh()).toBe(true);
    expect(c.content?.version).toBe("1.4.0");
    expect(await c.addonSync.refresh()).toBe(false);
  });

  test("not owned → 409 addon_not_owned; get → 202 opened, the platform asked once", async () => {
    const { c, f } = await start((x) => {
      x.addons.owned = false;
    });
    expect((await (await list()).json()).addon.state).toBe("available");
    const r = await post(c, installRoute, "install");
    expect(r.status).toBe(409);
    expect((await r.json()).error).toEqual({
      code: "addon_not_owned",
      message: "error.addon_not_owned",
    });
    const g = await post(c, getRoute, "get");
    expect(g.status).toBe(202);
    expect(await g.json()).toEqual({ opened: true });
    expect(f.addons.gets).toBe(1);
  });

  const refusals: [number, unknown, number, string][] = [
    [409, { error: "signed_out" }, 409, "signed_out"],
    [409, { error: "app_too_old", minAppVersion: "9.0.0" }, 409, "app_too_old"],
    [409, { error: "app_not_installed" }, 409, "app_not_installed"],
    [409, { error: "installing" }, 409, "installing"],
    [503, { error: "offline" }, 503, "offline"],
    [503, { error: "not_configured" }, 503, "unsupported"],
    [409, { error: "dependency_cycle" }, 502, "addon_failed"],
  ];
  for (const [status, body, want, code] of refusals) {
    test(`a platform ${status} ${JSON.stringify(body)} → ${want} ${code}`, async () => {
      const { c } = await start((x) => {
        x.addons.refuse = { status, body };
      });
      const r = await post(c, updateRoute, "update");
      expect([r.status, (await r.json()).error.code]).toEqual([want, code]);
    });
  }

  test("an update of the newest version answers 200 installed", async () => {
    const { c, f } = await start();
    await post(c, installRoute, "install");
    f.finishInstall();
    const r = await post(c, updateRoute, "update");
    expect([r.status, await r.json()]).toEqual([200, { state: "installed" }]);
    expect(c.content?.version).toBe("1.4.0");
  });

  test("the writes need the CSRF token", async () => {
    const { c, f } = await start();
    for (const [h, verb] of [
      [installRoute, "install"],
      [updateRoute, "update"],
      [getRoute, "get"],
    ] as const) {
      const r = await post(c, h, verb, false);
      expect([verb, r.status, (await r.json()).error.code]).toEqual([verb, 403, "bad_csrf"]);
    }
    expect(f.addons.installing).toBeNull();
    expect(f.addons.gets).toBe(0);
  });
});
