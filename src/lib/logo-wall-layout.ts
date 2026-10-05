export type LogoWallLayout = {
  background: 'auto' | 'light' | 'dark'; columns: number;
  motion: 'static' | 'marquee' | 'alternating'; speed: 'slow' | 'normal' | 'fast';
  spacing: 'compact' | 'balanced' | 'airy'; logoSize: 'small' | 'medium' | 'large';
  appearance: 'cards' | 'clean'; showNames: boolean;
};
export const defaultLogoWallLayout: LogoWallLayout = { background: 'auto', columns: 4, motion: 'static', speed: 'normal', spacing: 'balanced', logoSize: 'medium', appearance: 'cards', showNames: true };
export const logoWallMetrics = { spacing: { compact: 12, balanced: 24, airy: 40 }, logoSize: { small: 56, medium: 80, large: 104 } };
/** Old saved walls retain their appearance; new settings are optional for old clients. */
export function logoWallLayout(value: unknown): LogoWallLayout {
  const s = value && typeof value === 'object' ? value as Record<string, unknown> : {};
  const out = { ...defaultLogoWallLayout };
  for (const key of ['background', 'motion', 'speed', 'spacing', 'logoSize', 'appearance'] as const) {
    const choices: Record<typeof key, readonly string[]> = { background: ['auto','light','dark'], motion: ['static','marquee','alternating'], speed: ['slow','normal','fast'], spacing: ['compact','balanced','airy'], logoSize: ['small','medium','large'], appearance: ['cards','clean'] };
    if (s[key] !== undefined) {
      if (typeof s[key] !== 'string' || !choices[key].includes(s[key] as string)) throw new Error('invalid layout');
      Object.assign(out, { [key]: s[key] });
    }
  }
  if (s.columns !== undefined) { if (![2,3,4,6].includes(s.columns as number)) throw new Error('invalid columns'); out.columns = s.columns as number; }
  if (s.showNames !== undefined) { if (typeof s.showNames !== 'boolean') throw new Error('invalid names'); out.showNames = s.showNames; }
  return out;
}
