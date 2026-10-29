export const consoleScopes = ['walls:read', 'walls:write', 'collection:request'] as const;
export type ConsoleScope = typeof consoleScopes[number];
export type ConsoleKey = { id: string; name: string; key_prefix: string; scopes: ConsoleScope[]; created_at: string; expires_at: string; revoked_at: string | null; last_used_at: string | null };
export const usageLabels = { wall_plan: '로고월 준비', wall_create: '로고월 만들기', wall_read: '로고월 조회', wall_preview: '미리보기', collection_request: '누락 로고 수집 요청', collection_resume: '수집 반영 확인' } as const;
export type ConsoleGrant = { id: string; metric: keyof typeof usageLabels; state: string; period_start: string; period_end: string; hard_limit: number; used_units: number; reserved_units: number; remaining_units: number };
export type ConsolePilot = { eligible: true; provisioned: boolean; durationDays: number; unitsPerMetric: number };
const record = (v: unknown): v is Record<string, unknown> => !!v && typeof v === 'object' && !Array.isArray(v);
const date = (v: unknown): v is string => typeof v === 'string' && Number.isFinite(Date.parse(v));
const nullableDate = (v: unknown): v is string | null => v === null || date(v);
const uuid = /^[a-f0-9]{8}-(?:[a-f0-9]{4}-){3}[a-f0-9]{12}$/i;
export const secretToken = (value: unknown): value is string => typeof value === 'string' && /^slk_[A-Za-z0-9_-]{43}$/.test(value);
export function keySummary(value: unknown): ConsoleKey {
  if (!record(value) || typeof value.id !== 'string' || !uuid.test(value.id) || typeof value.name !== 'string' || value.name.length > 80 || typeof value.key_prefix !== 'string' || !/^slk_[A-Za-z0-9_-]{8}$/.test(value.key_prefix) || !Array.isArray(value.scopes) || value.scopes.some(s => !consoleScopes.includes(s)) || !date(value.created_at) || !date(value.expires_at) || !nullableDate(value.revoked_at) || !nullableDate(value.last_used_at)) throw Error('invalid_console_response');
  return { id: value.id, name: value.name.replace(/slk_[A-Za-z0-9_-]{43}/g, '보호된 키 이름'), key_prefix: value.key_prefix, scopes: value.scopes, created_at: value.created_at, expires_at: value.expires_at, revoked_at: value.revoked_at, last_used_at: value.last_used_at };
}
export function keyList(value: unknown): ConsoleKey[] {
  if (!record(value) || !Array.isArray(value.keys) || value.keys.length > 100) throw Error('invalid_console_response');
  return value.keys.map(keySummary);
}
export function keyState(key: ConsoleKey, now = Date.now()) { return key.revoked_at ? 'revoked' : Date.parse(key.expires_at) <= now ? 'expired' : 'active'; }
const number = (v: unknown) => { const n = typeof v === 'string' && /^\d+$/.test(v) ? Number(v) : v; if (typeof n !== 'number' || !Number.isSafeInteger(n) || n < 0 || n > 1_000_000_000) throw Error('invalid_console_response'); return n; };
export function grantList(value: unknown): ConsoleGrant[] {
  if (!record(value) || !Array.isArray(value.entitlements) || value.entitlements.length > 100) throw Error('invalid_console_response');
  return value.entitlements.map(v => {
    if (!record(v) || typeof v.id !== 'string' || !uuid.test(v.id) || typeof v.metric !== 'string' || !Object.prototype.hasOwnProperty.call(usageLabels, v.metric) || !['active', 'suspended', 'ended'].includes(String(v.state)) || !date(v.period_start) || !date(v.period_end)) throw Error('invalid_console_response');
    return { id: v.id, metric: v.metric as ConsoleGrant['metric'], state: v.state as string, period_start: v.period_start, period_end: v.period_end, hard_limit: number(v.hard_limit), used_units: number(v.used_units), reserved_units: number(v.reserved_units), remaining_units: number(v.remaining_units) };
  });
}
export function pilotSummary(value: unknown): ConsolePilot | null {
  if (!record(value) || !record(value.pilot) || value.pilot.eligible !== true || typeof value.pilot.provisioned !== 'boolean') return null;
  return { eligible: true, provisioned: value.pilot.provisioned, durationDays: number(value.pilot.durationDays), unitsPerMetric: number(value.pilot.unitsPerMetric) };
}
export const consoleDate = (value: string | null) => value ? new Intl.DateTimeFormat('ko-KR', { year: 'numeric', month: 'short', day: 'numeric' }).format(new Date(value)) : '아직 사용하지 않음';
export function grantState(grant: ConsoleGrant, now = Date.now()) { return grant.state === 'suspended' ? '일시 중지' : grant.state !== 'active' || Date.parse(grant.period_end) <= now ? '기간 종료' : Date.parse(grant.period_start) > now ? '시작 전' : '사용 중'; }
export class ConsoleApiError extends Error { constructor(public status: number, public code: string) { super('console_api_error'); } }
export function consoleFailure(error: unknown) {
  if (error instanceof ConsoleApiError) {
    if (error.status === 401) return { kind: 'auth' as const, message: '로그인 시간이 지났어요. 다시 로그인하면 이어서 사용할 수 있어요.' };
    if (error.status === 403 && error.code === 'pilot_invite_required') return { kind: 'invite' as const, message: '지금은 초대된 계정만 이용할 수 있어요. 로그인한 Google 계정을 확인해 주세요.' };
    if (error.status === 503) return { kind: 'preparing' as const, message: '파일럿을 준비 중이에요. 잠시 후 다시 불러와 주세요.' };
    if (error.code === 'api_key_limit') return { kind: 'error' as const, message: '활성 키는 최대 5개까지 사용할 수 있어요. 사용하지 않는 키를 회수하거나 잠시 후 다시 시도해 주세요.' };
    if (error.code === 'invalid_key_request') return { kind: 'error' as const, message: '키 이름과 사용 권한을 확인해 주세요.' };
  }
  return { kind: 'error' as const, message: '연결하지 못했어요. 잠시 후 다시 불러와 주세요.' };
}
