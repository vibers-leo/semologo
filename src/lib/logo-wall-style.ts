import type { Brand, VariantManifest, VariantRecord } from './brands';
import { logoVariantForm } from './logo-variant-label';
import { wallVariant } from './logo-wall-variant';
export type WallStyle = { language?: 'auto'|'ko'|'en'|'bilingual'; bilingualLayout?: 'auto'|'horizontal'|'vertical'; form?: 'horizontal'|'wordmark'|'symbol'|'auto' };
type Language = 'ko'|'en'|'bilingual'|'none'|'unknown';
function language(v: VariantRecord): Language {
  if (v.text_layout?.startsWith('ko-en-')) return 'bilingual';
  if (v.text_layout === 'ko' || v.text_layout === 'en') return v.text_layout;
  return v.lang || 'unknown';
}
export function chooseWallStyle(brands: Brand[], manifests: Map<string, VariantManifest|null>, style: WallStyle = {}) {
  const choices = brands.map(brand => ({ brand, variants: (manifests.get(brand.id)?.variants || []).filter(v => typeof v?.key==='string' && typeof v.files?.png==='string' && (!v.files.svg || typeof v.files.svg==='string') && wallVariant(brand,v)) }));
  const coverage = (lang: string) => choices.filter(c => c.variants.some(v => language(v) === lang)).length;
  const targetLanguage = style.language && style.language !== 'auto' ? style.language : (['ko','en','bilingual'] as const).slice().sort((a,b) => coverage(b)-coverage(a) || ['ko','en','bilingual'].indexOf(a)-['ko','en','bilingual'].indexOf(b))[0];
  const targetLayout = style.bilingualLayout && style.bilingualLayout !== 'auto' ? style.bilingualLayout : (['horizontal','vertical'] as const).slice().sort((a,b) => choices.filter(c=>c.variants.some(v=>v.text_layout===`ko-en-${b}`)).length-choices.filter(c=>c.variants.some(v=>v.text_layout===`ko-en-${a}`)).length)[0];
  const targetForm = style.form && style.form !== 'auto' ? style.form : 'horizontal';
  return { language: targetLanguage, bilingualLayout: targetLayout, form: targetForm, items: choices.map(({brand,variants}) => {
    const score = (v: VariantRecord) => (language(v) === targetLanguage ? 100 : language(v)==='unknown' ? -10 : -35)
      + (logoVariantForm(v) === targetForm ? 55 : logoVariantForm(v)==='wordmark' ? 25 : logoVariantForm(v)==='symbol' ? -20 : 0)
      + (language(v)==='bilingual' ? v.text_layout===`ko-en-${targetLayout}` ? 25 : -25 : 0)
      + (v.files.png===brand.presentation?.file?4:v.key===manifests.get(brand.id)?.primary?2:0)
      - (/white|reversed|negative/i.test(v.color) ? 5 : 0)
      - (/역사|이전|구형|historical|legacy|old logo/i.test(v.label || '') ? 150 : 0);
    let picked:VariantRecord|undefined = variants.slice().sort((a,b) => score(b)-score(a) || a.key.localeCompare(b.key,'en'))[0];
    if(picked&&score(picked)<0)picked=undefined;
    const issues: string[] = [];
    if (!picked) issues.push(variants.length?'no_verified_matching_variant':'variant_metadata_unavailable');
    else {
      if(language(picked)!==targetLanguage && language(picked)!=='none')issues.push(language(picked)==='unknown'?'language_unverified':'language_fallback');
      if(logoVariantForm(picked)!==targetForm)issues.push('form_fallback');
      if(language(picked)==='bilingual' && picked.text_layout!==`ko-en-${targetLayout}`)issues.push('bilingual_layout_fallback');
    }
    return {brandId:brand.id,variantKey:picked?.key,variant:picked,issues};
  }) };
}
