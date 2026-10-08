"use client";
import { useCallback, useEffect, useState } from 'react';
import { onAuthStateChanged } from 'firebase/auth';
import { getClientAuth } from '@/lib/firebase';
import type { LogoPost } from '@/lib/logo-posts';
import { logoPngCandidates } from '@/lib/logo-png-source';
import Header from '@/components/Header';
type ManagedLogoPost=LogoPost & {logo_version?:{year:number|null;label:string;review_status:string}};
const labels={published:'게시 중',draft:'검수 대기',archived:'보관'};
export default function AdminPostsPage(){
 const [ready,setReady]=useState(false),[admin,setAdmin]=useState(false),[posts,setPosts]=useState<ManagedLogoPost[]>([]),[error,setError]=useState(''),[loading,setLoading]=useState(false),[busy,setBusy]=useState('');
 const [query,setQuery]=useState(''),[search,setSearch]=useState(''),[status,setStatus]=useState<keyof typeof labels>('published'),[page,setPage]=useState(1),[total,setTotal]=useState(0);
 const refresh=useCallback(async(signal?:AbortSignal)=>{
  setLoading(true);setError('');setPosts([]);
  try{const token=await getClientAuth().currentUser?.getIdToken();if(!token)throw Error('관리자 로그인이 필요해요.');
   const r=await fetch(`/api/admin/logo-posts/?status=${status}&q=${encodeURIComponent(search)}&page=${page}`,{headers:{Authorization:`Bearer ${token}`},cache:'no-store',signal});const data=await r.json();if(!r.ok)throw Error(data.error);if(!signal?.aborted){setPosts(data.posts);setTotal(data.total);}
  }catch(e){if(!signal?.aborted)setError(e instanceof Error?e.message:'목록을 불러오지 못했어요.');}finally{if(!signal?.aborted)setLoading(false);}
 },[status,search,page]);
 useEffect(()=>onAuthStateChanged(getClientAuth(),u=>{setAdmin(u?.email?.toLowerCase()==='juuuno1116@gmail.com');setReady(true);}),[]);
 useEffect(()=>{if(!admin)return;const c=new AbortController();void refresh(c.signal);return()=>c.abort();},[admin,refresh]);
 async function change(post:LogoPost,next:keyof typeof labels){setBusy(post.id);setError('');try{const token=await getClientAuth().currentUser?.getIdToken();const r=await fetch('/api/admin/logo-posts/',{method:'PATCH',headers:{Authorization:`Bearer ${token}`,'Content-Type':'application/json'},body:JSON.stringify({id:post.id,status:next})});const data=await r.json();if(!r.ok)throw Error(data.error);await refresh();}catch(e){setError(e instanceof Error?e.message:'저장하지 못했어요.');}finally{setBusy('');}}
 return <div style={{minHeight:'100vh',background:'var(--bg)'}}><Header/><main style={{maxWidth:1000,margin:'0 auto',padding:'32px 16px'}}>
 <h1 style={{fontSize:24,fontWeight:800}}>로고 콘텐츠 관리</h1><p style={{color:'var(--text-secondary)',fontSize:13,margin:'8px 0 20px'}}>수집한 로고를 검색하고 게시 상태를 관리해요. 보관해도 원본 파일은 유지돼요.</p>
 {!ready?<p>불러오는 중이에요.</p>:!admin?<p>관리자 계정으로 로그인해 주세요. <a href="/login/">로그인</a></p>:<>
 <form onSubmit={e=>{e.preventDefault();setPage(1);setSearch(query);}} style={{display:'flex',gap:8,flexWrap:'wrap',marginBottom:16}}><input aria-label="로고 이름 검색" placeholder="로고 이름으로 검색" value={query} onChange={e=>setQuery(e.target.value)} style={{padding:10,border:'1px solid var(--border)',borderRadius:8,flex:1,minWidth:180}}/><button type="submit">검색</button><select aria-label="게시 상태" value={status} onChange={e=>{setStatus(e.target.value as keyof typeof labels);setPage(1);}}>{Object.entries(labels).map(([k,v])=><option key={k} value={k}>{v}</option>)}</select></form>
 {error&&<p role="alert" style={{color:'#dc2626'}}>{error} <button onClick={()=>void refresh()}>다시 불러오기</button></p>}
 <p aria-live="polite" style={{fontSize:13,color:'var(--text-secondary)'}}>{loading?'불러오는 중이에요.':`${labels[status]} ${total.toLocaleString()}개`}</p>
 {!loading&&!error&&!posts.length&&<p>조건에 맞는 로고가 없어요.</p>}
 <div style={{display:'grid',gap:10,marginTop:12}}>{posts.map(post=><article key={post.id} style={{border:'1px solid var(--border)',borderRadius:12,padding:12,display:'flex',alignItems:'center',gap:12,flexWrap:'wrap'}}><img src={logoPngCandidates(post)[0]} alt="" style={{width:80,height:50,objectFit:'contain',background:post.light?'#27272a':'#f4f4f5',borderRadius:6}} onError={e=>{e.currentTarget.style.visibility='hidden';}}/><div style={{flex:1,minWidth:120}}><b>{post.name_ko}</b><p style={{fontSize:12,marginTop:4,color:'var(--text-secondary)'}}>{post.category} · {labels[post.status]} · {post.logo_version?.year ? `${post.logo_version.year}년 로고` : '도입 연도 미확인'}</p></div><a href={`/brand/${encodeURIComponent(post.id)}/`} target="_blank" rel="noopener noreferrer">콘텐츠 보기</a><button disabled={busy===post.id} onClick={()=>void change(post,post.status==='published'?'archived':'published')}>{busy===post.id?'저장 중…':post.status==='published'?'보관하기':'게시하기'}</button></article>)}</div>
 <nav aria-label="페이지 이동" style={{display:'flex',gap:12,marginTop:20,alignItems:'center'}}><button disabled={page<=1||loading} onClick={()=>setPage(p=>p-1)}>이전</button><span>{page} / {Math.max(1,Math.ceil(total/50))}</span><button disabled={page*50>=total||loading} onClick={()=>setPage(p=>p+1)}>다음</button></nav></>}
 </main></div>;
}
