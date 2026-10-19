'use client';
import { useEffect, useState } from 'react';
import type { CollectionProgress } from '@/lib/collection-progress';
const percent = (n: number, total: number) => {
  if (!total || !n) return '0.0';
  const value = Math.min(100, n / total * 100);
  return value < 0.1 ? '<0.1' : value.toFixed(1);
};
export default function CollectionDashboard({ initial }: { initial: CollectionProgress[] | null }) {
  const [rows, setRows] = useState(initial);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [checked, setChecked] = useState('');
  useEffect(() => {
    let alive = true, loading = false;
    const controller = new AbortController();
    async function refresh() {
      if (loading || document.hidden) return;
      loading = true; if (alive) setBusy(true);
      try {
        const response = await fetch('/api/collections', { cache: 'no-store', signal: controller.signal });
        if (!response.ok) throw Error('unavailable');
        const data = await response.json();
        if (!Array.isArray(data.collections)) throw Error('invalid');
        if (alive) { setRows(data.collections); setError(''); setChecked(new Date().toLocaleTimeString('ko-KR')); }
      } catch { if (alive) setError('갱신하지 못했어요. 마지막으로 불러온 현황을 표시해요.'); }
      finally { loading = false; if (alive) setBusy(false); }
    }
    void refresh();
    const timer = setInterval(refresh, 60_000);
    const onVisible = () => { if (!document.hidden) void refresh(); };
    document.addEventListener('visibilitychange', onVisible);
    window.addEventListener('collection-refresh', onVisible);
    return () => { alive = false; controller.abort(); clearInterval(timer); document.removeEventListener('visibilitychange', onVisible); window.removeEventListener('collection-refresh', onVisible); };
  }, []);
  return <>
    <div className="my-7 flex flex-wrap items-center justify-between gap-3 text-xs text-gray-500"><span className="flex items-center gap-2"><span className="h-2 w-2 rounded-full bg-emerald-500" />{checked ? `오늘 ${checked} 확인` : '현재 현황'} · 1분마다 새로 확인해요</span><button disabled={busy} onClick={() => window.dispatchEvent(new Event('collection-refresh'))} className="rounded-full border border-gray-200 bg-white px-4 py-2 font-semibold text-gray-700 hover:border-gray-400 disabled:opacity-50">{busy ? '확인 중…' : '새로고침 ↗'}</button></div>
    <div className="mb-10 grid gap-4 rounded-[24px] bg-[#f6f6f8] p-6 sm:grid-cols-[170px_1fr] sm:items-center sm:p-7"><p className="text-sm font-bold text-gray-900">이 숫자를 읽는 법</p><p className="text-sm leading-7 text-gray-600">각 분야의 확인된 명단을 기준으로, 지금 세모로고에서 공개된 로고가 몇 개인지 세었어요. 파일의 선명도와 심볼·글자형 같은 구성은 따로 계속 다듬고 있어요.</p></div>
    {error && rows && <p role="status" className="mb-4 text-sm text-amber-700">{error}</p>}
    {!rows ? <p role="status">현황을 불러오지 못했어요. 새로고침을 눌러 다시 확인해 주세요.</p> : !rows.length ? <p>등록된 명부가 아직 없어요.</p> : <div className="space-y-14">
      {rows.find(c => c.id === 'kr-local-basic') && <GroupCard title="전국 지자체" description="시·군·자치구의 로고를 한눈에 확인해요." main={rows.find(c => c.id === 'kr-local-basic')!} childrenRows={['kr-local-kind-시', 'kr-local-kind-군', 'kr-local-kind-구'].flatMap(id => rows.filter(c => c.id === id))} />}
      {rows.find(c => c.id === 'kr-public-institutions') && <GroupCard title="전국 공공기관" description="공기업·준정부기관·기타공공기관을 포함한 정부 지정 명부예요." main={rows.find(c => c.id === 'kr-public-institutions')!} childrenRows={['kr-public-enterprises', 'kr-quasi-government', 'kr-other-public-institutions'].flatMap(id => rows.filter(c => c.id === id))} />}
      {rows.find(c => c.id === 'kr-local-public-enterprises') && <GroupCard title="지방공사·공단" description="지자체가 설립한 지방공사와 지방공단의 별도 명부예요." main={rows.find(c => c.id === 'kr-local-public-enterprises')!} childrenRows={['kr-local-corporations', 'kr-local-authorities'].flatMap(id => rows.filter(c => c.id === id))} />}
      <section><SectionHeading number="04" title="기업과 시장" description="늘 쓰는 브랜드부터 아직 덜 알려진 기업까지, 시장별 로고를 살펴보세요."/><div className="grid gap-4 md:grid-cols-2">{rows.filter(c => !c.sector && !c.id.startsWith('kr-local-') && !c.id.startsWith('kr-public-') && !['kr-quasi-government', 'kr-other-public-institutions', 'kr-jeju-administrative-cities', 'kr-local-invested-institutions'].includes(c.id)).map(c => <SummaryCard key={c.id} row={c}/>)}</div></section>
      {(['sports','media','education'] as const).map(sector => sector === 'media' ? <MediaOverview key={sector} rows={rows.filter(c => c.sector === sector)}/> : <SectorGroup key={sector} sector={sector} rows={rows.filter(c => c.sector === sector)}/>)}
      {rows.some(c=>c.sector==='community') && <details className="rounded-[24px] border border-gray-200 bg-[#fafafa] p-5 sm:p-6"><summary className="cursor-pointer font-semibold text-gray-800">그 밖에, 사용자 제공 자료도 정리하고 있어요 <span className="ml-2 text-sm font-normal text-gray-500">↗</span></summary><p className="mt-3 text-sm leading-7 text-gray-600">요청받은 파일에 실린 브랜드를 별도로 살펴본 기록이에요. 공식 전체 명단의 수집률과 섞지 않았어요.</p><div className="mt-5 grid gap-4 md:grid-cols-2">{rows.filter(c=>c.sector==='community').map(c=><SummaryCard key={c.id} row={c}/>)}</div></details>}
      <details className="rounded-[24px] border border-gray-200 p-5 sm:p-6"><summary className="cursor-pointer font-semibold">집계 기준과 별도 명단 보기 <span className="ml-2 text-sm font-normal text-gray-500">↗</span></summary><p className="mt-3 text-sm leading-7 text-gray-600">확인된 명단과 공개 로고를 대조해요. 심볼·글자형·가로 조합·세로 조합을 모두 갖췄는지는 별도 품질 기준이며 이 등록률에는 넣지 않아요. 서로 겹치는 명단은 더하지 않고, 확인 중인 후보도 등록으로 세지 않아요. 지자체 227곳에는 제주 행정시가 포함되지 않아요.</p><div className="mt-5 grid gap-4 md:grid-cols-2">{rows.filter(c => ['kr-local-wide','kr-jeju-administrative-cities','kr-local-invested-institutions'].includes(c.id)).map(c => <SummaryCard key={c.id} row={c}/>)}</div></details>
    </div>}
  </>;
}

