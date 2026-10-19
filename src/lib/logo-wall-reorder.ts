export type DropSlot = { index: number; anchor: number; edge: 'before' | 'after' };
export type DropRow = { top: number; bottom: number; items: { index: number; left: number; right: number }[] };

export function findLogoWallDropSlot(rows: DropRow[], x: number, y: number): DropSlot | null {
  const row = rows.filter(candidate => candidate.items.length).reduce<DropRow | null>((nearest, candidate) => {
    if (!nearest) return candidate;
    const distance = Math.max(candidate.top - y, 0, y - candidate.bottom);
    const nearestDistance = Math.max(nearest.top - y, 0, y - nearest.bottom);
    return distance < nearestDistance ? candidate : nearest;
  }, null);
  if (!row) return null;
  for (const item of row.items) {
    if (x < (item.left + item.right) / 2) return { index: item.index, anchor: item.index, edge: 'before' };
  }
  const last = row.items[row.items.length - 1];
  return { index: last.index + 1, anchor: last.index, edge: 'after' };
}

export function moveLogoToInsertion<T>(items: T[], from: number, insertion: number): T[] {
  if (from < 0 || from >= items.length || insertion < 0 || insertion > items.length || insertion === from || insertion === from + 1) return items;
  const next = [...items];
  const [item] = next.splice(from, 1);
  next.splice(insertion > from ? insertion - 1 : insertion, 0, item);
  return next;
}
