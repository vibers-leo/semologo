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
    <p className="mb-6 rounded-xl bg-gray-50 p-4 text-sm leading-6 text-gray-600">수집률은 명부에 연결된 공개 CMS 로고의 비율이에요. 후보는 기업 일치 검토가 남아 있고, 검증은 공개 PNG 확인까지 마친 항목이에요. 세트끼리 겹치므로 합산하지 않아요. 새 콘텐츠를 명부에 연결하거나 공개 상태를 바꾸면 집계에 반영돼요.</p>
    {error && <p role="status" className="mb-4 text-sm text-amber-700">{error}</p>}
    {!rows ? <p role="status">현황을 불러오지 못했어요. 지금 갱신을 눌러 다시 확인해 주세요.</p> : !rows.length ? <p>등록된 명부가 아직 없어요.</p> : <div className="grid gap-4 lg:grid-cols-2">{rows.map(c => <section key={c.id} className="rounded-2xl border p-5">
      <h2 className="text-lg font-bold">{c.name}</h2>
      <p className="mt-2 text-xs text-gray-500">명부 기준 {c.as_of} · {c.total.toLocaleString()} {c.count_unit === 'entity' ? '기관·기업' : '증권'}</p>
      <p className="my-4 text-3xl font-bold">수집률 {percent(c.collected, c.total)}% <span className="text-sm font-normal text-gray-500">{c.collected.toLocaleString()} / {c.total.toLocaleString()}</span></p>
      {[['수집·공개', c.collected, '#7c3aed'], ['PNG 검증', c.verified, '#059669'], ['연결 후보', c.candidates, '#94a3b8']] .map(([label, n, color]) => <div key={String(label)} className="mt-3"><div className="mb-1 flex justify-between text-sm"><span>{label}</span><span>{Number(n).toLocaleString()} · {percent(Number(n), c.total)}%</span></div><progress aria-label={`${c.name} ${label}`} value={Number(n)} max={c.total || 1} style={{ accentColor: String(color), width: '100%' }} /></div>)}
      {c.source_kind === 'etf_holdings_proxy' && <p className="mt-3 text-xs text-amber-700">IWM 보유종목 대체 명부예요. 공식 Russell 구성종목과 차이가 있을 수 있어요.</p>}
      <div className="mt-4 flex gap-4 text-sm underline"><Link href={`/collections/${c.id}`}>대상 목록 보기</Link><a href={c.source_url} target="_blank" rel="noopener noreferrer">명부 출처</a></div>
    </section>)}</div>}
  </>;
}