function SectionHeading({ number, title, description }: { number: string; title: string; description: string }) {
  return <div className="mb-5 flex items-start gap-4"><span className="mt-1 text-sm font-bold text-indigo-600">{number}</span><div><h2 className="text-2xl font-black tracking-tight">{title}</h2><p className="mt-2 text-sm leading-6 text-gray-500">{description}</p></div></div>;
}

function SummaryCard({ row: c }: { row: CollectionProgress }) {
  const ratio = c.total ? Math.min(100, c.collected / c.total * 100) : 0;
  return <article className="flex flex-col rounded-[22px] border border-gray-200 bg-white p-5 transition-shadow hover:shadow-md sm:p-6">
    <div className="flex items-start justify-between gap-3"><h3 className="text-lg font-bold leading-snug">{c.name}</h3><span className={`shrink-0 rounded-full px-2.5 py-1 text-[11px] font-semibold ${c.total > 0 && c.collected === c.total ? 'bg-emerald-50 text-emerald-700' : 'bg-gray-100 text-gray-600'}`}>{c.total > 0 && c.collected === c.total ? '모두 등록' : c.total > 0 ? '채우는 중' : '명단 준비 중'}</span></div>
    <div className="mt-7 flex items-end justify-between gap-2"><p className="text-4xl font-black tracking-tight">{percent(c.collected,c.total)}<span className="ml-0.5 text-xl">%</span></p><p className="pb-1 text-xs text-gray-500">{c.collected.toLocaleString()} / {c.total.toLocaleString()}개 공개</p></div>
    <div role="progressbar" aria-label={`${c.name} 로고 등록률`} aria-valuemin={0} aria-valuemax={c.total || 1} aria-valuenow={c.collected} className="mt-4 h-2 overflow-hidden rounded-full bg-gray-100"><div className="h-full rounded-full bg-[#6864ed]" style={{ width: `${ratio}%` }} /></div>
    <div className="mt-5 flex flex-wrap items-center justify-between gap-3 border-t border-gray-100 pt-4"><span className="text-xs text-gray-400">명단 기준 {c.as_of}</span><a className="text-sm font-semibold text-indigo-600 hover:underline" href={`/collections/${encodeURIComponent(c.id)}/`}>로고 살펴보기 ↗</a></div>
    {(c.scope_note || c.source_url || c.source_kind === 'etf_holdings_proxy') && <details className="mt-3 text-xs leading-6 text-gray-500"><summary className="cursor-pointer">집계 기준과 출처</summary><div className="mt-2">{c.scope_note && <p>{c.scope_note}</p>}{c.source_kind === 'etf_holdings_proxy' && <p>IWM 보유종목 기준이며 공식 Russell 구성과 다를 수 있어요.</p>}{c.sector && <p>{[c.country,c.sport,c.league,c.season].filter(Boolean).join(' · ')} · 출처 확인 {c.checked_at?.slice(0,10) ?? c.as_of}</p>}{c.source_url && <a className="underline" href={c.source_url} target="_blank" rel="noopener noreferrer">자료 출처 보기 ↗</a>}</div></details>}
  </article>;
}

