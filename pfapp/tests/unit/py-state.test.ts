import { describe, expect, test } from "bun:test";
import { parsePyState } from "../../app/src/lib/py-state";

const ORIGIN = "http://127.0.0.1:3000";
const good = {
  type: "mathviz/py-state",
  v: 1,
  page: "py-loops",
  progId: "p1",
  mode: "blank",
  blankId: "b2",
  given: ["b1", "b2"],
};
const parse = (data: unknown, origin = ORIGIN, page = "py-loops") =>
  parsePyState({ origin, data }, ORIGIN, page);

describe("parsePyState", () => {
  test("a valid message gives the fields as sent", () => {
    expect(parse(good)).toEqual({
      progId: "p1",
      mode: "blank",
      blankId: "b2",
      given: ["b1", "b2"],
    });
  });
  test("blankId stays as sent: null ok, and not inferred from given", () => {
    expect(parse({ ...good, mode: "read", blankId: null })?.blankId).toBeNull();
    expect(parse({ ...good, blankId: "b1", given: ["b2"] })).toEqual({
      progId: "p1",
      mode: "blank",
      blankId: "b1",
      given: ["b2"],
    });
  });
  const bad: [string, unknown, string?][] = [
    ["wrong origin", good, "http://evil.example"],
    ["v 2", { ...good, v: 2 }],
    ["wrong type", { ...good, type: "x" }],
    ["bad mode", { ...good, mode: "x" }],
    ["given not an array", { ...good, given: "b1" }],
    ["given has a non-string", { ...good, given: ["b1", 2] }],
    ["blankId number", { ...good, blankId: 3 }],
    ["progId missing", { ...good, progId: undefined }],
    ["another page", { ...good, page: "py-other" }],
    ["null data", null],
    ["string data", "mathviz/py-state"],
  ];
  for (const [name, data, origin] of bad) {
    test(`rejects ${name}`, () => {
      expect(parse(data, origin)).toBeNull();
    });
  }
});
