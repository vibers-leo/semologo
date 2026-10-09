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
    // Reviewed catalog data stays authoritative; newly published CMS records remain searchable.
    for (const brand of cms) {
      const reviewed = merged.get(brand.id);
      if (!reviewed) merged.set(brand.id, brand);
      else if (brand.logo_published_at && Number.isFinite(Date.parse(brand.logo_published_at))) {
        merged.set(brand.id, { ...reviewed, logo_published_at: brand.logo_published_at });
      }
    }
    const brands = [...merged.values()];
    cached = { catalog, cms, brands };
    return brands;
  };
}
