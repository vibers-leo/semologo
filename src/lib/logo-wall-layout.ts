export type LogoWallLayout = {
  background: 'auto' | 'light' | 'dark'; cardBackground: 'auto' | 'white' | 'transparent' | 'light' | 'dark'; columns: number;
  motion: 'static' | 'marquee' | 'alternating'; speed: 'slow' | 'normal' | 'fast';
  spacing: 'compact' | 'balanced' | 'airy'; logoSize: 'tiny' | 'small' | 'medium' | 'large';
  appearance: 'cards' | 'clean'; logoColor: 'original' | 'black' | 'white'; showNames: boolean;
};
export const defaultLogoWallLayout: LogoWallLayout = { background: 'auto', cardBackground: 'auto', columns: 4, motion: 'static', speed: 'normal', spacing: 'balanced', logoSize: 'small', appearance: 'cards', logoColor: 'original', showNames: false };
export const logoWallMetrics = { spacing: { compact: 12, balanced: 24, airy: 40 }, logoSize: { tiny: 28, small: 40, medium: 56, large: 80 } };
/** Normalize saved settings; logo walls display artwork without captions. */
export function logoWallLayout(value: unknown): LogoWallLayout {
  const s = value && typeof value === 'object' ? value as Record<string, unknown> : {};
  const out = { ...defaultLogoWallLayout };
  for (const key of ['background', 'cardBackground', 'motion', 'speed', 'spacing', 'logoSize', 'appearance', 'logoColor'] as const) {
    const choices: Record<typeof key, readonly string[]> = { background: ['auto','light','dark'], cardBackground: ['auto','white','transparent','light','dark'], motion: ['static','marquee','alternating'], speed: ['slow','normal','fast'], spacing: ['compact','balanced','airy'], logoSize: ['tiny','small','medium','large'], appearance: ['cards','clean'], logoColor: ['original','black','white'] };
    if (s[key] !== undefined) {
      if (typeof s[key] !== 'string' || !choices[key].includes(s[key] as string)) throw new Error('invalid layout');
      Object.assign(out, { [key]: s[key] });
    }
  }
  if (s.columns !== undefined) { if (![2,3,4,6].includes(s.columns as number)) throw new Error('invalid columns'); out.columns = s.columns as number; }
  if (s.showNames !== undefined) { if (typeof s.showNames !== 'boolean') throw new Error('invalid names'); out.showNames = false; }
  return out;
}

export type CardBackground = 'inherit' | 'white' | 'transparent' | 'light' | 'dark';
export type WallLogoColor = 'inherit' | 'original' | 'white' | 'black';
export function wallLogoColor(layout: LogoWallLayout, override: WallLogoColor = 'inherit') {
  return override === 'inherit' ? layout.logoColor : override;
}
export function wallLogoIsLight(layout: LogoWallLayout, sourceLight: boolean, override: WallLogoColor = 'inherit') {
  const color = wallLogoColor(layout, override);
  return color === 'white' || (color === 'original' && sourceLight);
}
export const wallStageBackground = (layout: LogoWallLayout) => layout.background === 'dark' ? '#18181b' : layout.background === 'light' ? '#fff' : '#f4f4f5';
export function wallCardBackground(layout: LogoWallLayout, light = false, override: CardBackground = 'inherit') {
  const choice = override === 'inherit' ? layout.cardBackground : override;
  if (choice === 'transparent') return '#00000000';
  if (choice === 'dark' || (choice === 'auto' && light)) return '#18181b';
  if (choice === 'light') return '#f4f4f5';
  if (choice === 'white' || layout.appearance === 'cards') return '#fff';
  return wallStageBackground(layout);
}
