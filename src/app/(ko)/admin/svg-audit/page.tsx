"use client";

import { useCallback, useEffect, useState } from 'react';
import { onAuthStateChanged } from 'firebase/auth';
import { getClientAuth } from '@/lib/firebase';
import { CDN } from '@/lib/cdn';
import Header from '@/components/Header';

type Decision = 'replace' | 'recollect' | 'keep';
type Item = { id: string; name_ko: string; name_en: string; status: string; reason: string; review: { decision: Decision | null; at: string } | null };
type Variant = { id: string; file: string; decision: Decision | null; at: string };
const FILTERS = [
  ['manual-review', '수동 검토'], ['opaque-awaiting-review', '불투명'],
  ['failed', '처리 실패'], ['candidate-needs-review', '후보 재검토'],
  ['existing-png-review', '기존 PNG 확인'], ['all', '전체'],
] as const;
const LABELS: Record<Decision, string> = { replace: '교체 검토', recollect: '재수집 요청', keep: '문제 없음' };
function reviewReason(item: Item) {
  if (item.status === 'failed') return item.reason.includes('Empty rendering') ? '원본을 그릴 수 없어요. 재수집이 필요할 수 있어요.' : `처리 실패 · ${item.reason || '원본 확인 필요'}`;
  if (item.status === 'existing-png-review') return '기존 PNG가 있어 자동 교체하지 않았어요.';
  if (item.status === 'candidate-needs-review') return '배경 제거 결과를 안전하게 확인할 수 없어요.';
  if (item.status === 'opaque-awaiting-review') return '불투명한 SVG예요. 배경 확인이 필요해요.';
  if (item.reason.includes('Compound white canvas')) return '흰 배경과 로고가 한 경로에 섞여 있어요.';
  if (item.reason.includes('External resource')) return '외부 파일을 참조하는 SVG예요.';
  if (item.reason.includes('Raster wrapper')) return '삽입 이미지나 SVG 효과가 있어 수동 확인이 필요해요.';
  return item.reason || '원본 확인이 필요해요.';
}

