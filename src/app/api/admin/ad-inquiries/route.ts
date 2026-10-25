import {after} from 'next/server';
import {trafficAdmin,trafficDb} from '@/lib/traffic-db';
import {notifyInquiry} from '@/lib/inquiry-mail';
export const dynamic='force-dynamic';
export const maxDuration=60;
const reply=(b:unknown,s=200)=>Response.json(b,{status:s,headers:{'Cache-Control':'private, no-store'}});
export async function GET(request:Request){try{if(!await trafficAdmin(request))return reply({error:'관리자 로그인이 필요해요.'},403);
 const u=new URL(request.url);const q=(u.searchParams.get('q')||'').slice(0,120);const status=u.searchParams.get('status')||'all';
 const r=await trafficDb().query("SELECT id,name,company,email,kind,message,status,admin_note,attribution,email_status,email_results,created_at FROM semologo.ad_inquiries WHERE expires_at>now() AND ($1='all' OR status=$1) AND ($2='' OR strpos(lower(name||' '||company||' '||email||' '||message||' '||attribution::text),lower($2))>0) ORDER BY created_at DESC LIMIT 200",[status,q]);return reply({inquiries:r.rows});
 }catch{return reply({error:'문의를 불러오지 못했어요.'},503);}}
export async function PATCH(request:Request){try{if(!await trafficAdmin(request))return reply({error:'관리자 로그인이 필요해요.'},403);const x=await request.json();if(typeof x.id!=='string'||!/^[-a-f0-9]{36}$/i.test(x.id))return reply({error:'문의를 확인해 주세요.'},400);
 if(x.retryEmail===true){after(async()=>{try{await notifyInquiry(x.id);}catch{console.error('inquiry_notification_retry_failed');}});return reply({ok:true});}
 if(!['pending','reviewing','replied','closed'].includes(x.status)||typeof x.admin_note!=='string'||x.admin_note.length>5000)return reply({error:'상태와 메모를 확인해 주세요.'},400);
 const r=await trafficDb().query('UPDATE semologo.ad_inquiries SET status=$2,admin_note=$3,updated_at=now() WHERE id=$1 AND expires_at>now() RETURNING id',[x.id,x.status,x.admin_note]);return r.rowCount?reply({ok:true}):reply({error:'문의를 찾지 못했어요.'},404);
 }catch{return reply({error:'문의를 저장하지 못했어요.'},503);}}
