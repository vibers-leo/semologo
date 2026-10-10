import type { Brand, VariantManifest } from './brands';
import { CDN, VERSION } from './cdn';
import release from './reviewed-asset-release-20261008.json';
import backgroundMerge from './reviewed-background-merge-20261008.json';
import googleTransparent from './reviewed-google-transparent-20261009.json';
import requestedBackground from './reviewed-requested-background-20261009.json';
import userSvg from './reviewed-user-svg-20261009.json';
import netflix from './reviewed-netflix-20261009.json';
import rainbow from './reviewed-rainbow-20261009.json';
import institutions from './reviewed-institutions-20261009.json';
import institutionsNext from './reviewed-institutions-20261010.json';
import claudeMerge from './reviewed-claude-merge-20261010.json';
import lockups from './reviewed-lockups-20261010.json';
import yeonsu from './reviewed-yeonsu-20261010.json';
import kepco from './reviewed-kepco-20261010.json';
import chungbuk from './reviewed-chungbuk-20261010.json';
import ftc from './reviewed-ftc-20261010.json';
import cjwf from './reviewed-cjwf-20261010.json';
import seongju from './reviewed-seongju-20261010.json';
import iconHd from './reviewed-icon-hd-20261010.json';
import userIdentities from './reviewed-user-identities-20261010.json';
import cityMerges from './reviewed-city-merges-20261010.json';
import officialRecollection from './reviewed-official-recollection-20261010.json';
import svgPreviews from './reviewed-svg-previews-20261010.json';
import baeminGuide from './reviewed-baemin-guide-20261010.json';
import officialAi from './reviewed-official-ai-20261010.json';
import nextAssets from './reviewed-assets-next-20261010.json';
const releasePatches = { ...release.patches, ...backgroundMerge.patches, ...googleTransparent.patches, ...institutions.patches, ...institutionsNext.patches, ...rainbow.patches, ...requestedBackground.patches, ...netflix.patches, ...userSvg.patches, ...claudeMerge.patches, ...lockups.patches, ...yeonsu.patches, ...kepco.patches, ...chungbuk.patches, ...ftc.patches, ...cjwf.patches, ...seongju.patches, ...iconHd.patches, ...userIdentities.patches, ...cityMerges.patches, ...officialRecollection.patches, ...svgPreviews.patches, ...baeminGuide.patches, ...officialAi.patches, ...nextAssets.patches } as unknown as Record<string, Partial<Brand>>;

