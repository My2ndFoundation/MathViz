import { describe, expect, test } from "bun:test";
import { existsSync, readFileSync } from "node:fs";
import { loadTarget, type TargetId } from "../../app/src/lib/target";

const IDS: TargetId[] = ["math", "chess", "crypto", "python"];
const PORTS = [26454, 26455, 26456, 26457];
const PFD_ROOT =
  process.env.PRIMEFORGE_DESKTOP_PATH ??
  "/Users/nickma/Develop/darkhorseone/system/PrimeForge-Desktop";
const PFD_PARSER = `${PFD_ROOT}/packages/app-contract/src/manifest.ts`;

const manifestText = (t: string) =>
  readFileSync(new URL(`../../targets/${t}/manifest.json`, import.meta.url), "utf8");

describe("loadTarget", () => {
  test("ports", () => {
    expect(IDS.map((t) => loadTarget(t).port)).toEqual(PORTS);
  });
  test("default language and app id", () => {
    for (const t of IDS) {
      expect(loadTarget(t).defaultLang).toBe("en");
      expect(loadTarget(t).appId).toBe(`app.primeforge.mathviz.${t}`);
    }
  });
  test("registry, toolDir, groupField, subjectTypes", () => {
    expect(loadTarget("math")).toMatchObject({
      registry: "tools.json",
      toolDir: "outputs",
      groupField: "cat",
    });
    expect(loadTarget("chess")).toMatchObject({
      registry: "chess/chess-tools.json",
      toolDir: "chess/tools",
      groupField: "phase",
    });
    expect(loadTarget("crypto")).toMatchObject({
      registry: "cryptography/cryptography-tools.json",
      toolDir: "cryptography/tools",
      groupField: "chapter",
    });
    expect(loadTarget("python")).toMatchObject({
      registry: "python/python-tools.json",
      toolDir: "python/tools",
      groupField: "module",
    });
    expect(loadTarget("python").subjectTypes).toEqual(["tool", "program", "blank", "library"]);
    expect(loadTarget("chess").subjectTypes).toEqual(["tool", "library"]);
  });
  test("unknown target throws", () => {
    expect(() => loadTarget("x")).toThrow();
    expect(() => loadTarget("toString")).toThrow();
  });
  test("defaults to MATHVIZ_TARGET", () => {
    const old = process.env.MATHVIZ_TARGET;
    process.env.MATHVIZ_TARGET = "chess";
    try {
      expect(loadTarget().id).toBe("chess");
    } finally {
      if (old === undefined) delete process.env.MATHVIZ_TARGET;
      else process.env.MATHVIZ_TARGET = old;
    }
  });
});

describe("manifests", () => {
  test("id and port match target.json", () => {
    for (const t of IDS) {
      const m = JSON.parse(manifestText(t));
      expect(m.id).toBe(loadTarget(t).appId);
      expect(m.port).toBe(loadTarget(t).port);
      // design §5.3 (user ruling): every app opens in PrimeForge Desktop's own window
      expect(m.ui).toEqual({ window: { width: 1280, height: 820, minWidth: 900, minHeight: 600 } });
    }
  });
  test("workflows", () => {
    for (const t of IDS) {
      const ids = JSON.parse(manifestText(t)).ai.workflows.map((w: { id: string }) => w.id);
      expect(ids).toEqual(t === "python" ? ["ask", "hint", "library"] : ["ask", "library"]);
    }
  });
  test.skipIf(!existsSync(PFD_PARSER))("accepted by PrimeForge's own parseManifest", async () => {
    const { parseManifest } = await import(PFD_PARSER);
    for (const t of IDS) {
      const r = parseManifest(manifestText(t));
      expect(r).toMatchObject({ ok: true });
      // the parser keeps ui.window: Desktop opens the app in its own window, not the browser
      expect(r.ok && r.manifest.ui?.window?.width).toBe(1280);
    }
  });
  test.skipIf(!existsSync(PFD_PARSER))(
    "negative control: parser rejects a broken manifest",
    async () => {
      const { parseManifest } = await import(PFD_PARSER);
      const bad = JSON.parse(manifestText("math"));
      bad.id = "Not An Id";
      expect(parseManifest(JSON.stringify(bad)).ok).toBe(false);
    },
  );
});
