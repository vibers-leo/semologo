import type { WallStyle } from './logo-wall-style';
import { financeWallRoster } from './logo-wall-sector-rosters';
import { wallIdentityGroups } from './logo-wall-identities';
import type { Brand } from './brands';
import { logoWallLayout } from './logo-wall-layout';

export const wallSectors = {
  finance: ['금융·결제'], technology: ['IT·테크'], sports: ['스포츠'],
  public: ['공공·기관'], education: ['교육'], food: ['식품·음료'],
} as const;
export type WallSelectionInput = {
  names?: string[]; sector?: keyof typeof wallSectors; origin?: 'KR' | 'GLOBAL' | 'ALL';
  count?: number; title?: string; settings?: unknown; allowPartial?: boolean; style?: WallStyle;
};
export const normalizeWallName = (s: string) => s.normalize('NFKC').toLocaleLowerCase('en-US').replace(/[\s\p{P}\p{S}]/gu, '');
export function parseWallSelection(value: unknown): WallSelectionInput {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error('invalid_selection');
  const b = value as Record<string, unknown>;
  if (Object.keys(b).some(k => !['names','sector','origin','count','title','settings','allowPartial','style'].includes(k))) throw new Error('unknown_selection_field');
  const hasNames = Array.isArray(b.names) && b.names.length > 0;
  if ((b.names !== undefined && b.sector !== undefined) || hasNames === (b.sector !== undefined)) throw new Error('choose_names_or_sector');
  if (b.names !== undefined && (!Array.isArray(b.names) || b.names.length > 100 || b.names.some(n => typeof n !== 'string' || !n.trim() || !normalizeWallName(n) || n.length > 120))) throw new Error('invalid_names');
  if (b.sector !== undefined && (typeof b.sector !== 'string' || !Object.hasOwn(wallSectors, b.sector))) throw new Error('invalid_sector');
  if (b.origin !== undefined && !['KR','GLOBAL','ALL'].includes(String(b.origin))) throw new Error('invalid_origin');
  if (b.count !== undefined && (!Number.isInteger(b.count) || Number(b.count) < 1 || Number(b.count) > 100)) throw new Error('invalid_count');
  if (b.title !== undefined && (typeof b.title !== 'string' || !b.title.trim() || b.title.length > 120)) throw new Error('invalid_title');
  if (b.allowPartial !== undefined && typeof b.allowPartial !== 'boolean') throw new Error('invalid_partial');
  if (b.style !== undefined) {
    if (!b.style || typeof b.style !== 'object' || Array.isArray(b.style)) throw new Error('invalid_style');
    const rules:Record<string,string[]>={language:['auto','ko','en','bilingual'],bilingualLayout:['auto','horizontal','vertical'],form:['auto','horizontal','wordmark','symbol']};
    for(const [k,v] of Object.entries(b.style))if(!rules[k]?.includes(v as string))throw new Error('invalid_style');
  }
  // Reuse editor validation. Unknown layouts never reach storage.
  try { logoWallLayout(b.settings); } catch { throw new Error('invalid_settings'); }
  return b as WallSelectionInput;
}
export function selectableWallBrand(b: Brand) {
  return !b.hidden && !b.variant_of && !b.merged_into && !!(b.logo_png || b.preview_png || b.has_png || b.logo_svg || b.has_svg);
}
export function selectWallBrands(input: WallSelectionInput, candidates: Brand[]) {
  const visible = candidates.filter(selectableWallBrand);
  const canonical = new Map(visible.map(b => [b.id,b]));
  const normalized = visible.flatMap(b => {
    const group = wallIdentityGroups.find(g => (g.members as readonly string[]).includes(b.id));
    if (!group) return [b];
    const primary = canonical.get(group.canonical);
    return primary ? [{ ...primary, aliases: [...new Set([...(primary.aliases || []), ...group.members, ...visible.filter(v => (group.members as readonly string[]).includes(v.id)).flatMap(v => [v.name_ko,v.name_en,...(v.aliases || [])])])] }] : [];
  });
  const eligible = [...new Map(normalized.filter(b => !input.origin || input.origin === 'ALL' || b.origin === input.origin).map(b => [b.id, b])).values()];
  const selected: Brand[] = [];
  const unresolved: { query: string; reason: string; candidates: { id: string; name: string }[] }[] = [];
  if (input.names) {
    for (const query of input.names) {
      const n = normalizeWallName(query);
      const exact = eligible.filter(b => [b.id, b.name_ko, b.name_en, ...(b.aliases || [])].some(s => s && normalizeWallName(s) === n));
      if (exact.length !== 1) {
        unresolved.push({ query, reason: exact.length ? 'ambiguous' : 'not_found', candidates: exact.slice(0, 8).map(b => ({ id: b.id, name: b.name_ko || b.name_en })) });
      } else if (!selected.some(b => b.id === exact[0].id)) selected.push(exact[0]);
    }
  } else {
    const categories: readonly string[] = wallSectors[input.sector!];
    const pool = eligible.filter(b => categories.includes(b.category) && (input.sector !== 'finance' || financeWallRoster.includes(b.id)));
    pool.sort((a,b) => (b.fame || 0) - (a.fame || 0) || a.id.localeCompare(b.id, 'en'));
    selected.push(...pool.slice(0, input.count ?? 20));
    if (selected.length < (input.count ?? 20)) unresolved.push({ query: input.sector!, reason: 'insufficient_candidates', candidates: [] });
  }
  return { selected, unresolved, ready: selected.length > 0 && (unresolved.length === 0 || input.allowPartial === true), settings: logoWallLayout(input.settings),
    title: input.title?.trim() || (input.sector ? `${({ finance: '금융·결제', technology: 'IT·테크', sports: '스포츠', public: '공공기관', education: '교육', food: '식품·음료' })[input.sector]} 로고월` : '브랜드 로고월') };
}
