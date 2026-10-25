import {trafficAdmin,trafficDb} from '@/lib/traffic-db';
import {validateStory,storyWriteSql} from '@/lib/story-input.mjs';
export const dynamic='force-dynamic';
const reply=(b:unknown,s=200)=>Response.json(b,{status:s,headers:{'Cache-Control':'private, no-store'}});
export async function GET(request:Request){try{if(!await trafficAdmin(request))return reply({error:'관리자 로그인이 필요해요.'},403);
 const slug=new URL(request.url).searchParams.get('slug');
 const r=await trafficDb().query('SELECT slug,status,payload,revision,updated_at FROM semologo.stories WHERE ($1::text IS NULL OR slug=$1) ORDER BY updated_at DESC LIMIT 200',[slug]);
 return reply({stories:r.rows.map(r=>({...r.payload,status:r.status,revision:r.revision,updated_at:r.updated_at}))});
 }catch{return reply({error:'글을 불러오지 못했어요. 다시 시도해 주세요.'},503);}}
export async function PUT(request:Request){try{if(!await trafficAdmin(request))return reply({error:'관리자 로그인이 필요해요.'},403);
 if(Number(request.headers.get('content-length'))>220000)return reply({error:'글의 용량을 줄여 주세요.'},413);
 const raw=await request.text();if(raw.length>220000)return reply({error:'글의 용량을 줄여 주세요.'},413);
 let x;try{x=validateStory(JSON.parse(raw));}catch(e){return reply({error:e instanceof Error?e.message:'글 내용을 확인해 주세요.'},400);}
 const c=await trafficDb().connect();try{await c.query('BEGIN');
 const r=await c.query(storyWriteSql,[x.slug,x.status,JSON.stringify(x.payload),x.revision]);
 if(r.rowCount!==1){await c.query('ROLLBACK');return reply({error:'다른 곳에서 글을 수정했어요. 목록에서 다시 열어 주세요.'},409);}
 const revision=r.rows[0].revision;await c.query('INSERT INTO semologo.story_revisions(slug,revision,status,payload,actor) VALUES($1,$2,$3,$4::jsonb,$5)',[x.slug,revision,x.status,JSON.stringify(x.payload),'admin']);await c.query('COMMIT');return reply({ok:true,revision});
 }catch(e){await c.query('ROLLBACK');throw e;}finally{c.release();}
 }catch{return reply({error:'글을 저장하지 못했어요. 다시 시도해 주세요.'},503);}}
