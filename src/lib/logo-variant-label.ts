import type { VariantForm, VariantRecord } from './brands';

export const logoFormLabels: Record<VariantForm, string> = {
  lettermark: '레터마크', horizontal: '가로조합형', vertical: '세로조합형', symbol: '심볼마크', wordmark: '로고타입',
  emblem: '엠블럼', typography: '타이포그래피', mascot: '마스코트', unknown: '기타',
};

// Explicitly reviewed lockups take precedence over legacy aspect-based classification.
export function logoVariantForm(variant: VariantRecord): VariantForm {
  if (variant.lockup && variant.lockup !== 'unknown') return variant.lockup;
  // Legacy imports sometimes call a complete symbol + wordmark signature a
  // "wordmark". Its own explicit label is safer than that coarse form tag.
  if (/심볼\s*[+＋]\s*(?:워드마크|로고타입|텍스트)/.test(variant.label || '')) {
    if (/가로|좌우/.test(variant.label)) return 'horizontal';
    if (/세로|상하/.test(variant.label)) return 'vertical';
  }
  return variant.form || 'unknown';
}

const textLabels = {
  ko: '국문', en: '영문', 'ko-en-horizontal': '국영문 좌우조합',
  'ko-en-vertical': '국영문 상하조합', none: '', unknown: '',
};

/** Preserve source-specific names while displaying reviewed composition and text arrangement. */
export function logoVariantLabel(variant: VariantRecord): string {
  const form = logoFormLabels[logoVariantForm(variant)] || logoFormLabels.unknown;
  const text = variant.text_layout ? textLabels[variant.text_layout] : '';
  const label = variant.label || '';
  // A reviewed signature name already describes the complete composition.
  if (variant.mark_type && /좌우조합|상하조합/.test(label)) return label;
  if (logoVariantForm(variant) === 'lettermark' && label) return label;
  return [label.includes(form) ? '' : form, text && !label.includes(text) ? text : '', label].filter(Boolean).join(' · ');
}
