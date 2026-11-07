import { afterAll, beforeAll, describe, expect, test } from "bun:test";
import { cpSync, existsSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import Empty from "../../app/src/app/[locale]/empty/page";
import LocaleHome from "../../app/src/app/[locale]/page";
import { POST as importContent } from "../../app/src/app/api/content/import/route";
import { GET as getRoot } from "../../app/src/app/route";
import { MANUAL_DIR } from "../../app/src/lib/content/manual-import";
import { migrationsDir } from "../../app/src/lib/db/open";
import { bodyLimitFor } from "../../app/src/lib/http/body";
import { CSRF_HEADER } from "../../app/src/lib/http/guard";
import { type AppContext, createAppContext, setAppContext } from "../../app/src/lib/server/context";
import { setLang } from "../../app/src/lib/server/settings";
import { loadTarget } from "../../app/src/lib/target";
import { buildPfaddon, extractPayload, tmp } from "../helpers/content-fixtures";

/**
 * The shell's two non-page routes: `/` (redirect to the stored language) and
 * POST /api/content/import (the empty state's "import a local content pack"). Counts come from the
 * real python payload.
 */

const PY = loadTarget("python");
const MIGRATIONS = migrationsDir(join(import.meta.dir, "..", ".."));
const ORIGIN = `http://127.0.0.1:${PY.port}`;

let PAYLOAD = "";
let PACK: { items: { id: string; order: number }[]; groups: { id: string }[] };
const opened: AppContext[] = [];

const dataDirOf = new Map<AppContext, string>();

async function fresh(): Promise<AppContext> {
  const dir = tmp("shell-routes");
  const c = await createAppContext(
    { PRIMEFORGE_DATA_DIR: dir, MATHVIZ_TARGET: "python" },
    { migrationsDir: MIGRATIONS },
  );
  opened.push(c);
  dataDirOf.set(c, dir);
  setAppContext(c);
  return c;
}

beforeAll(async () => {
  PAYLOAD = await extractPayload("python");
  PACK = JSON.parse(readFileSync(join(PAYLOAD, "catalog.json"), "utf8"));
}, 60_000);

afterAll(() => {
  setAppContext(null);
  for (const c of opened) c.close();
});

function req(path: string, init: RequestInit & { headers?: Record<string, string> } = {}) {
  return new Request(`${ORIGIN}${path}`, {
    ...init,
    headers: { host: `127.0.0.1:${PY.port}`, "sec-fetch-site": "same-origin", ...init.headers },
  });
}

describe("GET /", () => {
  test("redirects to the stored language, else the target's default", async () => {
    const c = await fresh();
    const res = await getRoot(req("/"));
    expect(res.status).toBe(307);
    expect(res.headers.get("location")).toBe("/en");
    setLang(c.db, "zh");
    expect((await getRoot(req("/"))).headers.get("location")).toBe("/zh");
  });

  test("the guard runs: a foreign Host → 403", async () => {
    await fresh();
    expect((await getRoot(req("/", { headers: { host: "evil.example:80" } }))).status).toBe(403);
  });
});

describe("POST /api/content/import", () => {
  const upload = (
    c: AppContext,
    data: Uint8Array<ArrayBuffer> | string,
    headers: Record<string, string> = {},
  ) => {
    const form = new FormData();
    form.append("file", new Blob([data]), "content.pfaddon");
    return importContent(
      req("/api/content/import", {
        method: "POST",
        body: form,
        headers: { [CSRF_HEADER]: c.csrfToken, ...headers },
      }),
    );
  };

  test("a valid pack: installed, indexed, the answer names the first tool", async () => {
    const c = await fresh();
    expect(c.content).toBeNull();
    const file = buildPfaddon(PAYLOAD, PY.appId, "1.0.0");
    const res = await upload(c, new Uint8Array(readFileSync(file)));
    expect(res.status).toBe(200);
    const first = [...PACK.items].sort((a, b) => a.order - b.order)[0]?.id;
    expect(await res.json()).toEqual({ version: "1.0.0", firstTool: first });
    expect(c.content?.version).toBe("1.0.0");
    const n = (t: string) =>
      c.db.prepare(`SELECT count(*) AS n FROM ${t}`).get<{ n: number }>()?.n ?? -1;
    expect(n("catalog_items")).toBe(PACK.items.length);
    expect(n("catalog_groups")).toBe(PACK.groups.length);
  }, 30_000);

  test("without the CSRF token → 403, nothing installed", async () => {
    const c = await fresh();
    const res = await upload(
      c,
      new Uint8Array(readFileSync(buildPfaddon(PAYLOAD, PY.appId, "1.0.0"))),
      {
        [CSRF_HEADER]: "",
      },
    );
    expect(res.status).toBe(403);
    expect(c.content).toBeNull();
  }, 30_000);

  test("not gzip → 400 not_gzip, before unpacking", async () => {
    const c = await fresh();
    const res = await upload(c, "PK\u0003\u0004 a zip, not a pfaddon");
    expect(res.status).toBe(400);
    expect((await res.json()).error.code).toBe("not_gzip");
    expect(c.content).toBeNull();
  });

  test("gzip but not this app's content pack → 400 bad_addon", async () => {
    const c = await fresh();
    const res = await upload(
      c,
      new Uint8Array(readFileSync(buildPfaddon(PAYLOAD, "app.someone.else", "1.0.0"))),
    );
    expect(res.status).toBe(400);
    expect((await res.json()).error.code).toBe("bad_addon");
    expect(c.content).toBeNull();
  }, 30_000);

  test("a gzip header over garbage (a truncated download) → 400 bad_addon", async () => {
    const c = await fresh();
    const whole = readFileSync(buildPfaddon(PAYLOAD, PY.appId, "1.0.0"));
    const res = await upload(c, whole.subarray(0, Math.floor(whole.length / 2)));
    expect(res.status).toBe(400);
    expect((await res.json()).error.code).toBe("bad_addon");
    expect(c.content).toBeNull();
  }, 30_000);

  test("no file field → 400 bad_request", async () => {
    const c = await fresh();
    const form = new FormData();
    form.append("other", "x");
    const res = await importContent(
      req("/api/content/import", {
        method: "POST",
        body: form,
        headers: { [CSRF_HEADER]: c.csrfToken },
      }),
    );
    expect(res.status).toBe(400);
    expect((await res.json()).error.code).toBe("bad_request");
  });

  test("the upload limit is 64 MiB (plus multipart framing); a declared body past it → 413", async () => {
    const c = await fresh();
    const limit = bodyLimitFor("/api/content/import");
    expect(limit).toBeGreaterThanOrEqual(64 * 1024 * 1024);
    expect(limit).toBeLessThan(65 * 1024 * 1024);
    expect(bodyLimitFor("/api/settings")).toBeLessThan(limit);
    const res = await importContent(
      req("/api/content/import", {
        method: "POST",
        body: "x",
        headers: {
          [CSRF_HEADER]: c.csrfToken,
          "content-type": "multipart/form-data; boundary=x",
          "content-length": String(limit + 1),
        },
      }),
    );
    expect(res.status).toBe(413);
  });
});

/** The python payload with an empty catalog (no items, no groups). */
function emptyCatalogPayload(): string {
  const dir = join(tmp("empty-payload"), "payload");
  cpSync(PAYLOAD, dir, { recursive: true });
  const cat = JSON.parse(readFileSync(join(dir, "catalog.json"), "utf8"));
  writeFileSync(join(dir, "catalog.json"), JSON.stringify({ ...cat, items: [], groups: [] }));
  return dir;
}

/** What a server component did: the redirect it threw (its target), or "rendered". */
async function outcome(page: () => Promise<unknown>): Promise<string> {
  try {
    await page();
    return "rendered";
  } catch (e) {
    const digest = (e as { digest?: unknown }).digest;
    if (typeof digest === "string" && digest.startsWith("NEXT_REDIRECT")) {
      return `redirect ${digest.split(";")[2]}`;
    }
    throw e;
  }
}

const params = (locale: string) => ({
  params: Promise.resolve({ locale }),
  searchParams: Promise.resolve({}),
});

describe("a content pack with no tools", () => {
  const send = (c: AppContext, file: string) => {
    const form = new FormData();
    form.append("file", new Blob([new Uint8Array(readFileSync(file))]), "content.pfaddon");
    return importContent(
      req("/api/content/import", {
        method: "POST",
        body: form,
        headers: { [CSRF_HEADER]: c.csrfToken },
      }),
    );
  };

  test("importing it → 422 bad_addon, and it is not left installed", async () => {
    const c = await fresh();
    const res = await send(c, buildPfaddon(emptyCatalogPayload(), PY.appId, "2.0.0"));
    expect(res.status).toBe(422);
    expect((await res.json()).error.code).toBe("bad_addon");
    expect(c.content).toBeNull();
    expect(existsSync(join(dataDirOf.get(c) as string, MANUAL_DIR, "2.0.0"))).toBe(false);
  }, 30_000);

  test("over a usable import: refused and removed, and the older pack serves again", async () => {
    const c = await fresh();
    expect((await send(c, buildPfaddon(PAYLOAD, PY.appId, "1.0.0"))).status).toBe(200);
    const res = await send(c, buildPfaddon(emptyCatalogPayload(), PY.appId, "2.0.0"));
    expect(res.status).toBe(422);
    expect(c.content?.version).toBe("1.0.0");
    expect(existsSync(join(dataDirOf.get(c) as string, MANUAL_DIR, "2.0.0"))).toBe(false);
  }, 60_000);

  test("a pack without catalog rows: `/<l>` → /<l>/empty, and the empty page renders (no loop)", async () => {
    const c = await fresh();
    expect((await send(c, buildPfaddon(PAYLOAD, PY.appId, "1.0.0"))).status).toBe(200);
    // with a usable pack both ends agree on the tool
    expect(await outcome(() => Empty(params("en") as never))).toBe("redirect /en");
    expect(await outcome(() => LocaleHome(params("en") as never))).toMatch(
      /^redirect \/en\/tool\//,
    );
    // the rows gone by some other route: content is still non-null
    c.db.exec("DELETE FROM catalog_items");
    expect(c.content).not.toBeNull();
    expect(await outcome(() => LocaleHome(params("en") as never))).toBe("redirect /en/empty");
    expect(await outcome(() => Empty(params("en") as never))).toBe("rendered");
  }, 60_000);
});
