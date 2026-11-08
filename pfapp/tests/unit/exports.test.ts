import { describe, expect, test } from "bun:test";
import { readdirSync, utimesSync } from "node:fs";
import { join } from "node:path";
import { bodyLimitFor, EXPORT_CHUNK_LIMIT, JSON_LIMIT } from "../../app/src/lib/http/body";
import { HttpError } from "../../app/src/lib/http/errors";
import {
  appendExport,
  createExport,
  EXPORT_MAX_BYTES,
  exportResponse,
  safeName,
} from "../../app/src/lib/server/exports";
import { tmp } from "../helpers/content-fixtures";

const code = (f: () => unknown): string => {
  try {
    f();
  } catch (e) {
    return e instanceof HttpError ? `${e.status} ${e.code}` : String(e);
  }
  return "no error";
};
const bytes = (n: number, fill = 7) => new Uint8Array(n).fill(fill);

describe("exports (what the app hands the student to save: the recorder, the tools' exports)", () => {
  test("safeName keeps an allowed extension and makes the rest safe", () => {
    expect(safeName("fourier-essence-3d-16x9-1080p-6.3s.mp4")).toEqual({
      name: "fourier-essence-3d-16x9-1080p-6.3s.mp4",
      type: "video/mp4",
    });
    expect(safeName("../../etc/x y?.WEBM")).toEqual({ name: "x-y.webm", type: "video/webm" });
    expect(safeName("chaos-double-pendulum-3d-phase.json")?.type).toBe("application/json");
    for (const bad of ["run.sh", "noext", ".mp4", "x.html", 3, null])
      expect(safeName(bad)).toBeNull();
  });

  test("chunks append at the bytes received so far; the file downloads once complete", async () => {
    const dir = tmp("exports-ok");
    const { id, name } = createExport(dir, { name: "clip.mp4", size: 10 });
    expect(name).toBe("clip.mp4");
    expect(code(() => exportResponse(dir, id))).toBe("409 incomplete");
    expect(appendExport(dir, id, 0, bytes(6, 1))).toEqual({ received: 6, complete: false });
    // a chunk sent again, or out of order, is refused rather than corrupting the file
    expect(code(() => appendExport(dir, id, 0, bytes(4)))).toBe("409 bad_offset");
    expect(code(() => appendExport(dir, id, 8, bytes(2)))).toBe("409 bad_offset");
    // past the declared size
    expect(code(() => appendExport(dir, id, 6, bytes(5)))).toBe("400 bad_size");
    expect(appendExport(dir, id, 6, bytes(4, 2))).toEqual({ received: 10, complete: true });
    const res = exportResponse(dir, id);
    expect(res.headers.get("content-type")).toBe("video/mp4");
    expect(res.headers.get("content-disposition")).toBe('attachment; filename="clip.mp4"');
    expect([...new Uint8Array(await res.arrayBuffer())]).toEqual([1, 1, 1, 1, 1, 1, 2, 2, 2, 2]);
  });

  test("refused: a bad name, a bad size, an unknown or malformed id", () => {
    const dir = tmp("exports-bad");
    expect(code(() => createExport(dir, { name: "x.exe", size: 1 }))).toBe("400 bad_name");
    for (const size of [0, -1, 1.5, "1", EXPORT_MAX_BYTES + 1]) {
      expect(code(() => createExport(dir, { name: "x.mp4", size }))).toBe("400 bad_size");
    }
    expect(code(() => exportResponse(dir, "0".repeat(32)))).toBe("404 not_found");
    expect(code(() => exportResponse(dir, "../exports"))).toBe("404 not_found");
    expect(code(() => appendExport(dir, "nope", 0, bytes(1)))).toBe("404 not_found");
  });

  test("exports older than a day are removed when the next one starts", () => {
    const dir = tmp("exports-prune");
    const now = Date.now();
    const old = createExport(dir, { name: "old.json", size: 1 }, now);
    const day = (now - 25 * 3600 * 1000) / 1000;
    for (const f of [`${old.id}.json`, `${old.id}.bin`])
      utimesSync(join(dir, "exports", f), day, day);
    const fresh = createExport(dir, { name: "new.json", size: 1 }, now);
    expect(readdirSync(join(dir, "exports")).sort()).toEqual(
      [`${fresh.id}.bin`, `${fresh.id}.json`].sort(),
    );
  });

  test("a chunk path gets the chunk limit; other API paths keep the JSON limit", () => {
    expect(bodyLimitFor(`/api/exports/${"a".repeat(32)}`)).toBe(EXPORT_CHUNK_LIMIT);
    expect(bodyLimitFor("/api/exports")).toBe(JSON_LIMIT);
    expect(bodyLimitFor("/api/exports/x/y")).toBe(JSON_LIMIT);
  });
});
