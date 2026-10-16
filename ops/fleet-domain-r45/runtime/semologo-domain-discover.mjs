import https from 'node:https';
import dns from 'node:dns/promises';
import {URL} from 'node:url';

export const MAX_DOMAINS = 12;
export const validDomain = value => typeof value === 'string' && value.length <= 253 &&
  /^(?=.{4,253}$)(?:[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z]{2,24}$/.test(value);

function publicV4(ip) {
  const p = ip.split('.').map(Number);
  if (p.length !== 4 || p.some(x => !Number.isInteger(x) || x < 0 || x > 255)) return false;
  const [a,b,c] = p;
  return !(a === 0 || a === 10 || a === 127 || a >= 224 ||
    (a === 100 && b >= 64 && b <= 127) || (a === 169 && b === 254) ||
    (a === 172 && b >= 16 && b <= 31) || (a === 192 && (b === 0 || b === 168)) ||
    (a === 198 && (b === 18 || b === 19)) || (a === 198 && b === 51 && c === 100) ||
    (a === 203 && b === 0 && c === 113));
}

export function firstPartyUrl(raw, base, domain) {
  let url; try { url = new URL(raw, base); } catch { return null; }
  if (url.protocol !== 'https:' || url.username || url.password || url.port ||
      ![domain, `www.${domain}`].includes(url.hostname.toLowerCase())) return null;
  url.hash = '';
  return url.href.length <= 512 ? url.href : null;
}

async function get(url, domain, signal, maxBytes, redirects=0) {
  const target = new URL(url);
  if (!firstPartyUrl(url, url, domain)) throw Error('Non-first-party URL');
  const addresses = await dns.resolve4(target.hostname);
  const ip = addresses.find(publicV4);
  if (!ip) throw Error('No public IPv4');
  return new Promise((resolve, reject) => {
    const req = https.get(target, {
      headers: {'user-agent':'SemoLogo-logo-discovery/1.0 (+https://semologo.com/)', accept:'text/html,text/plain;q=0.5'},
      timeout:7000, lookup:(_host,opts,callback)=>opts?.all?callback(null,[{address:ip,family:4}]):callback(null,ip,4),
      maxHeaderSize:16384, signal,
    }, response => {
      const chunks=[]; let size=0;
      response.on('data', part => { size += part.length; if (size > maxBytes) req.destroy(Error('Response too large')); else chunks.push(part); });
      response.on('end', () => resolve({status:response.statusCode, headers:response.headers, body:Buffer.concat(chunks).toString('utf8'),url}));
      response.on('error', reject);
    });
    req.on('timeout', () => req.destroy(Error('Timeout')));
    req.on('error', reject);
  }).then(result => {
    if ([301,302,303,307,308].includes(result.status) && result.headers.location && redirects < 2) {
      const next=firstPartyUrl(result.headers.location,url,domain);
      if (!next) throw Error('Redirect left first party');
      return get(next,domain,signal,maxBytes,redirects+1);
    }
    return result;
  });
}

function attrs(tag) {
  const out={};
  for (const match of tag.matchAll(/([\w:-]+)\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s>]+))/g)) out[match[1].toLowerCase()] = match[2] ?? match[3] ?? match[4];
  return out;
}

export function parseLogoSignals(html, page, domain) {
  const name = (/<meta\b[^>]*(?:property|name)=["']og:site_name["'][^>]*>/i.exec(html)?.[0] || '').match(/content=["']([^"']+)/i)?.[1] ||
    /<title[^>]*>([^<]*)<\/title>/i.exec(html)?.[1] || '';
  const candidates=[];
  for (const tag of html.match(/<(?:meta|img)\b[^>]{0,2000}>/gi) || []) {
    const a=attrs(tag), isMeta=tag.slice(1,5).toLowerCase()==='meta';
    const raw=isMeta ? (['og:logo','twitter:logo'].includes((a.property||a.name||'').toLowerCase()) ? a.content : null) :
      (/logo|brand/i.test([a.alt,a.class,a.id,a.src].join(' ')) ? a.src : null);
    const url=raw && firstPartyUrl(raw,page,domain);
    if (url && !candidates.includes(url)) candidates.push(url);
    if (candidates.length >= 3) break;
  }
  return {name:name.replace(/\s+/g,' ').trim().slice(0,120), logoCandidates:candidates};
}

async function inspect(domain, signal) {
  try {
    const robots=await get(`https://${domain}/robots.txt`,domain,signal,128000);
    if (robots.status !== 200 && robots.status !== 404) return {domain,status:'robots_unavailable'};
    if (robots.status === 200 && /(?:^|\n)\s*Disallow:\s*\/\s*(?:\r?\n|$)/i.test(robots.body))
      return {domain,status:'robots_disallowed'};
    const page=await get(`https://${domain}/`,domain,signal,512000);
    if (page.status !== 200 || !/^text\/html|^application\/xhtml\+xml/i.test(page.headers['content-type']||''))
      return {domain,status:'page_unavailable'};
    const parsed=parseLogoSignals(page.body,page.url,domain);
    return {domain,status:parsed.logoCandidates.length?'candidate_review_required':'no_logo_signal',pageUrl:`https://${domain}/`,...parsed};
  } catch (error) { return {domain,status:'failed',errorCode:String(error?.code || error?.message || 'unknown').slice(0,60)}; }
}

export async function discoverSemologoDomains(job,_config,signal,inspector=inspect) {
  const domains=job.input.domains;
  if (!Array.isArray(domains) || domains.length < 1 || domains.length > MAX_DOMAINS ||
      new Set(domains).size !== domains.length || !domains.every(validDomain)) throw Error('Invalid domain batch');
  const results=[];
  for (let i=0;i<domains.length;i+=4) {
    signal?.throwIfAborted();
    results.push(...await Promise.all(domains.slice(i,i+4).map(domain=>inspector(domain,signal))));
  }
  return {schemaVersion:1,jobId:job.id,project:job.project,kind:job.kind,commit:job.commit_sha,
    checkedAt:new Date().toISOString(),reviewStatus:'PENDING',results};
}
