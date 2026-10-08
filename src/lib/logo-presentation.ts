import type { Brand } from './brands';
import { CDN, VERSION } from './cdn';
export type LogoPresentation = { file: string; bg: 'light' | 'dark' };
export function validPresentation(value: unknown): value is LogoPresentation {
  if (!value || typeof value !== 'object') return false;
  const p=value as LogoPresentation;
  return typeof p.file==='string' && p.file.length<=240 && !p.file.split('/').includes('..') && /^(?:[A-Za-z0-9_-]+\/)*[A-Za-z0-9_.-]+\.png$/.test(p.file) && (p.bg==='light'||p.bg==='dark');
}
export function applyPresentation(brand: Brand, value: unknown = brand.presentation): Brand {
  if (!validPresentation(value)) return brand;
  return {...brand,presentation:value,preview_png:`${CDN}/${brand.id}/${value.file}?v=${VERSION}`,light:value.bg==='dark',light_logo:value.bg==='dark',dark_variant:false};
}
