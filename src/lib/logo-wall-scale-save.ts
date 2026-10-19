/** Wait for initial image sizing before persisting, without overriding a manual adjustment. */
export async function scalesForSave<T extends { scale?: number }>(
  logos: T[],
  keyOf: (logo: T) => string,
  pending: ReadonlyMap<string, Promise<number>>,
): Promise<(T & { scale: number })[]> {
  return Promise.all(logos.map(async logo => ({
    ...logo,
    scale: logo.scale ?? await (pending.get(keyOf(logo)) ?? Promise.resolve(100)),
  })));
}