export default function SvgAuditAdminPage() {
  const [ready, setReady] = useState(false);
  const [admin, setAdmin] = useState(false);
  const [status, setStatus] = useState('manual-review');
  const [page, setPage] = useState(1);
  const [query, setQuery] = useState('');
  const [search, setSearch] = useState('');
  const [items, setItems] = useState<Item[]>([]);
  const [variants, setVariants] = useState<Variant[]>([]);
  const [total, setTotal] = useState(0);
  const [counts, setCounts] = useState<Record<string, number>>({});
  const [loading, setLoading] = useState(false);
  const [busy, setBusy] = useState('');
  const [error, setError] = useState('');

  useEffect(() => onAuthStateChanged(getClientAuth(), user => {
    setAdmin(user?.email?.toLowerCase() === 'juuuno1116@gmail.com');
    setReady(true);
  }), []);

  const refresh = useCallback(async (signal?: AbortSignal) => {
    setLoading(true); setError('');
    try {
      const token = await getClientAuth().currentUser?.getIdToken();
      if (!token) throw Error('관리자 로그인이 필요해요.');
      const path = status === 'variants' ? '/api/admin/svg-audit/?kind=variants'
        : `/api/admin/svg-audit/?status=${status}&page=${page}&q=${encodeURIComponent(search)}`;
      const response = await fetch(path, { headers: { Authorization: `Bearer ${token}` }, cache: 'no-store', signal });
      const data = await response.json();
      if (!response.ok) throw Error(data.error || '검토 목록을 불러오지 못했어요.');
      if (signal?.aborted) return;
      if (status === 'variants') setVariants(data.variants || []);
      else { setItems(data.items || []); setTotal(data.total || 0); setCounts(data.counts || {}); }
    } catch (cause) {
      if (!signal?.aborted) setError(cause instanceof Error ? cause.message : '다시 시도해 주세요.');
    } finally { if (!signal?.aborted) setLoading(false); }
  }, [status, page, search]);

  useEffect(() => {
    if (!admin) return;
    const controller = new AbortController();
    void refresh(controller.signal);
    return () => controller.abort();
  }, [admin, refresh]);

  async function decide(id: string, decision: Decision | null, file = '') {
    const key = `${id}:${file}`;
    setBusy(key); setError('');
    try {
      const token = await getClientAuth().currentUser?.getIdToken();
      if (!token) throw Error('관리자 로그인이 필요해요.');
      const response = await fetch('/api/admin/svg-audit/', {
        method: 'PATCH', headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ id, file, decision }),
      });
      const data = await response.json();
      if (!response.ok) throw Error(data.error || '선택을 저장하지 못했어요.');
      if (file) setVariants(previous => previous.map(item => item.id === id && item.file === file ? { ...item, review: data.review, decision: data.review.decision, at: data.review.at } as Variant : item));
      else setItems(previous => previous.map(item => item.id === id ? { ...item, review: data.review } : item));
    } catch (cause) { setError(cause instanceof Error ? cause.message : '선택을 저장하지 못했어요.'); }
    finally { setBusy(''); }
  }

  const choices = (id: string, selected: Decision | null, file = '') => (
    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
      {(Object.keys(LABELS) as Decision[]).map(value => (
        <button key={value} type="button" aria-pressed={selected === value} disabled={busy === `${id}:${file}`}
          onClick={() => void decide(id, selected === value ? null : value, file)}
          style={{ padding: '7px 10px', borderRadius: 8, border: `1px solid ${selected === value ? '#6366f1' : '#d4d4d8'}`,
            background: selected === value ? '#eef2ff' : '#fff', color: selected === value ? '#4338ca' : '#52525b', cursor: 'pointer', fontSize: 12 }}>
          {LABELS[value]}
        </button>
      ))}
    </div>
  );

  return <div style={{ minHeight: '100vh', background: 'var(--bg)' }}><Header />
    <main style={{ maxWidth: 1120, margin: '0 auto', padding: '28px 16px 72px' }}>
      <h1 style={{ fontSize: 24, fontWeight: 800 }}>SVG 전수 점검</h1>
      <p style={{ fontSize: 13, color: 'var(--text-secondary)', margin: '7px 0 18px' }}>원본을 보며 교체 검토·재수집 요청을 선택해 주세요. 선택은 관리자 검토 기록으로 저장돼요.</p>
      {!ready ? <p>불러오는 중이에요.</p> : !admin ? <p>관리자 계정으로 로그인해 주세요.</p> : <>
        <nav aria-label="검토 분류" style={{ display: 'flex', flexWrap: 'wrap', gap: 7, marginBottom: 16 }}>
          {FILTERS.map(([value, label]) => <button key={value} type="button" onClick={() => { setStatus(value); setPage(1); }}
            aria-pressed={status === value} style={{ padding: '8px 12px', borderRadius: 999, border: '1px solid #d4d4d8',
              background: status === value ? '#18181b' : '#fff', color: status === value ? '#fff' : '#52525b', cursor: 'pointer' }}>
            {label} {counts[value] != null ? counts[value].toLocaleString() : ''}
          </button>)}
          <button type="button" onClick={() => setStatus('variants')} aria-pressed={status === 'variants'}
            style={{ padding: '8px 12px', borderRadius: 999, border: '1px solid #d4d4d8', background: status === 'variants' ? '#18181b' : '#fff', color: status === 'variants' ? '#fff' : '#52525b', cursor: 'pointer' }}>구성 카드 투표</button>
        </nav>
        {status !== 'variants' && <form onSubmit={event => { event.preventDefault(); setPage(1); setSearch(query); }}
          style={{ display: 'flex', gap: 8, marginBottom: 12 }}><input aria-label="로고 검색" value={query} onChange={event => setQuery(event.target.value)} placeholder="이름 또는 ID 검색"
            style={{ flex: 1, minWidth: 0, padding: 10, borderRadius: 8, border: '1px solid #d4d4d8' }}/><button type="submit">검색</button></form>}
        {error && <p role="alert" style={{ color: '#dc2626' }}>{error} <button onClick={() => void refresh()}>다시 불러오기</button></p>}
        <p aria-live="polite" style={{ fontSize: 12, color: '#71717a', marginBottom: 10 }}>{loading ? '불러오는 중…' : status === 'variants' ? `${variants.length.toLocaleString()}건 표시` : `${total.toLocaleString()}건 · ${page}페이지`}</p>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(min(100%,450px),1fr))', gap: 10 }}>
          {(status === 'variants' ? variants.map(item => ({ ...item, name_ko: item.id, name_en: item.file, status: 'variant', reason: '', review: { decision: item.decision, at: item.at } })) : items).map(item => {
            const file = status === 'variants' ? item.name_en : '';
            const generatedDark = file.startsWith('generated-dark:');
            const previewFile = generatedDark ? file.slice('generated-dark:'.length) : file;
            return <article key={`${item.id}:${file}`} style={{ display: 'flex', gap: 12, padding: 12, border: '1px solid #e4e4e7', borderRadius: 12, background: '#fff' }}>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={status === 'variants' ? `${CDN}/${item.id}/${previewFile}` : `${CDN}/${item.id}/logo.svg`} alt="" loading="lazy"
                style={{ width: 105, height: 96, objectFit: 'contain', flexShrink: 0, background: generatedDark ? '#18181b' : '#e4e4e7', borderRadius: 8 }}
                onError={event => { if (!event.currentTarget.src.includes('/logo.png')) event.currentTarget.src = `${CDN}/${item.id}/logo.png`; }}/>
              <div style={{ minWidth: 0, flex: 1 }}><b style={{ fontSize: 13 }}>{item.name_ko || item.name_en || item.id}</b>
                <div style={{ fontSize: 11, color: '#71717a', overflowWrap: 'anywhere' }}>{item.id}{file ? ` · ${generatedDark ? `자동 생성 다크 PNG (원본: ${previewFile})` : file}` : ''}</div>
                <div style={{ fontSize: 12, color: '#71717a', margin: '4px 0 9px' }}>{generatedDark ? '왼쪽은 원본 미리보기예요. 다크용 결과는 콘텐츠에서 확인해 주세요.' : status === 'variants' ? '구성 이미지 교체 검토' : reviewReason(item)}</div>
                {choices(item.id, item.review?.decision || null, file)}
                <a href={`/brand/${encodeURIComponent(item.id)}/`} target="_blank" rel="noopener noreferrer" style={{ fontSize: 11, display: 'inline-block', marginTop: 8 }}>콘텐츠 보기 ↗</a>
              </div>
            </article>;
          })}
        </div>
        {status !== 'variants' && <nav aria-label="페이지 이동" style={{ display: 'flex', gap: 12, justifyContent: 'center', alignItems: 'center', marginTop: 18 }}>
          <button type="button" disabled={page <= 1 || loading} onClick={() => setPage(value => value - 1)}>이전</button>
          <span>{page} / {Math.max(1, Math.ceil(total / 50))}</span>
          <button type="button" disabled={page * 50 >= total || loading} onClick={() => setPage(value => value + 1)}>다음</button>
        </nav>}
      </>}
    </main></div>;
}
