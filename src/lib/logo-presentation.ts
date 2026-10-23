import type { Brand } from './brands';
import { CDN, VERSION } from './cdn';
export type LogoPresentation = { file: string; bg: 'light' | 'dark'; svgFile?: string; version?: string; locked?: boolean };
export function validPresentation(value: unknown): value is LogoPresentation {
  if (!value || typeof value !== 'object') return false;
  const p=value as LogoPresentation;
  return typeof p.file==='string' && p.file.length<=240 && !p.file.split('/').includes('..') && /^(?:[A-Za-z0-9_-]+\/)*[A-Za-z0-9_.-]+\.png$/.test(p.file) && (p.bg==='light'||p.bg==='dark')
    && (p.svgFile == null || (typeof p.svgFile === 'string' && p.svgFile.length <= 240 && !p.svgFile.split('/').includes('..') && /^(?:[A-Za-z0-9_-]+\/)*[A-Za-z0-9_.-]+\.svg$/.test(p.svgFile)))
    && (p.version == null || (typeof p.version === 'string' && /^[A-Za-z0-9._-]{1,80}$/.test(p.version)))
    && (p.locked == null || typeof p.locked === 'boolean');
}
export function applyPresentation(brand: Brand, value: unknown = brand.presentation): Brand {
  if (!validPresentation(value) || (brand.rejected_asset_files?.includes(value.file) && !value.locked)) return brand;
  return {...brand,...(value.locked ? {rejected_asset_files:(brand.rejected_asset_files || []).filter(file=>file!==value.file)} : {}),presentation:value,logo_png:value.file,has_png:true,preview_png:`${CDN}/${brand.id}/${value.file}?v=${value.version || VERSION}`,
    ...(value.svgFile ? { svg_transparent: value.svgFile } : {}), light:value.bg==='dark',light_logo:value.bg==='dark',dark_variant:false};
}

/** Accept only PNG files owned by this brand on the configured CDN. */
export function presentationAssetFile(brand: Pick<Brand, "id">, asset: unknown): string | null {
 if(typeof asset!=="string")return null;
 const prefix=`${CDN}/${brand.id}/`;
 const file=(asset.startsWith(prefix)?asset.slice(prefix.length):asset).split("?")[0];
 return validPresentation({file,bg:"light"})?file:null;
}
