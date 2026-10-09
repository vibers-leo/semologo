import { trafficAdmin, trafficDb } from '@/lib/traffic-db';
import { validPresentation } from '@/lib/logo-presentation';
import { cmsBrand } from '@/lib/cms-brand';
import { SUBMITTED_BRANDS } from "@/lib/submissions";
import { SIMPLE_ICONS_BRANDS } from "@/lib/simple-icons-submissions";
import { STREAMING_SUBMISSIONS } from "@/lib/streaming-submissions";
import { INDEX_REVIEW_BRANDS } from "@/lib/index-candidate-review-submissions";
import { fetchBrand } from '@/lib/brands';
import { CDN } from '@/lib/cdn';
import { revalidatePath } from 'next/cache';
export const dynamic='force-dynamic';
const reply=(body:unknown,status=200)=>Response.json(body,{status,headers:{'Cache-Control':'no-store'}});
export async function GET(request:Request){
 try{const id=new URL(request.url).searchParams.get('id');if(id&&!/^[\p{L}\p{N}._-]{1,200}$/u.test(id))return reply({error:'로고를 확인해 주세요.'},400);
 const rows=await trafficDb().query("SELECT id,payload->'presentation' presentation FROM semologo.logo_posts WHERE status='published' AND payload ? 'presentation' AND ($1::text IS NULL OR id=$1)",[id]);
 return reply({presentations:Object.fromEntries(rows.rows.filter(r=>validPresentation(r.presentation)).map(r=>[r.id,r.presentation]))});
 }catch{return reply({error:'대표 이미지를 불러오지 못했어요.'},503);}
}
export async function PATCH(request:Request){
 try{if(!await trafficAdmin(request))return reply({error:'관리자 로그인이 필요해요.'},403);
 let input;try{input=await request.json();}catch{return reply({error:'선택한 이미지를 확인해 주세요.'},400);}
 if(typeof input.id!=='string'||!/^[\p{L}\p{N}._-]{1,200}$/u.test(input.id)||!validPresentation({file:input.file,bg:input.bg}))return reply({error:'이미지와 배경을 확인해 주세요.'},400);
 const db=trafficDb();let old=await db.query('SELECT payload FROM semologo.logo_posts WHERE id=$1',[input.id]);
 // Some index catalogs are served before they are imported into the CMS.
 // Only server-resolved catalog records may initialize a missing CMS identity.
 if(!old.rows[0]){
  const registered=[...SUBMITTED_BRANDS,...SIMPLE_ICONS_BRANDS,...STREAMING_SUBMISSIONS,...INDEX_REVIEW_BRANDS].find(b=>b.id===input.id);
  const catalog=registered ? cmsBrand(input.id,registered as unknown as Record<string,unknown>) : await fetchBrand(input.id);
  if(!catalog||catalog.id!==input.id||catalog.hidden)return reply({error:'로고를 찾지 못했어요.'},404);
  await db.query("INSERT INTO semologo.logo_posts(id,payload,status) VALUES($1,$2::jsonb,'published') ON CONFLICT(id) DO NOTHING",[input.id,JSON.stringify(catalog)]);
  old=await db.query('SELECT payload FROM semologo.logo_posts WHERE id=$1',[input.id]);
 }
 if(!old.rows[0])return reply({error:'로고를 찾지 못했어요.'},404);
 const brand=cmsBrand(input.id,old.rows[0].payload);if(brand.rejected_asset_files?.includes(input.file))return reply({error:'검수에서 제외한 파일은 선택할 수 없어요.'},400);
 const r=await fetch(`${CDN}/${encodeURIComponent(input.id)}/${input.file}`,{cache:'no-store',redirect:'error',signal:AbortSignal.timeout(8000)});
 if(!r.ok||!/^image\/png(?:;|$)/i.test(r.headers.get('content-type')||''))return reply({error:'사용할 수 있는 이미지 파일인지 확인해 주세요.'},400);
 const raw=await r.arrayBuffer();if(raw.byteLength===0||raw.byteLength>8_000_000)return reply({error:'이미지 파일을 확인해 주세요.'},400);
 const value={file:input.file,bg:input.bg};await db.query("UPDATE semologo.logo_posts SET payload=jsonb_set(payload,'{presentation}',$2::jsonb),updated_at=now() WHERE id=$1",[input.id,JSON.stringify(value)]);
 revalidatePath('/','page');revalidatePath(`/brand/${input.id}/`,'page');return reply({ok:true,presentation:value});
 }catch{return reply({error:'대표 이미지를 저장하지 못했어요. 다시 시도해 주세요.'},503);}
}
