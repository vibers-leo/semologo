/** Keep the editable order intact when splitting logos into moving rows. */
export function logoWallMotionRows<T>(items: T[], columns: number, alternating: boolean): T[][] {
  if (!items.length) return [];
  const rows = alternating ? Math.min(3, Math.ceil(items.length / columns)) : 1;
  const perRow = items.length <= rows * columns ? columns : Math.ceil(items.length / rows);
  return Array.from({ length: rows }, (_, row) => items.slice(row * perRow, row === rows - 1 ? items.length : (row + 1) * perRow));
}
