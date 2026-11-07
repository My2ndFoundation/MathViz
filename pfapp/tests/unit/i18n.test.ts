import { describe, expect, test } from "bun:test";
import {
  defaultLocale,
  isLocale,
  LOCALES,
  MESSAGES,
  resolveLocale,
} from "../../app/src/lib/i18n/locale";
import { en } from "../../app/src/lib/i18n/messages/en";
import { zh } from "../../app/src/lib/i18n/messages/zh";
import { loadTarget } from "../../app/src/lib/target";

/** Every leaf as `a.b.c`, sorted; a non-string, non-object leaf is reported as `a.b.c:<type>`. */
function keys(o: unknown, base = ""): string[] {
  const out: string[] = [];
  for (const [k, v] of Object.entries(o as Record<string, unknown>)) {
    const p = base ? `${base}.${k}` : k;
    if (typeof v === "string") out.push(p);
    else if (v && typeof v === "object" && !Array.isArray(v)) out.push(...keys(v, p));
    else out.push(`${p}:${Array.isArray(v) ? "array" : typeof v}`);
  }
  return out.sort();
}

/** `{name}` placeholders of every leaf. */
function placeholders(o: unknown, base = ""): Record<string, string[]> {
  const out: Record<string, string[]> = {};
  for (const [k, v] of Object.entries(o as Record<string, unknown>)) {
    const p = base ? `${base}.${k}` : k;
    if (typeof v === "string")
      out[p] = [...v.matchAll(/\{(\w+)\}/g)].map((m) => m[1] as string).sort();
    else Object.assign(out, placeholders(v, p));
  }
  return out;
}

describe("messages", () => {
  test("zh has exactly en's keys, every leaf a non-empty string", () => {
    expect(keys(zh)).toEqual(keys(en));
    expect(keys(en).length).toBeGreaterThan(0);
    for (const m of [en, zh]) {
      for (const k of keys(m)) expect(k).not.toContain(":");
    }
  });

  test("the same {placeholders} in both languages", () => {
    expect(placeholders(zh)).toEqual(placeholders(en));
  });

  test("MESSAGES has one dictionary per locale", () => {
    expect(Object.keys(MESSAGES).sort()).toEqual([...LOCALES].sort());
  });
});

describe("locale", () => {
  test("every target defaults to English", () => {
    for (const id of ["math", "chess", "crypto", "python"]) {
      expect(defaultLocale(loadTarget(id))).toBe("en");
    }
  });

  test("a stored locale wins; anything else falls back to the default", () => {
    const t = loadTarget("python");
    expect(resolveLocale("zh", t)).toBe("zh");
    expect(resolveLocale("en", t)).toBe("en");
    for (const bad of [null, undefined, "", "zh-CN", "fr", "EN"]) {
      expect(resolveLocale(bad, t)).toBe("en");
    }
    expect(isLocale("zh")).toBe(true);
    expect(isLocale(1)).toBe(false);
  });
});
