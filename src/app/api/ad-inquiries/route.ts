import {createHash} from 'node:crypto';
import {after} from 'next/server';
import {trafficDb} from '@/lib/traffic-db';
import {validateInquiry} from '@/lib/ad-inquiry-input.mjs';
import {notifyInquiry} from '@/lib/inquiry-mail';
export const dynamic='force-dynamic';
export const maxDuration=60;
const reply=(b:unknown,s=200)=>Response.json(b,{status:s,headers:{'Cache-Control':'private, no-store'}});
export async function POST(request:Request){
 // No test/probe request can reach storage or mail delivery.
 if(request.headers.has('x-debug-probe'))return reply({probe:true,stored:false,sent:false});
 try{const origin=request.headers.get('origin');if(origin&&!['https://semologo.com','https://www.semologo.com',new URL(request.url).origin].includes(origin))return reply({error:'세모로고에서 문의를 보내 주세요.'},403);
 if(Number(request.headers.get('content-length'))>18000)return reply({error:'문의 내용을 조금 줄여 주세요.'},413);
 const raw=await request.text();if(raw.length>18000)return reply({error:'문의 내용을 조금 줄여 주세요.'},413);
 let data;try{data=JSON.parse(raw);}catch{return reply({error:'문의 내용을 확인해 주세요.'},400);}
 if(data?.probe===true||data?.name==='probe'||data?.email==='probe@example.com')return reply({probe:true,stored:false,sent:false});
 let x;try{x=validateInquiry(data);}catch(e){return reply({error:e instanceof Error?e.message:'문의 내용을 확인해 주세요.'},400);}
 const ip=request.headers.get('cf-connecting-ip')||request.headers.get('x-real-ip')||'anonymous';
 const hash=createHash('sha256').update(`${process.env.DB_VIBERS_MAIN_URL}:${ip}`).digest('hex');
 const c=await trafficDb().connect();try{await c.query('BEGIN');await c.query('SELECT pg_advisory_xact_lock(hashtext($1))',[hash]);
 const duplicate=await c.query('SELECT id FROM semologo.ad_inquiries WHERE id=$1',[x.id]);if(duplicate.rowCount){await c.query('COMMIT');return reply({ok:true,id:x.id},200);}
 const recent=await c.query("SELECT count(*)::int n FROM semologo.ad_inquiries WHERE requester_hash=$1 AND created_at>now()-interval '1 hour'",[hash]);if(recent.rows[0].n>=5){await c.query('ROLLBACK');return reply({error:'문의를 여러 번 보내셨어요. 한 시간 뒤에 다시 보내 주세요.'},429);}
 await c.query('INSERT INTO semologo.ad_inquiries(id,name,company,email,kind,message,attribution,requester_hash) VALUES($1,$2,$3,$4,$5,$6,$7::jsonb,$8)',[x.id,x.name,x.company,x.email,x.kind,x.message,JSON.stringify(x.attribution),hash]);await c.query('COMMIT');
 }catch(e){await c.query('ROLLBACK');throw e;}finally{c.release();}
 after(async()=>{try{await notifyInquiry(x.id);}catch{console.error('inquiry_notification_failed');}});
 return reply({ok:true,id:x.id},201);
 }catch{return reply({error:'지금 문의를 저장하지 못했어요. 잠시 후 다시 보내 주세요.'},503);}
}
