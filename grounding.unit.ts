import { test } from "node:test";
import assert from "node:assert/strict";
import { selectExcerpts, validateCitations } from "../src/lib/ai-grounding.ts";
test("source review ranks relevant passages and bounds excerpts", () => {
  const result = selectExcerpts(
    [
      {
        id: "1",
        title: "Networks",
        content:
          "Databases store records.\n\nNetworks connect devices.\n\nRouting forwards packets.",
      },
    ],
    "How do networks connect devices?",
  );
  assert.equal(result[0].content, "Networks connect devices.");
  assert.equal(result[0].matched, true);
  assert.ok(
    selectExcerpts(
      [{ id: "1", title: "Long", content: "a".repeat(9000) }],
      "example",
    )[0].content.length <= 4000,
  );
});
test("unknown and missing citations are rejected", () => {
  assert.equal(validateCitations("Supported [1] and [2]", 2), true);
  assert.equal(validateCitations("Invented [3]", 2), false);
  assert.equal(validateCitations("Invented [0]", 2), false);
  assert.equal(validateCitations("No evidence", 2), false);
});
