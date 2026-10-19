import type { Brand } from './brands';

/** Keep one merged catalog per source revision, instead of rebuilding 180k-entry maps per request. */
export function createCatalogMerger(submissions: Brand[], supplements: Brand[]) {
  let cached: { catalog: Brand[]; cms: Brand[]; brands: Brand[] } | undefined;
  return (catalog: Brand[], cms: Brand[]): Brand[] => {
    if (cached?.catalog === catalog && cached.cms === cms) return cached.brands;
    const known = new Set(catalog.map(brand => brand.id));
    const submitted = submissions.filter(brand => !known.has(brand.id));
    const submittedIds = new Set([...known, ...submitted.map(brand => brand.id)]);
    const merged = new Map([...catalog, ...submitted,
      ...supplements.filter(brand => !submittedIds.has(brand.id)),
    ].map(brand => [brand.id, brand]));
    // Preserve reviewed identities and explicit CMS corrections. A verified
    // vector may also fill a catalog entry that still advertises PNG only.
    for (const brand of cms) {
      const reviewed = merged.get(brand.id);
      if (!reviewed) merged.set(brand.id, brand);
      else if (brand.catalog_override === true && typeof brand.logo_png === 'string') {
        merged.set(brand.id, {
          ...reviewed, ...brand,
          seq: reviewed.seq, fame: reviewed.fame, added_at: reviewed.added_at,
          origin: brand.origin ?? reviewed.origin,
        });
      }
      else {
        const publishedAt = brand.logo_published_at && Number.isFinite(Date.parse(brand.logo_published_at))
          ? brand.logo_published_at : undefined;
        const verifiedVector = brand.asset_review_status === 'verified'
          && typeof brand.logo_svg === 'string' && brand.logo_svg.length > 0
          && !reviewed.logo_svg && !reviewed.has_svg;
        if (verifiedVector || publishedAt) {
          merged.set(brand.id, {
            ...reviewed,
            ...(publishedAt ? { logo_published_at: publishedAt } : {}),
            ...(verifiedVector ? {
              logo_svg: brand.logo_svg,
              svg_transparent: brand.svg_transparent,
              logo_png: brand.logo_png || reviewed.logo_png,
              preview_png: brand.preview_png,
              has_svg: true,
              has_png: brand.has_png ?? reviewed.has_png,
              variants_n: brand.variants_n,
              asset_origin: brand.asset_origin,
              official_source_page: brand.official_source_page,
            } : {}),
          });
        }
      }
    }
    const brands = [...merged.values()];
    cached = { catalog, cms, brands };
    return brands;
  };
}
