'use client';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import { onAuthStateChanged } from 'firebase/auth';
import { getClientAuth } from '@/lib/firebase';
import Header from '@/components/Header';
type Visit = { session_id: string; first_seen: string; last_seen: string; attribution: Record<string,string>; device: string; browser: string; events: { event: string; path: string; params: Record<string,string|number|null>; created_at: string }[] | null };
type Stats = { sessions: Visit[]; visitors: number; summary: {event:string;count:number}[]; searches: {term:string;count:number}[]; downloads: {brand:string;count:number}[] };
const labels: Record<string,string> = { page_view:'페이지 방문', search_submitted:'검색', search_no_result:'검색 결과 없음', brand_opened:'로고 열람', logo_downloaded:'다운로드 선택' };
export default function TrafficAdmin() {
  const [days,setDays]=useState(7); const [q,setQ]=useState(''); const [filter,setFilter]=useState(''); const [tick,setTick]=useState(0);
  const [data,setData]=useState<Stats|null>(null); const [error,setError]=useState(''); const [loading,setLoading]=useState(true);
  useEffect(()=>{const abort=new AbortController();const unsub=onAuthStateChanged(getClientAuth(), async user=>{
    setLoading(true);setError('');setData(null);
    if (!user) {setError('관리자 계정으로 로그인해 주세요.');setLoading(false);return;}
    try {const token=await user.getIdToken();const r=await fetch(`/api/admin/traffic/?days=${days}&q=${encodeURIComponent(filter)}`,{headers:{Authorization:`Bearer ${token}`},cache:'no-store',signal:abort.signal});const j=await r.json();if(!r.ok)throw Error(j.error);setData(j);}catch(e){if(!abort.signal.aborted)setError(e instanceof Error?e.message:'불러오지 못했어요.');}finally{if(!abort.signal.aborted)setLoading(false);}
  });return()=>{abort.abort();unsub();};},[days,filter,tick]);
  const n=(event:string)=>data?.summary.find(x=>x.event===event)?.count||0;
  return <><Header/><main className="mx-auto max-w-6xl px-4 py-8">
    <Link href="/admin/logos" className="text-sm underline">운영으로 돌아가기</Link>
    <h1 className="mt-4 text-2xl font-bold">접속·검색·다운로드 현황</h1>
    <p className="mt-2 text-sm text-gray-500">익명 방문 세션별로 유입과 행동을 연결해요. 기록은 배포 이후부터 쌓이며, 다운로드는 파일 수신 완료가 아닌 선택 기록이에요. 최근 90일을 보관해요.</p>
    <form className="my-6 flex flex-wrap gap-3" onSubmit={e=>{e.preventDefault();setFilter(q);}}>
      <select aria-label="조회 기간" value={days} onChange={e=>setDays(Number(e.target.value))} className="rounded border p-2">{[1,7,30,90].map(x=><option key={x} value={x}>최근 {x}일</option>)}</select>
      <input aria-label="검색어·브랜드·UTM 검색" placeholder="검색어·브랜드 ID·UTM 캠페인" value={q} onChange={e=>setQ(e.target.value)} className="min-w-64 rounded border p-2"/><button className="rounded bg-black px-4 text-white">조회</button><button type="button" onClick={()=>setTick(x=>x+1)} className="rounded border px-4">새로고침</button>
    </form>
    {loading&&<p role="status">접속 기록을 불러오는 중이에요.</p>}{error&&<p role="alert">{error} <Link href="/login?next=/admin/traffic" className="underline">로그인</Link></p>}
    {data&&<><div className="grid grid-cols-2 gap-3 md:grid-cols-4">{[['방문 세션',data.visitors],['검색',n('search_submitted')],['결과 없는 검색',n('search_no_result')],['다운로드 선택',n('logo_downloaded')]].map(([label,count])=><div key={label} className="rounded-xl border p-4"><p className="text-sm text-gray-500">{label}</p><strong className="text-2xl">{Number(count).toLocaleString()}</strong></div>)}</div>
    <div className="my-6 grid gap-4 md:grid-cols-2">{[['많이 검색한 로고',data.searches.map(x=>[x.term,x.count])],['많이 내려받은 로고',data.downloads.map(x=>[x.brand,x.count])]].map(([title,rows])=><section key={String(title)} className="rounded-xl border p-4"><h2 className="font-bold">{String(title)}</h2>{(rows as (string|number)[][]).length?(rows as (string|number)[][]).map(([name,count])=><div key={name} className="flex justify-between py-1 text-sm"><span>{name}</span><span>{count}회</span></div>):<p className="py-3 text-gray-500">아직 기록이 없어요.</p>}</section>)}</div>
    <h2 className="mb-3 font-bold">최근 방문 기록 · 최대 100개</h2><p className="mb-3 text-xs text-gray-500">상단 집계와 인기 항목은 선택 기간 전체, 아래 목록은 검색 조건에 맞는 최근 세션이에요. 세션마다 최근 100개 행동을 표시해요.</p>
    {!data.sessions.length&&<p className="rounded border p-6">조건에 맞는 방문 기록이 없어요.</p>}
    {data.sessions.map(s=><details key={s.session_id} className="mb-3 rounded-xl border p-4"><summary className="cursor-pointer"><strong>방문 {s.session_id.slice(0,8)}</strong> · {new Date(s.first_seen).toLocaleString('ko-KR')} · {s.device} / {s.browser}<span className="ml-3 text-sm">{s.attribution.utm_source||s.attribution.referrer||'직접 / 알 수 없음'} → {s.attribution.landing_path}</span></summary>
      <dl className="my-3 flex flex-wrap gap-4 text-xs">{['utm_source','utm_medium','utm_campaign','utm_content','utm_term','referrer'].filter(k=>s.attribution[k]).map(k=><div key={k}><dt className="text-gray-500">{k}</dt><dd>{s.attribution[k]}</dd></div>)}</dl>
      <div className="overflow-x-auto"><table className="w-full text-left text-sm"><thead><tr><th>시각</th><th>행동</th><th>내용</th><th>페이지</th></tr></thead><tbody>{s.events?.map((e,i)=><tr key={i} className="border-t"><td className="py-2">{new Date(e.created_at).toLocaleTimeString('ko-KR')}</td><td>{labels[e.event]||e.event}</td><td>{e.params.search_term||e.params.brand_id||'—'}{e.params.file_name&&` · ${e.params.file_name}`}{e.params.result_count!==null&&e.event.startsWith('search')&&` · 결과 ${e.params.result_count}개`}</td><td>{e.path}</td></tr>)}</tbody></table></div>
    </details>)}</>}
  </main></>;
}
