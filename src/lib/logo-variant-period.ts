type PeriodMetadata = { historical?: boolean; current_artwork?: boolean; usage?: string };
export type LogoVariantPeriod = 'current' | 'undated' | 'historical' | 'all';

export function logoVariantPeriod(variant: PeriodMetadata): Exclude<LogoVariantPeriod, 'all'> {
  if (variant.historical === true || variant.usage === 'historical-logo') return 'historical';
  return variant.current_artwork === true ? 'current' : 'undated';
}

/** Preserve ordinary galleries; split only when an explicitly historical logo exists. */
export function groupLogoVariantsByPeriod<T extends PeriodMetadata>(variants: readonly T[]) {
  if (!variants.some(variant => logoVariantPeriod(variant) === 'historical')) {
    return [{ period: 'all' as LogoVariantPeriod, title: '', variants: [...variants] }];
  }
  const periods = [
    ['current', '현재 로고'], ['undated', '시기 미확인 로고'], ['historical', '이전 로고'],
  ] as const;
  return periods.map(([period, title]) => ({
    period: period as LogoVariantPeriod, title,
    variants: variants.filter(variant => logoVariantPeriod(variant) === period),
  })).filter(group => group.variants.length > 0);
}
