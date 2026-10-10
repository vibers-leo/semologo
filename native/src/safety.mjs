export function brandId(value) { return typeof value === 'string' && /^[a-zA-Z0-9][a-zA-Z0-9_-]{0,159}$/.test(value) ? value : null; }
export function publicLogo(value) {
  try { const u=new URL(value); return u.protocol==='https:' && ['logo.vibers.co.kr','semologo.com'].includes(u.hostname) && !u.username && !u.password && /\.(?:png|svg)(?:$)/i.test(u.pathname) ? u.href : null; } catch { return null; }
}
export function brandPage(id) { const valid=brandId(id); if (!valid) throw new Error('invalid brand');return `https://semologo.com/brand/${encodeURIComponent(valid)}/`; }
export function deepLink(url) { try { const u=new URL(url);return u.protocol==='https:' && u.hostname==='semologo.com' && /^\/brand\/([\w-]+)\/$/.test(u.pathname) ? brandId(u.pathname.split('/')[2]) : null; } catch { return null; } }
