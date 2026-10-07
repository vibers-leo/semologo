'use client';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import type { CollectionProgress } from '@/lib/collection-progress';
const percent = (n: number, total: number) => total ? Math.min(100, n / total * 100).toFixed(1) : '0.0';
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
    <div className="my-6 flex flex-wrap items-center justify-between gap-3 text-sm text-gray-500"><span>{checked ? `최근 확인 ${checked} · ` : ''}1분마다 자동 갱신</span><button disabled={busy} onClick={() => window.dispatchEvent(new Event('collection-refresh'))} className="rounded-lg border px-4 py-2 text-gray-900 disabled:opacity-50">{busy ? '확인 중…' : '지금 갱신'}</button></div>
    <p className="mb-6 text-sm leading-6 text-gray-500">공식 명부를 기준으로 로고를 채워가요. 공개된 로고와 PNG 검수 결과를 따로 확인할 수 있어요.</p>
    {error && <p role="status" className="mb-4 text-sm text-amber-700">{error}</p>}
    {!rows ? <p role="status">현황을 불러오지 못했어요. 지금 갱신을 눌러 다시 확인해 주세요.</p> : !rows.length ? <p>등록된 명부가 아직 없어요.</p> : <div className="space-y-8">
      {rows.find(c => c.id === 'kr-local-basic') && <GroupCard title="전국 지자체" description="시·군·자치구의 로고를 한눈에 확인해요." main={rows.find(c => c.id === 'kr-local-basic')!} childrenRows={['kr-local-kind-시', 'kr-local-kind-군', 'kr-local-kind-구'].flatMap(id => rows.filter(c => c.id === id))} />}
      {rows.find(c => c.id === 'kr-public-institutions') && <GroupCard title="전국 공공기관" description="공기업·준정부기관·기타공공기관을 포함한 정부 지정 명부예요." main={rows.find(c => c.id === 'kr-public-institutions')!} childrenRows={['kr-public-enterprises', 'kr-quasi-government', 'kr-other-public-institutions'].flatMap(id => rows.filter(c => c.id === id))} />}
      {rows.find(c => c.id === 'kr-local-public-enterprises') && <GroupCard title="지방공사·공단" description="지자체가 설립한 지방공사와 지방공단의 별도 명부예요." main={rows.find(c => c.id === 'kr-local-public-enterprises')!} childrenRows={['kr-local-corporations', 'kr-local-authorities'].flatMap(id => rows.filter(c => c.id === id))} />}
      <section><h2 className="mb-4 text-xl font-bold">기업과 시장</h2><div className="grid gap-4 md:grid-cols-2">{rows.filter(c => !c.id.startsWith('kr-local-') && !c.id.startsWith('kr-public-') && !['kr-quasi-government', 'kr-other-public-institutions', 'kr-jeju-administrative-cities', 'kr-local-invested-institutions'].includes(c.id)).map(c => <SummaryCard key={c.id} row={c}/>)}</div></section>
      <details className="rounded-2xl border p-5"><summary className="cursor-pointer font-semibold">집계 기준과 별도 명부</summary><p className="mt-3 text-sm leading-6 text-gray-500">공개율은 명부와 연결된 공개 콘텐츠의 비율이에요. PNG 검수는 기관 일치와 실제 이미지 확인을 마친 항목이에요. 검토 대기는 기존 자산의 연결 후보이며, 아직 완료로 세지 않아요. 서로 겹치는 명부는 합산하지 않아요. 지자체 227곳에는 제주 행정시가 포함되지 않아요.</p><div className="mt-4 grid gap-4 md:grid-cols-2">{rows.filter(c => ['kr-local-wide','kr-jeju-administrative-cities','kr-local-invested-institutions'].includes(c.id)).map(c => <SummaryCard key={c.id} row={c}/>)}</div></details>
    </div>}
  </>;
}

function SummaryCard({ row: c }: { row: CollectionProgress }) {
  return <section className="rounded-2xl border p-5"><div className="flex items-start justify-between gap-3"><h3 className="font-bold">{c.name}</h3><span className={`rounded-full px-2 py-1 text-xs ${c.verified === c.total ? 'bg-emerald-50 text-emerald-700' : 'bg-gray-100 text-gray-600'}`}>{c.verified === c.total ? '검수 완료' : '진행 중'}</span></div><p className="mt-4 text-3xl font-bold">{percent(c.verified,c.total)}% <span className="text-sm font-normal text-gray-500">PNG 검수 {c.verified.toLocaleString()} / {c.total.toLocaleString()}</span></p><progress aria-label={`${c.name} PNG 검수율`} className="mt-3 w-full accent-emerald-600" value={c.verified} max={c.total || 1}/><p className="mt-2 text-xs text-gray-500">공개 {c.collected.toLocaleString()} · 검토 대기 {Math.max(0,c.candidates-c.verified).toLocaleString()} · 명부 {c.as_of}</p>{c.source_kind === 'etf_holdings_proxy' && <p className="mt-2 text-xs text-amber-700">IWM 보유종목 기준 · 공식 Russell 구성과 차이가 있을 수 있어요.</p>}<div className="mt-4 flex flex-wrap gap-4 text-sm"><Link className="font-semibold underline" href={`/collections/${c.id}/`}>대상 보기</Link><Link className="text-gray-500 underline" href={`/collections/${c.id}/?status=pending`}>남은 대상</Link><a className="text-gray-500 underline" href={c.source_url} target="_blank" rel="noopener noreferrer">공식 명부</a></div></section>;
}
function GroupCard({ title,description,main,childrenRows }: { title:string;description:string;main:CollectionProgress;childrenRows:CollectionProgress[] }) {
 return <section className="rounded-3xl border bg-gray-50/50 p-5 sm:p-7"><div className="flex flex-wrap items-end justify-between gap-4"><div><h2 className="text-2xl font-bold">{title}</h2><p className="mt-2 text-sm text-gray-500">{description}</p></div><div className="text-right"><p className="text-4xl font-black">{percent(main.verified,main.total)}<span className="text-xl">%</span></p><p className="mt-1 text-sm text-gray-500">PNG 검수 {main.verified.toLocaleString()} / {main.total.toLocaleString()}</p></div></div><progress aria-label={`${title} PNG 검수율`} className="my-5 w-full accent-emerald-600" value={main.verified} max={main.total || 1}/><div className="grid gap-3 md:grid-cols-3">{childrenRows.map(c=><SummaryCard key={c.id} row={c}/>)}</div><div className="mt-5 flex flex-wrap items-center gap-4 text-sm"><Link className="font-semibold underline" href={`/collections/${main.id}/`}>전체 대상 보기</Link><Link className="text-gray-500 underline" href={`/collections/${main.id}/?status=pending`}>남은 대상 보기</Link><span className="text-xs text-gray-500">명부 기준 {main.as_of} · 확인 {main.checked_at?.slice(0,10) ?? main.as_of}</span></div></section>;
}
