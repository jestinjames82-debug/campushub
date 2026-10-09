/** Read every row using a stable ID cursor, including servers with a smaller row cap. */
export async function loadAllRows<T extends { id: string }>(
  fetchAfter: (lastId: string | undefined) => Promise<T[]>,
): Promise<T[]> {
  const rows: T[] = [];
  let cursor: string | undefined;
  for (;;) {
    const page = await fetchAfter(cursor);
    if (!page.length) return rows;
    const nextCursor = page[page.length - 1].id;
    if (cursor !== undefined && nextCursor <= cursor)
      throw new Error("Could not finish loading records. Please retry.");
    rows.push(...page);
    cursor = nextCursor;
  }
}
