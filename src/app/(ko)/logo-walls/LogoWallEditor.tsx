'use client';
import { useEffect, useState } from 'react';
import { onAuthStateChanged, type User } from 'firebase/auth';
import { getClientAuth } from '@/lib/firebase';
import { CDN, VERSION } from '@/lib/cdn';
import type { Brand } from '@/lib/brands';
import Header from '@/components/Header';
import styles from './LogoWallEditor.module.css';

type Layout = { background: 'auto' | 'light' | 'dark'; columns: number };
const defaultLayout: Layout = { background: 'auto', columns: 4 };
type Wall = { id: string; title: string; version: number; settings?: Layout };
type Item = { brand_id: string; asset_snapshot: { name?: string; logo_png?: string | boolean; light?: boolean } };
function SearchLogo({ brand, src, large = false, background }: { brand: Brand; src: string; large?: boolean; background?: string }) {
  const [failed, setFailed] = useState(false);
  const [candidate, setCandidate] = useState(0);
  const candidates = [...new Set([src, `${CDN}/${encodeURIComponent(brand.id)}/logo.png?v=${VERSION}`, `/api/logo-preview/?id=${encodeURIComponent(brand.id)}`])];
  return <span style={{ width: large ? '100%' : 80, height: large ? 100 : 48, flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', borderRadius: 6, background: background ?? (brand.light || brand.light_logo || brand.dark_variant === 'white' ? '#18181b' : '#f4f4f5') }}>
    {failed ? <span style={{ fontSize: 11, color: '#71717a' }}>미리보기 없음</span> : <img src={candidates[candidate]} alt={large ? brand.name_ko : ''} width={large ? 240 : 80} height={large ? 100 : 48} decoding="async" style={{ width: large ? '85%' : 72, height: large ? 80 : 40, objectFit: 'contain' }} onError={() => candidate + 1 < candidates.length ? setCandidate(candidate + 1) : setFailed(true)} />}
  </span>;
}
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
  const [layout, setLayout] = useState<Layout>(defaultLayout);
  const [saved, setSaved] = useState('');
  const [searching, setSearching] = useState(false);
  const fingerprint = JSON.stringify({ title, ids: selected.map(b => b.id), layout });
  const dirty = fingerprint !== (saved || JSON.stringify({ title: '새 로고월', ids: [], layout: defaultLayout }));
  const canSwitch = () => !dirty || window.confirm('저장하지 않은 변경사항이 있어요. 다른 로고월로 이동할까요?');
  const reset = () => { setCurrent(null); setTitle('새 로고월'); setSelected([]); setLayout(defaultLayout); setSaved(''); setMessage(''); };
  function move(index: number, direction: number) {
    setSelected(items => { const next = [...items]; const to = index + direction; if (to < 0 || to >= next.length) return items; [next[index], next[to]] = [next[to], next[index]]; return next; });
  }
  useEffect(() => onAuthStateChanged(getClientAuth(), u => {
    setUser(u); setReady(true); setWalls([]); setCurrent(null); setSelected([]); setLayout(defaultLayout); setSaved('');
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
    if (!query.trim()) { setResults([]); setSearching(false); return; }
    setResults([]); setSearching(true);
    const abort = new AbortController();
    const timer = setTimeout(() => {
      fetch(`/api/catalog/?q=${encodeURIComponent(query)}&offset=0&limit=12`, { signal: abort.signal })
        .then(r => { if (!r.ok) throw new Error('검색에 연결할 수 없어요.'); return r.json(); })
        .then(d => { if (!abort.signal.aborted) setResults(d.brands || []); }).catch(e => { if (!abort.signal.aborted) setMessage(e.message); }).finally(() => { if (!abort.signal.aborted) setSearching(false); });
    }, 300);
    return () => { clearTimeout(timer); abort.abort(); };
  }, [query]);
  const preview = (b: Brand) => typeof b.logo_png === 'string' && /\.png(?:\?|$)/i.test(b.logo_png)
    ? b.logo_png : `${CDN}/${encodeURIComponent(b.id)}/logo-transparent.png?v=${VERSION}`;
  async function open(w: Wall) {
    if (!canSwitch()) return;
    await run(async () => {
      const d = await api('GET', w.id);
      const items = d.wall.items.map((i: Item) => ({ id: i.brand_id, name_ko: i.asset_snapshot.name || i.brand_id, name_en: '', category: '', logo_png: i.asset_snapshot.logo_png, light: i.asset_snapshot.light }));
      const settings = { ...defaultLayout, ...d.wall.settings };
      setCurrent(d.wall); setTitle(d.wall.title); setSelected(items); setLayout(settings);
      setSaved(JSON.stringify({ title: d.wall.title, ids: items.map((b: Brand) => b.id), layout: settings }));
    });
  }
  async function save() {
    await run(async () => {
      const d = await api(current ? 'PUT' : 'POST', current?.id, { title, brandIds: selected.map(b => b.id), version: current?.version, settings: layout });
      setCurrent(d.wall); setTitle(d.wall.title);
      setSaved(JSON.stringify({ title: d.wall.title, ids: selected.map(b => b.id), layout }));
      setWalls((await api()).walls); setMessage('저장했어요.');
    });
  }
  return <><Header /><main className={styles.page}>
    <div className={styles.heading}><div><span className={styles.eyebrow}>MY LOGO WALL</span><h1>로고를 모아, 나만의 로고월로.</h1><p>브랜드를 고르고 배치를 조정해 보세요. 만든 로고월은 내 계정에 저장돼요.</p></div>
      {user && <button className={styles.primary} disabled={busy || !title.trim() || !selected.length} onClick={save}>{busy ? '처리 중…' : '로고월 저장하기'}</button>}
    </div>
    {!ready ? <p>로그인을 확인하고 있어요.</p> : !user ? <a className={styles.primary} href="/login/?next=%2Flogo-walls%2F">로그인하고 로고월 만들기</a> : <>
      <nav className={styles.saved} aria-label="내 로고월 목록"><button disabled={busy} onClick={() => { if (canSwitch()) reset(); }}>＋ 새 로고월</button>{walls.map(w => <button key={w.id} aria-pressed={current?.id === w.id} disabled={busy} onClick={() => open(w)}>{w.title}</button>)}</nav>
      <div className={styles.workspace}>
        <section className={styles.library} aria-label="로고 선택">
          <div className={styles.sectionTitle}><h2>1. 로고 선택</h2><span>{selected.length}/100</span></div>
          <label className={styles.field}>브랜드 검색<input placeholder="삼성, 네이버, Nike…" value={query} onChange={e => setQuery(e.target.value)} /></label>
          <p className={styles.hint}>로고를 누르면 오른쪽 미리보기에 추가돼요.</p>
          {searching ? <p role="status">로고를 찾고 있어요…</p> : query.trim() && !results.length ? <div className={styles.empty}>검색 결과가 없어요.<br /><a href="/submit/">없는 로고 제보하기 →</a></div> : !query.trim() ? <div className={styles.empty}>함께 보여주고 싶은<br />브랜드 이름을 검색해 보세요.</div> : null}
          <div className={styles.results} aria-label="브랜드 검색 결과">{results.map(b => {
            const added = selected.some(s => s.id === b.id);
            return <button key={b.id} className={styles.result} disabled={busy || selected.length >= 100 || added} onClick={() => setSelected(s => [...s, b])}><SearchLogo brand={b} src={preview(b)} /><span>{b.name_ko}<small>{added ? '✓ 추가됨' : '＋ 추가하기'}</small></span></button>;
          })}</div>
        </section>
        <section className={styles.editor} aria-label="로고월 편집">
          <div className={styles.sectionTitle}><h2>2. 배치와 미리보기</h2><span className={styles.saveState}>{dirty ? '저장하지 않은 변경사항' : current ? '저장됨 · 비공개' : '새 로고월 · 비공개'}</span></div>
          <label className={styles.field}>로고월 제목<input maxLength={120} value={title} disabled={busy} onChange={e => setTitle(e.target.value)} /></label>
          <div className={styles.controls}>
            <label>배경<select aria-label="로고월 배경" value={layout.background} disabled={busy} onChange={e => setLayout(l => ({ ...l, background: e.target.value as Layout['background'] }))}><option value="auto">로고에 맞게</option><option value="light">밝게</option><option value="dark">어둡게</option></select></label>
            <label>한 줄 배치<select aria-label="한 줄 로고 개수" value={layout.columns} disabled={busy} onChange={e => setLayout(l => ({ ...l, columns: Number(e.target.value) }))}>{[2,3,4,6].map(n => <option key={n} value={n}>{n}개</option>)}</select></label>
            <button disabled={busy || !current} onClick={() => { setCurrent(null); setSaved(''); setTitle(`${title} 복사`); setMessage('저장하면 별도 로고월이 만들어져요.'); }}>복제하기</button>
          </div>
          <div className={styles.canvas} style={{ background: layout.background === 'dark' ? '#18181b' : '#fafafa' }}>
            {!selected.length ? <div className={styles.emptyCanvas}><span>＋</span><h3>첫 번째 로고를 추가해 보세요</h3><p>파트너·고객사·좋아하는 브랜드를 한곳에 모아보세요.</p></div> : <div className={styles.wall} style={{ gridTemplateColumns: `repeat(${layout.columns}, minmax(0, 1fr))` }}>{selected.map((b, index) => <div className={styles.tile} key={b.id}>
              <div className={styles.logo}><SearchLogo brand={b} src={preview(b)} large background={layout.background === 'dark' || (layout.background === 'auto' && (b.light || b.light_logo || b.dark_variant === 'white')) ? '#18181b' : '#fff'} /></div>
              <div className={styles.caption}><span>{b.name_ko}</span><div><button aria-label={`${b.name_ko} 앞으로 이동`} disabled={busy || index === 0} onClick={() => move(index, -1)}>←</button><button aria-label={`${b.name_ko} 뒤로 이동`} disabled={busy || index === selected.length - 1} onClick={() => move(index, 1)}>→</button><button aria-label={`${b.name_ko} 제거`} disabled={busy} onClick={() => setSelected(s => s.filter((_, i) => i !== index))}>×</button></div></div>
            </div>)}</div>}
          </div>
          <p className={styles.hint}>화살표로 순서를 바꿀 수 있어요. 배경과 배치도 함께 저장돼요.</p>
          <div className={styles.footer}><span>최대 100개 · 내 계정에 비공개 저장</span>{current && <button className={styles.danger} disabled={busy} onClick={() => { if (window.confirm('이 로고월을 삭제할까요?')) void run(async () => { await api('DELETE', current.id); reset(); setWalls((await api()).walls); setMessage('삭제했어요.'); }); }}>로고월 삭제</button>}</div>
        </section>
      </div>
    </>}
    <p className={styles.message} role="status" aria-live="polite">{message}</p>
  </main></>;
}
