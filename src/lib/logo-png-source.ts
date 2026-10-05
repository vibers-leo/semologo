import type { Brand } from './brands';
import { CDN, VERSION } from './cdn';
/** One serving order for cards and prefetch. Flags alone never prove file existence. */
export function logoPngCandidates(brand: Brand): string[] {
  const recovery = `/api/logo-preview/?id=${encodeURIComponent(brand.id)}`;
  const localSvgOnly = !(brand.logo_png || brand.has_png) && typeof brand.logo_svg === 'string' && brand.logo_svg.startsWith('/submissions/');
  // Legacy JPEG filed as PNG: normalize the bytes without replacing the original.
  if (localSvgOnly || brand.id === 'osan-cultural-foundation') return [recovery];
  const png = typeof brand.logo_png === 'string' && /\.png(?:\?|$)/i.test(brand.logo_png) ? brand.logo_png : `${CDN}/${brand.id}/logo.png?v=${VERSION}`;
  return [...new Set([...(brand.preview_png ? [brand.preview_png] : []), png, `${CDN}/${brand.id}/logo-transparent.png?v=${VERSION}`, recovery])];
}
