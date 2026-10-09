import test from "node:test";
import assert from "node:assert/strict";
import { loadAllRows } from "../src/lib/pagination.ts";

test("long academic histories load beyond 1,000 rows even with a smaller server cap", async () => {
  const source = Array.from({ length: 1251 }, (_, index) => ({
    id: String(index).padStart(6, "0"),
    score: index % 101,
  }));
  const rows = await loadAllRows(async (cursor) =>
    source
      .filter((row) => cursor === undefined || row.id > cursor)
      .slice(0, 127),
  );
  assert.deepEqual(rows, source);
  assert.deepEqual(await loadAllRows(async () => []), []);
});

test("partial reads and a broken cursor fail rather than return misleading totals", async () => {
  await assert.rejects(
    loadAllRows(async (cursor) => {
      if (cursor) throw new Error("Connection lost");
      return [{ id: "001" }];
    }),
    /Connection lost/,
  );
  await assert.rejects(
    loadAllRows(async () => [{ id: "001" }]),
    /finish loading/,
  );
});