// Only visually reviewed transparent assets belong here. Never remove white
// indiscriminately: the Seongnam symbol contains intentional white artwork.
const official = 'sources/official-ci-20261007';
export function applyReviewedAssets(brand: Brand): Brand {
  if (releasePatches[brand.id]) {
    const patch = releasePatches[brand.id];
    const reviewed = { ...brand, ...patch };
    if (brand.logo_published_at && Date.parse(brand.logo_published_at) > Date.parse(patch.logo_published_at ?? '1970-01-01')) {
      reviewed.logo_published_at = brand.logo_published_at;
    }
    return reviewed;
  }
  if (brand.id === 'h-m') return { ...brand, variant_of: 'h-m-1', hidden: true,
    hidden_reason: 'H&M 중복 로고를 투명 원본 대표 콘텐츠로 통합',
  };
  if (brand.id === 'h-m-1') return { ...brand, name_ko: 'H&M', name_en: 'H&M',
    aliases: [...(brand.aliases ?? []), '에이치앤엠', '에이치 앤 엠'],
    logo_png: 'sources/reviewed-merge-20261007/logo.png', has_png: true,
    preview_png: `${CDN}/h-m-1/sources/reviewed-merge-20261007/logo.png`,
    light: false, light_logo: false, dark_variant: false,
  };
  if (['bonghwa', 'geochang'].includes(brand.id)) return { ...brand,
    logo_png: 'sources/official-municipality-20261007/logo.png', has_png: true,
    preview_png: `${CDN}/${brand.id}/sources/official-municipality-20261007/logo.png`,
    light: false, light_logo: false, dark_variant: false,
    official_source_page: brand.id === 'bonghwa'
      ? 'https://www.bonghwa.go.kr/portal/contents.do?mid=0402020000'
      : 'https://www.geochang.go.kr/00314/00317/00330.web',
    website: `https://www.${brand.id}.go.kr/`,
    rejected_asset_files: ['logo-800.png', 'logo-icon.png', 'logo-transparent.png', 'logo-white.png'],
  };
  // 2026-10-07 visual review: both derivatives have transparent alpha and
  // remove the white rectangles visible in the S-Oil and SK catalog cards.
  if (['s-oil', 'sk'].includes(brand.id)
    && !brand.rejected_asset_files?.includes('logo-transparent.png')) return { ...brand,
      preview_png: `${CDN}/${brand.id}/logo-transparent.png?v=${VERSION}`,
      logo_png: 'logo-transparent.png', has_png: true,
    };
  if (['cj', 'roblox', 'olive-young', 'bucketplace', 'myrealtrip', 'hyundai', 'incheon-michuhol-gu', 'shinhan-bank', 'samsung', 'samsung-ct', 'anua', 'samsungbioepis', 'hyundai-glovis', 'samsung-bespoke', 'studio-dragon', 'watcha', 'kca', 'reddit', 'gs-caltex'].includes(brand.id)) return { ...brand,
    preview_png: `${CDN}/${brand.id}/logo-transparent.png?v=20261006-2`,
    logo_png: 'logo-transparent.png',
    ...(brand.id === 'hyundai-glovis' ? { name_ko: '현대글로비스', name_en: 'Hyundai Glovis' } : {}),
    ...(brand.id === 'gs-caltex' ? { name_ko: 'GS칼텍스', name_en: 'GS Caltex' } : {}),
  };
  if (brand.id === 'gscaltex') return { ...brand,
    name_ko: 'GS칼텍스', name_en: 'GS Caltex', category: '에너지·화학',
    variant_of: 'gs-caltex', hidden: true,
    hidden_reason: 'GS칼텍스 도메인·로고의 오기명 중복을 GS칼텍스 대표 콘텐츠로 통합',
  };
  if (brand.id === 'skbroadband') return { ...brand,
    preview_png: `${CDN}/skbroadband/sources/reviewed-transparent-20261007/logo.png`,
    logo_png: 'sources/reviewed-transparent-20261007/logo.png',
    svg_transparent: 'sources/reviewed-transparent-20261007/logo.svg', has_png: true, has_svg: true,
  };
  if (brand.id === 'nhqv') return { ...brand,
    logo_svg: true, has_svg: true, svg_transparent: "sources/reviewed-transparent-20261007/logo.svg",
    preview_png: `${CDN}/nhqv/sources/reviewed-transparent-20261007/logo.png`,
    logo_png: "sources/reviewed-transparent-20261007/logo.png", has_png: true, light: false, light_logo: false, dark_variant: false,
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
  ...userIdentities.variants as unknown as Record<string, VariantManifest>,
  ...officialRecollection.variants as unknown as Record<string, VariantManifest>,
  ...svgPreviews.variants as unknown as Record<string, VariantManifest>,
  ...baeminGuide.variants as unknown as Record<string, VariantManifest>,
  ...officialAi.variants as unknown as Record<string, VariantManifest>,
  ...(lockups.variants as unknown as Record<string, VariantManifest>),
  ...(claudeMerge.variants as unknown as Record<string, VariantManifest>),
  ...institutionsNext.variants as unknown as Record<string, VariantManifest>,
  ...(release.variants as unknown as Record<string, VariantManifest>),
  ...(backgroundMerge.variants as unknown as Record<string, VariantManifest>),
  ...(googleTransparent.variants as unknown as Record<string, VariantManifest>),
  ...(institutions.variants as unknown as Record<string, VariantManifest>),
  ...(rainbow.variants as unknown as Record<string, VariantManifest>),
  ...(requestedBackground.variants as unknown as Record<string, VariantManifest>),
  ...(netflix.variants as unknown as Record<string, VariantManifest>),
  ...(userSvg.variants as unknown as Record<string, VariantManifest>),
  ...(yeonsu.variants as unknown as Record<string, VariantManifest>),
  ...(kepco.variants as unknown as Record<string, VariantManifest>),
  ...(chungbuk.variants as unknown as Record<string, VariantManifest>),
  ...(ftc.variants as unknown as Record<string, VariantManifest>),
  ...(cjwf.variants as unknown as Record<string, VariantManifest>),
  ...(seongju.variants as unknown as Record<string, VariantManifest>),
  'h-m-1': { schema: 1, algo_v: 1, id: 'h-m-1', primary: 'original', variants: [
    { key: 'original', form: 'wordmark', lang: 'en', color: 'original', label: '투명 워드마크', files: { svg: 'logo.svg', png: 'sources/reviewed-merge-20261007/logo.png' }, provider: '기존 보유 원본', origin: 'collected', order: 0 },
    { key: 'legacy', form: 'wordmark', lang: 'en', color: 'original', label: '기존 워드마크', files: { svg: 'sources/reviewed-merge-20261007/legacy.svg', png: 'sources/reviewed-merge-20261007/logo.png' }, provider: '통합한 기존 콘텐츠 원본', origin: 'collected', order: 1 },
  ] },
  nhqv: { schema: 1, algo_v: 1, id: "nhqv", primary: "reviewed-korean", variants: [{
    key: 'reviewed-korean', form: 'horizontal', lang: 'ko', color: 'original', label: '한글 워드마크',
    files: { png: 'sources/reviewed-transparent-20261007/logo.png', svg: 'sources/reviewed-transparent-20261007/logo.svg' },
    provider: 'Wikimedia Commons · NH투자증권 홈페이지 출처', origin: 'collected', order: 0,
  }] },
  seongnam: { schema: 1, algo_v: 1, id: 'seongnam', primary: 'official-horizontal',
    variants: (['horizontal', 'vertical', 'symbol'] as const).map((form, order) => ({
      key: `official-${form}`, form, lang: form === 'symbol' ? 'none' : 'ko',
      color: 'original', label: { horizontal: '공식 가로형', vertical: '공식 세로형', symbol: '공식 심볼' }[form],
      files: { png: `${official}/${form}.png`, svg: `${official}/${form}.svg` },
      provider: '사용자 제공 공식 CI AI ZIP', origin: 'manual', order,
    })),
  },
  ...nextAssets.variants as unknown as Record<string, VariantManifest>,
};
