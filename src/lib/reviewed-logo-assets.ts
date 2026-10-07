import type { Brand, VariantManifest } from './brands';
import { CDN } from './cdn';

// Only visually reviewed transparent assets belong here. Never remove white
// indiscriminately: the Seongnam symbol contains intentional white artwork.
const official = 'sources/official-ci-20261007';
export function applyReviewedAssets(brand: Brand): Brand {
  if (['cj', 'roblox', 'olive-young', 'bucketplace', 'myrealtrip', 'hyundai', 'incheon-michuhol-gu', 'shinhan-bank', 'samsung', 'samsung-ct', 'anua', 'samsungbioepis', 'hyundai-glovis', 'samsung-bespoke', 'studio-dragon', 'watcha'].includes(brand.id)) return { ...brand,
    preview_png: `${CDN}/${brand.id}/logo-transparent.png?v=20261006-2`,
    logo_png: 'logo-transparent.png',
    ...(brand.id === 'hyundai-glovis' ? { name_ko: '현대글로비스', name_en: 'Hyundai Glovis' } : {}),
  };
  if (brand.id === 'nhqv') return { ...brand,
    logo_svg: false, has_svg: false, svg_transparent: null,
    logo_png: true, has_png: true, light: false, light_logo: false, dark_variant: false,
    rejected_asset_files: ['logo.svg', 'logo-en.svg', 'logo-800.png', 'logo-icon.png', 'logo-transparent.png', 'logo-white.png', 'logo-en.png'],
  };
  if (brand.id === 'gongu-ci-1228') return { ...brand,
    variant_of: 'seongnam', hidden: true,
    hidden_reason: '공식 CI 변형과 원본 ZIP을 성남시 대표 콘텐츠로 통합',
  };
  if (brand.id !== 'seongnam') return brand;
  return { ...brand, has_svg: true, has_png: true, logo_svg: true,
    preview_png: `${CDN}/seongnam/${official}/horizontal.png`,
    logo_png: `${official}/horizontal.png`,
    svg_transparent: `${official}/horizontal.svg`,
    light: false, light_logo: false, dark_variant: false,
    source_zip: 'official-ci-20261006.zip',
  };
}

export const reviewedVariants: Record<string, VariantManifest> = {
  nhqv: { schema: 1, algo_v: 1, id: "nhqv", primary: "", variants: [] },
  seongnam: { schema: 1, algo_v: 1, id: 'seongnam', primary: 'official-horizontal',
    variants: (['horizontal', 'vertical', 'symbol'] as const).map((form, order) => ({
      key: `official-${form}`, form, lang: form === 'symbol' ? 'none' : 'ko',
      color: 'original', label: { horizontal: '공식 가로형', vertical: '공식 세로형', symbol: '공식 심볼' }[form],
      files: { png: `${official}/${form}.png`, svg: `${official}/${form}.svg` },
      provider: '사용자 제공 공식 CI AI ZIP', origin: 'manual', order,
    })),
  },
};
