'use client';
import { useEffect, useState } from 'react';
import { onAuthStateChanged, type User } from 'firebase/auth';
import { getClientAuth } from '@/lib/firebase';
import { CDN, VERSION } from '@/lib/cdn';
import type { Brand } from '@/lib/brands';
import Header from '@/components/Header';

type Wall = { id: string; title: string; version: number };
type Item = { brand_id: string; asset_snapshot: { name?: string; logo_png?: string | boolean } };
export default function LogoWallEditor() {
  const [user, setUser] = useState<User | null>(null);
  const [ready, setReady] = useState(false);
  const [walls, setWalls] = useState<Wall[]>([]);
  const [current, setCurrent] = useState<Wall | null>(null);
  const [title, setTitle] = useState('새 로고월');
  const [selected, setSelected] = useState<Brand[]>([]);
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<Brand[]>([]);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');
  useEffect(() => onAuthStateChanged(getClientAuth(), u => {
    setUser(u); setReady(true); setWalls([]); setCurrent(null); setSelected([]);
  }), []);
  async function api(method = 'GET', id?: string, body?: unknown) {
    if (!user) throw new Error('로그인 후 이용해 주세요.');
    const response = await fetch(`/api/logo-walls/${id ? `?id=${encodeURIComponent(id)}` : ''}`, {
      method, headers: { Authorization: `Bearer ${await user.getIdToken()}`, 'Content-Type': 'application/json' },
      ...(body ? { body: JSON.stringify(body) } : {}), cache: 'no-store',
    });
    const data = await response.json();
    if (!response.ok) throw new Error(data.error || '요청을 완료하지 못했어요.');
    return data;
  }
  async function run(task: () => Promise<void>) {
    setBusy(true); setMessage('');
    try { await task(); } catch (e) { setMessage(e instanceof Error ? e.message : '잠시 후 다시 시도해 주세요.'); }
    finally { setBusy(false); }
  }
  useEffect(() => {
    if (!user) return;
    let active = true;
    api().then(d => { if (active) setWalls(d.walls); }).catch(e => { if (active) setMessage(e.message); });
    return () => { active = false; };
    // Refresh the list only when the authenticated identity changes.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user]);
  useEffect(() => {
    if (!query.trim()) { setResults([]); return; }
    const abort = new AbortController();
    const timer = setTimeout(() => {
      fetch(`/api/catalog/?q=${encodeURIComponent(query)}&offset=0&limit=12`, { signal: abort.signal })
        .then(r => { if (!r.ok) throw new Error('검색에 연결할 수 없어요.'); return r.json(); })
        .then(d => setResults(d.brands || [])).catch(e => { if (!abort.signal.aborted) setMessage(e.message); });
    }, 300);
    return () => { clearTimeout(timer); abort.abort(); };
  }, [query]);
  const preview = (b: Brand) => typeof b.logo_png === 'string' && /\.png(?:\?|$)/i.test(b.logo_png)
    ? b.logo_png : `${CDN}/${encodeURIComponent(b.id)}/logo-transparent.png?v=${VERSION}`;
  return <><Header /><main className="max-w-5xl mx-auto p-6 space-y-6">
    <h1 className="text-2xl font-bold">내 로고월</h1>
    {!ready ? <p>로그인을 확인하고 있어요.</p> : !user ? <a href="/login/">로그인하고 로고월 만들기</a> : <>
      <p>브랜드를 검색해서 로고월에 추가해 보세요. 최대 100개를 저장할 수 있어요.</p>
      <div className="flex gap-3 flex-wrap">
        <button disabled={busy} onClick={() => { setCurrent(null); setTitle('새 로고월'); setSelected([]); setMessage(''); }}>새로 만들기</button>
        <button disabled={busy || !current} onClick={() => { setCurrent(null); setTitle(`${title} 복사`); setMessage('저장하면 별도 로고월이 만들어져요.'); }}>복제하기</button>
        {walls.map(w => <button key={w.id} disabled={busy} onClick={() => run(async () => {
          const d = await api('GET', w.id); setCurrent(d.wall); setTitle(d.wall.title);
          setSelected(d.wall.items.map((i: Item) => ({ id: i.brand_id, name_ko: i.asset_snapshot.name || i.brand_id, name_en: '', category: '', logo_png: i.asset_snapshot.logo_png })));
        })}>{w.title}</button>)}
      </div>
      <label className="block">로고월 제목<input className="block border rounded p-2 w-full" maxLength={120} value={title} disabled={busy} onChange={e => setTitle(e.target.value)} /></label>
      <label className="block">브랜드 검색<input className="block border rounded p-2 w-full" value={query} onChange={e => setQuery(e.target.value)} /></label>
      <div className="flex gap-3 flex-wrap">{results.map(b => <button key={b.id} disabled={busy || selected.length >= 100 || selected.some(s => s.id === b.id)} onClick={() => setSelected(s => [...s, b])}>＋ {b.name_ko}</button>)}</div>
      <p>{selected.length}개 선택 · 추가한 순서로 표시해요.</p>
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 border rounded p-4">{selected.map((b, index) => <div key={b.id}>
        <img src={preview(b)} alt={b.name_ko} width={240} height={120} loading="lazy" className="h-24 w-full object-contain" />
        <span>{b.name_ko}</span><button disabled={busy} aria-label={`${b.name_ko} 제거`} onClick={() => setSelected(s => s.filter((_, i) => i !== index))}> ×</button>
      </div>)}</div>
      <div className="flex gap-4">
        <button disabled={busy || !title.trim()} onClick={() => run(async () => {
          const d = await api(current ? 'PUT' : 'POST', current?.id, { title, brandIds: selected.map(b => b.id), version: current?.version });
          setCurrent(d.wall); setWalls((await api()).walls); setMessage('저장했어요.');
        })}>{busy ? '처리 중…' : '저장하기'}</button>
        {current && <button disabled={busy} onClick={() => { if (window.confirm('이 로고월을 삭제할까요?')) void run(async () => {
          await api('DELETE', current.id); setCurrent(null); setSelected([]); setTitle('새 로고월'); setWalls((await api()).walls); setMessage('삭제했어요.');
        }); }}>삭제하기</button>}
      </div>
    </>}
    <p role="status" aria-live="polite">{message}</p>
  </main></>;
}
