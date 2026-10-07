export const TRAFFIC_EVENTS = ['page_view', 'search_submitted', 'search_no_result', 'brand_opened', 'logo_downloaded'] as const;
const clean = (value: unknown, max = 160) => typeof value === 'string' ? value.replace(/[\u0000-\u001f]/g, '').slice(0, max) : '';
export function normalizeTraffic(value: unknown) {
  if (!value || typeof value !== 'object') return null;
  const b = value as Record<string, unknown>;
  if (!/^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i.test(String(b.session_id)) || !TRAFFIC_EVENTS.includes(b.event as typeof TRAFFIC_EVENTS[number])) return null;
  const p = b.params && typeof b.params === 'object' ? b.params as Record<string, unknown> : {};
  const a = b.attribution && typeof b.attribution === 'object' ? b.attribution as Record<string, unknown> : {};
  const attribution: Record<string, string> = {};
  for (const key of ['utm_source', 'utm_medium', 'utm_campaign', 'utm_content', 'utm_term']) attribution[key] = clean(a[key], 80);
  for (const key of ['landing_path', 'referrer']) {
    try { const url = new URL(clean(a[key], 1000), 'https://semologo.com'); attribution[key] = key === 'referrer' ? url.hostname : url.pathname.slice(0, 250); } catch { attribution[key] = ''; }
  }
  const path = clean(b.path, 250).split(/[?#]/)[0];
  return { session: b.session_id as string, event: b.event as string, path: path.startsWith('/') ? path : '/', attribution,
    params: { search_term: clean(p.search_term, 120), brand_id: clean(p.brand_id, 120), file_name: clean(p.file_name, 160), download_method: clean(p.download_method, 30), result_count: typeof p.result_count === 'number' && Number.isFinite(p.result_count) ? Math.max(0, Math.min(1_000_000, Math.floor(p.result_count))) : null } };
}