function GroupCard({ title,description,main,childrenRows }: { title:string;description:string;main:CollectionProgress;childrenRows:CollectionProgress[] }) {
 return <section><SectionHeading number={title==='전국 지자체'?'01':title==='전국 공공기관'?'02':'03'} title={title} description={description}/>
  <div className="rounded-[26px] bg-[#18181c] p-6 text-white sm:p-8"><div className="flex flex-wrap items-end justify-between gap-4"><div><p className="text-xs text-gray-400">현재 공개된 로고</p><p className="mt-2 text-4xl font-black tracking-tight">{main.collected.toLocaleString()}<span className="ml-2 text-base font-normal text-gray-400">/ {main.total.toLocaleString()}개</span></p></div><p className="text-3xl font-black text-[#b9b6ff]">{percent(main.collected,main.total)}%</p></div><div role="progressbar" aria-label={`${title} 로고 등록률`} aria-valuemin={0} aria-valuemax={main.total || 1} aria-valuenow={main.collected} className="mt-5 h-2 overflow-hidden rounded-full bg-white/15"><div className="h-full rounded-full bg-[#a6a2ff]" style={{width:`${main.total ? Math.min(100,main.collected/main.total*100):0}%`}}/></div><p className="mt-4 text-xs text-gray-400">명단 기준 {main.as_of} · 확인 {main.checked_at?.slice(0,10) ?? main.as_of}</p></div>
  <div className="mt-4 grid gap-4 md:grid-cols-3">{childrenRows.map(c=><SummaryCard key={c.id} row={c}/>)}</div>
 </section>;
}

