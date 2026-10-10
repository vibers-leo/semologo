import type { Brand } from './brands';
import { CDN, VERSION } from './cdn';
/** One serving order for cards and prefetch. Flags alone never prove file existence. */
export function logoPngCandidates(brand: Brand): string[] {
  // Personal uploads stay in their authenticated blob URL; never probe public CDN paths.
  if (typeof brand.logo_png === 'string' && brand.logo_png.startsWith('blob:')) return [brand.logo_png];
  const recovery = `/api/logo-preview/?id=${encodeURIComponent(brand.id)}`;
  const localSvgOnly = !(brand.logo_png || brand.has_png) && typeof brand.logo_svg === 'string' && brand.logo_svg.startsWith('/submissions/');
  // Legacy JPEG filed as PNG: normalize the bytes without replacing the original.
  if (localSvgOnly || brand.id === 'osan-cultural-foundation') return [recovery];
  const png = typeof brand.logo_png === 'string' && /\.png(?:\?|$)/i.test(brand.logo_png) ? (/^(?:https?:\/\/|\/)/.test(brand.logo_png) ? brand.logo_png : `${CDN}/${brand.id}/${brand.logo_png}?v=${VERSION}`) : `${CDN}/${brand.id}/logo.png?v=${VERSION}`;
  const transparent = `${CDN}/${brand.id}/logo-transparent.png?v=${VERSION}`;
  const transparentReviewed = ['s-oil', 'sk'].includes(brand.id)
    && !brand.rejected_asset_files?.includes('logo-transparent.png');
  return [...new Set([
    ...(transparentReviewed ? [transparent] : []),
    ...(brand.preview_png ? [brand.preview_png] : []),
    png,
    ...(!transparentReviewed && !brand.rejected_asset_files?.includes('logo-transparent.png') ? [transparent] : []),
    recovery,
  ])];
}

/** Browser cards can display real SVG directly; keep PNG-only exports separate. */
export function logoImageCandidates(brand: Brand): string[] {
  const png=logoPngCandidates(brand);
  if (!(brand.has_svg || brand.logo_svg) || (typeof brand.logo_png==='string' && brand.logo_png.startsWith('blob:'))) return png;
  const file=brand.svg_transparent || (typeof brand.logo_svg === 'string' ? brand.logo_svg : 'logo.svg');
  if (file.startsWith('/submissions/') && !file.includes('..') && /\.svg$/.test(file)) {
    return [...new Set([...(brand.preview_png ? [brand.preview_png] : []), file, ...png])];
  }
  if (brand.rejected_asset_files?.includes(file) || file.includes('..') || !/^(?:[\w-]+\/)*[\w.-]+\.svg$/.test(file)) return png;
  const svg=`${CDN}/${brand.id}/${file}?v=${VERSION}`;
  // SVG-only brands must not queue behind two missing PNG probes and server rendering.
  if (!(brand.has_png || brand.logo_png || brand.preview_png)) return [svg,...png];
  const recovery=png.filter(url=>url.startsWith('/api/logo-preview/'));
  return [...new Set([...png.filter(url=>!recovery.includes(url)),svg,...recovery])];
}
