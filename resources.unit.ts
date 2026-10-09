import test from "node:test";
import assert from "node:assert/strict";
import {
  resourceUrl,
  safeFileName,
  validateResourceFile,
  validateResourceContent,
  deadlineState,
  localDate,
  MAX_RESOURCE_BYTES,
} from "../src/lib/resources.ts";

test("saved resource links accept complete HTTP URLs but reject executable and credential-bearing links", () => {
  assert.equal(
    resourceUrl(" https://example.edu/notes?chapter=2 "),
    "https://example.edu/notes?chapter=2",
  );
  for (const url of [
    "javascript:alert(1)",
    "data:text/html,test",
    "file:///C:/notes",
    "/relative",
    "example.com",
    "https://student:secret@example.com",
  ])
    assert.throws(() => resourceUrl(url));
});

test("file validation enforces extension, MIME, nonempty size and separate demo limit", () => {
  assert.equal(
    validateResourceFile({
      name: "chapter.PDF",
      type: "application/pdf",
      size: MAX_RESOURCE_BYTES,
    }),
    "application/pdf",
  );
  assert.equal(
    validateResourceFile({ name: "notes.txt", type: "", size: 100 }),
    "text/plain",
  );
  for (const file of [
    { name: "notes.html", type: "text/html", size: 10 },
    { name: "notes.pdf", type: "text/html", size: 10 },
    { name: "notes.txt", type: "text/plain", size: 0 },
    {
      name: "notes.pdf",
      type: "application/pdf",
      size: MAX_RESOURCE_BYTES + 1,
    },
  ])
    assert.throws(() => validateResourceFile(file));
  assert.throws(() =>
    validateResourceFile(
      { name: "notes.txt", type: "text/plain", size: 1024 * 1024 + 1 },
      true,
    ),
  );
});

test("renaming executable files does not bypass basic file-content checks", async () => {
  await assert.rejects(
    validateResourceContent(
      new File(["<html>not a PDF</html>"], "notes.pdf", {
        type: "application/pdf",
      }),
    ),
  );
  await assert.rejects(
    validateResourceContent(
      new File([new Uint8Array([65, 0, 66])], "notes.txt", {
        type: "text/plain",
      }),
    ),
  );
  assert.equal(
    await validateResourceContent(
      new File(["%PDF-1.7\nexample"], "notes.pdf", { type: "application/pdf" }),
    ),
    "application/pdf",
  );
});

test("storage file names remove path traversal and preserve a useful extension", () => {
  assert.equal(safeFileName("../../my notes.pdf"), "my_notes.pdf");
  assert.equal(safeFileName("C:\\fakepath\\notes.txt"), "notes.txt");
  assert.equal(safeFileName("..secret.txt"), "secret.txt");
  assert.ok(safeFileName("x".repeat(300) + ".pdf").length <= 120);
});

test("manually saved opportunities clearly identify past and same-day deadlines", () => {
  assert.equal(deadlineState("2026-10-07", "2026-10-08"), "Expired");
  assert.equal(deadlineState("2026-10-08", "2026-10-08"), "Closes today");
  assert.equal(deadlineState("2026-10-09", "2026-10-08"), "Upcoming");
  assert.equal(deadlineState("", "2026-10-08"), "No deadline recorded");
});

test("career and revision dates use the India calendar day across UTC midnight boundaries", () => {
  assert.equal(localDate(new Date("2026-10-08T18:29:59Z")), "2026-10-08");
  assert.equal(localDate(new Date("2026-10-08T18:30:00Z")), "2026-10-09");
  assert.equal(
    deadlineState("2026-10-08", localDate(new Date("2026-10-08T18:30:00Z"))),
    "Expired",
  );
});