function SectorGroup({sector,rows}:{sector:'sports'|'media'|'education';rows:CollectionProgress[]}) {
 const [country,setCountry]=useState(''); const [sport,setSport]=useState(''); const [season,setSeason]=useState(''); const [league,setLeague]=useState('');
 const options=(key:'country'|'sport'|'season'|'league')=>Array.from(new Set(rows.map(r=>r[key]).filter((v):v is string=>!!v))).sort();
 const titles={sports:'스포츠 · 국가와 리그별',media:'방송·언론 · 국가별 공식 디렉터리',education:'대학 · 검증된 회원 명부'};
 if(!rows.length)return null;
 return <section><h2 className="mb-3 text-xl font-bold">{titles[sector]}</h2><p className="mb-4 text-sm text-gray-500">출처에서 명단을 확인한 범위만 표시해요. 전 세계 전체 기관 수를 뜻하지 않으며, 시즌이 다른 명부는 각각 확인해 주세요.</p><div className="mb-4 flex flex-wrap gap-3">{([{key:'country',label:'국가',value:country,set:setCountry},{key:'sport',label:'종목',value:sport,set:setSport},{key:'season',label:'시즌',value:season,set:setSeason},{key:'league',label:'리그',value:league,set:setLeague}] as const).map(f=>options(f.key).length>0&&<label key={f.key} className="text-sm">{f.label} <select className="rounded-lg border p-2" value={f.value} onChange={e=>f.set(e.target.value)}><option value="">전체</option>{options(f.key).map(v=><option key={v}>{v}</option>)}</select></label>)}</div><div className="grid gap-4 md:grid-cols-2">{rows.filter(r=>(!country||r.country===country)&&(!sport||r.sport===sport)&&(!season||r.season===season)&&(!league||r.league===league)).map(r=><SummaryCard key={r.id} row={r}/>)}</div></section>;
}

function MediaOverview({rows}:{rows:CollectionProgress[]}) {
 const domestic=(row:CollectionProgress)=>['대한민국','한국','South Korea','Republic of Korea','KR'].includes(row.country ?? '');
 const kinds=[{label:'방송',prefix:'media-ebu-',source:'EBU 공식 방송 조직 디렉터리'},{label:'언론·통신사',prefix:'news-eana-',source:'EANA 공식 통신사 디렉터리'}];
 return <section><h2 className="mb-3 text-xl font-bold">방송·언론</h2><p className="mb-4 text-sm leading-6 text-gray-500">국내와 해외로 나눠 확인해요. 아래 분모는 확인한 공식 디렉터리의 대상 수이며, 전체 방송사·언론사 수를 뜻하지 않아요. 방송과 통신사는 명부별로 표시하고 서로 합산하지 않아요.</p><div className="grid gap-4 sm:grid-cols-2">{kinds.flatMap(kind=>[true,false].map(kr=>{
 const group=rows.filter(r=>r.id.startsWith(kind.prefix)&&domestic(r)===kr);
 const label=`${kr?'국내':'해외'} ${kind.label}`;
 if(!group.length)return <section key={label} className="rounded-2xl border p-5"><h3 className="font-bold">{label}</h3><p className="mt-4 text-gray-500">명부 준비 중</p><p className="mt-2 text-xs text-gray-500">공식 대상 명단을 확인한 뒤 집계해요.</p></section>;
 const sum=(key:'total'|'verified'|'complete'|'collected'|'candidates')=>group.reduce((n,r)=>n+r[key],0);
 const total=sum('total');
 const checked=group.map(r=>r.checked_at?.slice(0,10) ?? r.as_of).sort().slice(-1)[0];
 return <section key={label} className="rounded-2xl border p-5"><h3 className="font-bold">{label}</h3><p className="mt-4 text-3xl font-bold">{percent(sum('collected'),total)}% <span className="text-sm font-normal text-gray-500">등록된 로고 {sum('collected').toLocaleString()} / {total.toLocaleString()}</span></p><progress aria-label={`${label} 로고 등록률`} className="mt-3 w-full accent-emerald-600" value={sum('collected')} max={total || 1}/><p className="mt-3 text-xs leading-5 text-gray-500">{kind.source}에 등재된 대상 기준 · 확인 {checked}{kind.prefix==='news-eana-'?' · 정지 회원 제외':''}</p><a className="mt-3 inline-block text-sm underline" href={group[0].source_url} target="_blank" rel="noopener noreferrer">명단 출처 보기</a></section>;
 }))}</div></section>;
}
