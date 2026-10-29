import { cdnPng } from './logo-wall-cdn';
import { wallVariant } from './logo-wall-variant';
import { wallInkMetrics } from './logo-wall-ink';
import { balancedWallScales, type WallInk } from './logo-wall-balance';
import { chooseWallStyle } from './logo-wall-style';
import { currentWallManifest } from './logo-wall-manifest';
import { Pool, type PoolClient } from 'pg';
import { financeWallRoster } from './logo-wall-sector-rosters';
import { wallIdentityGroups } from './logo-wall-identities';
import { cmsBrand } from './cms-brand';
import { parseWallSelection, selectWallBrands, wallSectors } from './logo-wall-selection';
import { logoWallPngCandidates } from './logo-png-source';
import { handleLogoWalls } from './logo-wall-store';

let pool: Pool | undefined;
export async function prepareLogoWall(value: unknown) {
  const input = parseWallSelection(value);
  if (input.sector && !input.origin) input.origin = 'KR';
  if (!process.env.DB_VIBERS_MAIN_URL) throw new Error('storage_unavailable');
  pool ??= new Pool({ connectionString: process.env.DB_VIBERS_MAIN_URL, max: 2, connectionTimeoutMillis: 5000, query_timeout: 8000 });
  const visibility = "status='published' AND coalesce(payload->>'hidden','false')<>'true' AND nullif(payload->>'variant_of','') IS NULL AND nullif(payload->>'merged_into','') IS NULL";
  let result;
  if (input.names) {
    // Exact folded names and aliases only; no LIKE wildcards or inferred domain ownership.
    const names = input.names.map(s => s.normalize('NFKC').toLowerCase().replace(/[\s\p{P}\p{S}]/gu,''));
    for (const group of wallIdentityGroups) if (group.members.some(id => names.includes(id.replace(/[\s\p{P}\p{S}]/gu,'')))) names.push(group.canonical);
    result = await pool.query(`SELECT id,payload FROM semologo.logo_posts WHERE ${visibility} AND (
      regexp_replace(lower(id),'[[:space:][:punct:]]','','g')=ANY($1::text[])
      OR regexp_replace(lower(payload->>'name_ko'),'[[:space:][:punct:]]','','g')=ANY($1::text[])
      OR regexp_replace(lower(payload->>'name_en'),'[[:space:][:punct:]]','','g')=ANY($1::text[])
      OR EXISTS(SELECT 1 FROM jsonb_array_elements_text(CASE WHEN jsonb_typeof(payload->'aliases')='array' THEN payload->'aliases' ELSE '[]'::jsonb END) AS alias(value) WHERE regexp_replace(lower(alias.value),'[[:space:][:punct:]]','','g')=ANY($1::text[]))) ORDER BY id LIMIT 1001`, [names]);
    if (result.rows.length > 1000) throw new Error('too_many_identity_candidates');
  } else {
    result = await pool.query(`SELECT id,payload FROM semologo.logo_posts WHERE ${visibility}
      AND payload->>'category'=ANY($1::text[]) AND ($2='ALL' OR payload->>'origin'=$2) AND ($3::text[] IS NULL OR id=ANY($3::text[]))
      ORDER BY CASE WHEN payload->>'fame' ~ '^[0-9]{1,9}$' THEN (payload->>'fame')::int ELSE 0 END DESC,id LIMIT 400`, [wallSectors[input.sector!], input.origin, input.sector === 'finance' ? financeWallRoster : null]);
  }
  const resolution = selectWallBrands(input, result.rows.map(r => cmsBrand(r.id, r.payload)));
  const manifests=new Map();
  for(let i=0;i<resolution.selected.length;i+=4){
    await Promise.all(resolution.selected.slice(i,i+4).map(async b=>manifests.set(b.id,await currentWallManifest(b.id,pool!))));
  }
  const visual=chooseWallStyle(resolution.selected,manifests,input.style);
  return { input, resolution, visual };
}
export function publicWallPlan(prepared: Awaited<ReturnType<typeof prepareLogoWall>>) {
  const r = prepared.resolution;
  const selected=new Map(prepared.visual.items.map(x=>[x.brandId,x]));
  return { title: r.title, settings: r.settings, ready: r.ready, unresolved: r.unresolved,
    items: r.selected.map(b => ({ brandId: b.id, variantKey:selected.get(b.id)?.variantKey, styleIssues:selected.get(b.id)?.issues, name: b.name_ko || b.name_en, category: b.category, origin: b.origin ?? null, previewUrl: logoWallPngCandidates(selected.get(b.id)?.variant ? wallVariant(b,selected.get(b.id)!.variant!)! : b)[0] ?? null })),
    selectionBasis: prepared.input.sector ? prepared.input.sector === 'finance' ? 'editorial Korean finance shortlist; visible published brands only; fame then canonical ID' : 'catalogue-category; Korea by default; fame then canonical ID' : 'exact name, alias or canonical ID',
    visualStyle:{language:prepared.visual.language,bilingualLayout:prepared.visual.bilingualLayout,form:prepared.visual.form}, ownerVerification: 'not implied by catalogue inclusion' };
}
export async function generateLogoWall(request: Request, owner: string, value: unknown, save: boolean, context?: {client:PoolClient;update?:{id:string;version:number}}) {
  const prepared = await prepareLogoWall(value);
  const plan = publicWallPlan(prepared);
  if (!save) return Response.json({ plan }, { headers: { 'Cache-Control': 'private, no-store' } });
  if (!plan.ready) return Response.json({ error: 'selection_needs_review', plan }, { status: 409 });
  const metrics:WallInk[]=new Array(plan.items.length);const failures:string[]=[];const deadline=Date.now()+12000;
  let cursor=0;
  await Promise.all(Array.from({length:Math.min(3,plan.items.length)},async()=>{
    while(cursor<plan.items.length){const i=cursor++;const b=prepared.resolution.selected[i];const v=prepared.visual.items[i].variant;
      try{const asset=v?wallVariant(b,v)!:b;metrics[i]=await wallInkMetrics(await cdnPng(asset,!!v,deadline));}catch{failures.push(b.id);}
    }
  }));
  if(failures.length)return Response.json({error:'assets_not_ready',brandIds:failures,plan},{status:409});
  const scales=balancedWallScales(metrics);
  const internal = new Request(new URL('/api/logo-walls/'+(context?.update?`?id=${encodeURIComponent(context.update.id)}`:''), request.url), {
    method: context?.update?'PUT':'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ title: plan.title, version:context?.update?.version, settings: plan.settings, items: plan.items.map((b,i) => ({brandId:b.brandId,variantKey:b.variantKey,scale:scales[i]})) }),
  });
  // Reuse the web editor's ownership validation, manifest resolution and storage transaction.
  const response = await handleLogoWalls(internal, owner,context?.client);
  const data = await response.json();
  if (!response.ok) return Response.json(data, { status: response.status });
  return Response.json({ ...data, plan, editorPath: `/logo-walls/?wall=${encodeURIComponent(data.wall.id)}` }, { status: response.status, headers: { 'Cache-Control': 'private, no-store' } });
}
