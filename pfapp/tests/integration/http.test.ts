import { afterAll, beforeAll, describe, expect, test } from "bun:test";
import { readFileSync, rmSync, symlinkSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { NextRequest } from "next/server";
import { GET as getSessionToken } from "../../app/src/app/api/session-token/route";
import { GET as getSettings, PUT as putSettings } from "../../app/src/app/api/settings/route";
import { GET as getToolFile } from "../../app/src/app/c/[ver]/tools/[file]/route";
import { importAddonFile } from "../../app/src/lib/content/manual-import";
import { migrationsDir } from "../../app/src/lib/db/open";
import { SHELL_CSP, TOOL_CACHE_CONTROL, TOOL_CSP } from "../../app/src/lib/http/csp";
import { CSRF_HEADER, processCsrfToken } from "../../app/src/lib/http/guard";
import { type AppContext, createAppContext, setAppContext } from "../../app/src/lib/server/context";
import { getAiLang, setAiLang } from "../../app/src/lib/server/settings";
import { loadTarget } from "../../app/src/lib/target";
import { proxy } from "../../app/src/proxy";
import { buildPfaddon, extractPayload, tmp } from "../helpers/content-fixtures";

/**
 * The browser-facing layer, called the way Next calls it: the route handlers with a Request (and
 * the params promise), the proxy with a NextRequest. The content is the real python payload from
 * this checkout, installed as a manual import into a temp DATA_DIR; nothing is hard-coded about it
 * but the target.
 */

const PY = loadTarget("python");
const MIGRATIONS = migrationsDir(join(import.meta.dir, "..", ".."));
const ORIGIN = `http://127.0.0.1:${PY.port}`;
const VERSION = "1.2.3";

let ctx: AppContext;
let PAYLOAD = "";
let catalogFiles: string[] = [];
const opened: AppContext[] = [];

async function contextFor(dataDir: string): Promise<AppContext> {
  const c = await createAppContext(
    { PRIMEFORGE_DATA_DIR: dataDir, MATHVIZ_TARGET: "python" },
    { migrationsDir: MIGRATIONS },
  );
  opened.push(c);
  return c;
}

beforeAll(async () => {
  PAYLOAD = await extractPayload("python");
  catalogFiles = (
    JSON.parse(readFileSync(join(PAYLOAD, "catalog.json"), "utf8")).items as { file: string }[]
  ).map((i) => i.file);
  const dataDir = tmp("http-data");
  await importAddonFile(buildPfaddon(PAYLOAD, PY.appId, VERSION), dataDir, PY.appId);
  ctx = await contextFor(dataDir);
  setAppContext(ctx);
}, 60_000);

afterAll(() => {
  setAppContext(null);
  for (const c of opened) c.close();
});

/** A request as the shell's own page sends it: right Host, same-origin. */
function req(path: string, init: RequestInit & { headers?: Record<string, string> } = {}) {
  return new Request(`${ORIGIN}${path}`, {
    ...init,
    headers: { host: `127.0.0.1:${PY.port}`, "sec-fetch-site": "same-origin", ...init.headers },
  });
}

const tool = (ver: string, file: string, headers: Record<string, string> = {}) =>
  getToolFile(req(`/c/${encodeURIComponent(ver)}/tools/${encodeURIComponent(file)}`, { headers }), {
    params: Promise.resolve({ ver, file }),
  });

const firstTool = () => (catalogFiles[0] as string).replace(/^tools\//, "");

describe("the content install", () => {
  test("the context found the manual import and indexed every catalog item", () => {
    expect(ctx.content?.version).toBe(VERSION);
    expect(ctx.content?.source).toBe("manual");
    expect(catalogFiles.length).toBeGreaterThan(0);
    const n = ctx.db.prepare("SELECT COUNT(*) AS n FROM catalog_items").get<{ n: number }>();
    expect(n?.n).toBe(catalogFiles.length);
  });
});

describe("GET /c/<ver>/tools/<file>", () => {
  test("every catalog file: 200, the pack's bytes, the exact CSP and Cache-Control", async () => {
    for (const rel of catalogFiles) {
      const res = await tool(VERSION, rel.replace(/^tools\//, ""));
      expect(res.status).toBe(200);
      expect(res.headers.get("content-type")).toBe("text/html; charset=utf-8");
      expect(res.headers.get("content-security-policy")).toBe(
        "default-src 'self'; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline'; img-src 'self' data: blob:; font-src 'self' data:; connect-src 'self'; frame-ancestors 'self'",
      );
      expect(res.headers.get("cache-control")).toBe("public, max-age=31536000, immutable");
      expect(res.headers.get("access-control-allow-origin")).toBeNull();
      const body = Buffer.from(await res.arrayBuffer());
      expect(body.equals(readFileSync(join(PAYLOAD, rel)))).toBe(true);
    }
  });

  test("a version other than the installed one → 404", async () => {
    for (const ver of ["0.0.0", "1.2.4", "", "1.2.3.0", "latest"]) {
      const res = await tool(ver, firstTool());
      expect(res.status).toBe(404);
      expect(res.headers.get("cache-control")).toBe("no-store");
    }
  });

  test("path traversal and names outside the catalog → 404", async () => {
    for (const file of [
      "../../etc/passwd",
      "..%2F..%2Fetc%2Fpasswd",
      "../catalog.json",
      "../provenance.json",
      "/etc/passwd",
      `${firstTool()}/`,
      `./${firstTool()}`,
      "no-such-tool.html",
      "",
    ]) {
      expect((await tool(VERSION, file)).status).toBe(404);
    }
  });

  test("a file in the pack's tools/ directory but not in catalog_items → 404", async () => {
    const dir = join(ctx.content?.dir as string, "tools");
    writeFileSync(join(dir, "t7-stray.html"), "<!doctype html><p>not in the catalog</p>");
    expect((await tool(VERSION, "t7-stray.html")).status).toBe(404);
  });

  test("a catalog file replaced by a symbolic link → 404, not the link's target", async () => {
    const dataDir = tmp("http-link");
    await importAddonFile(buildPfaddon(PAYLOAD, PY.appId, VERSION), dataDir, PY.appId);
    const c = await contextFor(dataDir);
    const rel = catalogFiles[0] as string;
    const p = join(c.content?.dir as string, rel);
    const elsewhere = join(tmp("http-elsewhere"), "secret.html");
    writeFileSync(elsewhere, "secret");
    rmSync(p);
    symlinkSync(elsewhere, p);
    setAppContext(c);
    try {
      expect((await tool(VERSION, firstTool())).status).toBe(404);
    } finally {
      setAppContext(ctx);
    }
  });

  test("no content installed → 404", async () => {
    const c = await contextFor(tmp("http-empty"));
    expect(c.content).toBeNull();
    setAppContext(c);
    try {
      expect((await tool(VERSION, firstTool())).status).toBe(404);
    } finally {
      setAppContext(ctx);
    }
  });

  test("the guard runs here too: cross-site Sec-Fetch-Site, foreign Host → 403", async () => {
    const cross = await tool(VERSION, firstTool(), { "sec-fetch-site": "cross-site" });
    expect(cross.status).toBe(403);
    expect((await cross.json()).error.code).toBe("cross_site");
    const host = await tool(VERSION, firstTool(), { host: "evil.example:80" });
    expect(host.status).toBe(403);
    expect((await host.json()).error.code).toBe("bad_host");
  });
});

describe("/api/settings", () => {
  test("a fresh install reads lang 'en' (target.defaultLang) and aiLang 'page'", async () => {
    const c = await contextFor(tmp("http-fresh"));
    setAppContext(c);
    try {
      const res = await getSettings(req("/api/settings"));
      expect(res.status).toBe(200);
      expect(await res.json()).toEqual({ lang: "en", aiLang: "page" });
    } finally {
      setAppContext(ctx);
    }
  });

  test("PUT without the CSRF token → 403; with it → 200, and GET reads the new value", async () => {
    const put = (headers: Record<string, string>, body: unknown) =>
      putSettings(
        req("/api/settings", {
          method: "PUT",
          body: JSON.stringify(body),
          headers: { "content-type": "application/json", ...headers },
        }),
      );

    const none = await put({}, { lang: "zh" });
    expect(none.status).toBe(403);
    expect((await none.json()).error.code).toBe("bad_csrf");
    const wrong = await put({ [CSRF_HEADER]: "0".repeat(64) }, { lang: "zh" });
    expect(wrong.status).toBe(403);
    expect((await getSettings(req("/api/settings"))).status).toBe(200);
    expect(await (await getSettings(req("/api/settings"))).json()).toEqual({
      lang: "en",
      aiLang: "page",
    });

    const tokenRes = await getSessionToken(req("/api/session-token"));
    expect(tokenRes.status).toBe(200);
    expect(tokenRes.headers.get("cache-control")).toBe("no-store");
    const { token } = (await tokenRes.json()) as { token: string };
    expect(token).toMatch(/^[0-9a-f]{64}$/);

    const ok = await put({ [CSRF_HEADER]: token }, { lang: "zh" });
    expect(ok.status).toBe(200);
    expect(await ok.json()).toEqual({ lang: "zh", aiLang: "page" });
    expect(await (await getSettings(req("/api/settings"))).json()).toEqual({
      lang: "zh",
      aiLang: "page",
    });
    const row = ctx.db.prepare("SELECT value FROM settings WHERE key = 'lang'").get<{
      value: string;
    }>();
    expect(row?.value).toBe("zh");

    for (const bad of [{ lang: "fr" }, { lang: 1 }, {}, []]) {
      expect((await put({ [CSRF_HEADER]: token }, bad)).status).toBe(400);
    }
    expect(await (await getSettings(req("/api/settings"))).json()).toEqual({
      lang: "zh",
      aiLang: "page",
    });

    // aiLang: on its own, with lang, and strictly checked; an unknown stored value reads 'page'
    const aiLang = async (body: unknown) => {
      const r = await put({ [CSRF_HEADER]: token }, body);
      return [r.status, await r.json()];
    };
    expect(await aiLang({ aiLang: "en" })).toEqual([200, { lang: "zh", aiLang: "en" }]);
    expect(await aiLang({ lang: "en", aiLang: "zh" })).toEqual([200, { lang: "en", aiLang: "zh" }]);
    expect(await aiLang({ aiLang: "page" })).toEqual([200, { lang: "en", aiLang: "page" }]);
    for (const bad of [{ aiLang: "fr" }, { aiLang: null }, { aiLang: "en", theme: "dark" }]) {
      expect((await put({ [CSRF_HEADER]: token }, bad)).status).toBe(400);
    }
    expect(getAiLang(ctx.db)).toBe("page");
    setAiLang(ctx.db, "zh");
    expect(getAiLang(ctx.db)).toBe("zh");
    ctx.db.prepare("UPDATE settings SET value = 'klingon' WHERE key = 'aiLang'").run();
    expect(getAiLang(ctx.db)).toBe("page");
    expect(await (await getSettings(req("/api/settings"))).json()).toEqual({
      lang: "en",
      aiLang: "page",
    });

    // a token from another process (another context) is not this one's
    const other = await contextFor(tmp("http-other"));
    expect(other.csrfToken).not.toBe(token);
    expect((await put({ [CSRF_HEADER]: other.csrfToken }, { lang: "en" })).status).toBe(403);
  });
});

describe("proxy", () => {
  // the proxy reads the target and port from the process environment, as under Next
  const saved: Record<string, string | undefined> = {};
  const KEYS = ["MATHVIZ_TARGET", "PRIMEFORGE_PORT", "PORT"] as const;
  beforeAll(() => {
    for (const k of KEYS) saved[k] = process.env[k];
    process.env.MATHVIZ_TARGET = "python";
    delete process.env.PRIMEFORGE_PORT;
    delete process.env.PORT;
  });
  afterAll(() => {
    for (const k of KEYS) {
      if (saved[k] === undefined) delete process.env[k];
      else process.env[k] = saved[k];
    }
  });

  const preq = (path: string, headers: Record<string, string> = {}, method = "GET") =>
    new NextRequest(`${ORIGIN}${path}`, {
      method,
      headers: { host: `127.0.0.1:${PY.port}`, ...headers },
    });

  test("cross-site Sec-Fetch-Site → 403 cross_site, on pages and on /c/", async () => {
    for (const path of ["/", `/c/${VERSION}/tools/${firstTool()}`, "/api/settings"]) {
      const res = proxy(preq(path, { "sec-fetch-site": "cross-site" })) as Response;
      expect(res.status).toBe(403);
      expect((await res.json()).error.code).toBe("cross_site");
    }
  });

  test("a foreign Host or Origin → 403", async () => {
    expect(proxy(preq("/", { host: `evil.example:${PY.port}` }))?.status).toBe(403);
    expect(proxy(preq("/", { origin: "http://evil.example" }))?.status).toBe(403);
  });

  test("a write without the CSRF token → 403 before the route", () => {
    expect(proxy(preq("/api/settings", { "sec-fetch-site": "same-origin" }, "PUT"))?.status).toBe(
      403,
    );
  });

  test("shell pages get the shell CSP (frame-src 'self'); /c/ keeps the route's own", () => {
    const page = proxy(preq("/", { "sec-fetch-site": "none" }));
    expect(page?.headers.get("content-security-policy")).toBe(SHELL_CSP);
    expect(SHELL_CSP).toContain("frame-src 'self'");
    expect(proxy(preq(`/c/${VERSION}/tools/${firstTool()}`))).toBeUndefined();
    expect(TOOL_CSP).not.toBe(SHELL_CSP);
    expect(TOOL_CACHE_CONTROL).toBe("public, max-age=31536000, immutable");
  });

  test("pages answer GET and HEAD only (a write with a valid token → 405)", () => {
    const token = { [CSRF_HEADER]: processCsrfToken() };
    expect(proxy(preq("/", token, "POST"))?.status).toBe(405);
    expect(proxy(preq(`/c/${VERSION}/tools/${firstTool()}`, token, "DELETE"))?.status).toBe(405);
    expect(proxy(preq("/api/settings", token, "PUT"))).toBeUndefined();
  });
});
