'use client';
import { useEffect, useRef, useState, type PointerEvent } from 'react';
import { onAuthStateChanged, type User } from 'firebase/auth';
import { getClientAuth } from '@/lib/firebase';
import { CATALOG_VERSION } from '@/lib/cdn';
import { logoPngCandidates } from '@/lib/logo-png-source';
import { applyQualityReview } from '@/lib/logo-quality-review';
import type { Brand } from '@/lib/brands';
import Header from '@/components/Header';
import styles from './LogoWallEditor.module.css';

type Layout = { background: 'auto' | 'light' | 'dark'; columns: number; motion: 'static' | 'marquee' | 'alternating'; speed: 'slow' | 'normal' | 'fast' };
const defaultLayout: Layout = { background: 'auto', columns: 4, motion: 'static', speed: 'normal' };
type Wall = { id: string; title: string; version: number; settings?: Layout };
type Item = { brand_id: string; asset_snapshot: { name?: string; logo_png?: string | boolean; light?: boolean; user_logo_id?: string } };
type SearchLogoProps = { brand: Brand; src: string; large?: boolean; background?: string };
function SearchLogo(props: SearchLogoProps) {
  return <SearchLogoImage key={`${props.brand.id}:${props.src}`} {...props} />;
}
function SearchLogoImage({ brand, src, large = false, background }: SearchLogoProps) {
  const [failed, setFailed] = useState(false);
  const [candidate, setCandidate] = useState(0);
  const candidates = [...new Set([src, ...logoPngCandidates(brand)])];
  return <span style={{ width: large ? '100%' : 80, height: large ? 100 : 48, flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', borderRadius: 6, background: background ?? (brand.light || brand.light_logo || brand.dark_variant === 'white' ? '#18181b' : '#f4f4f5') }}>
    {failed ? <span style={{ fontSize: 11, color: '#71717a' }}>미리보기 없음</span> : <img draggable={false} src={candidates[candidate]} alt={large ? brand.name_ko : ''} width={large ? 240 : 80} height={large ? 100 : 48} decoding="async" style={{ width: large ? '85%' : 72, height: large ? 80 : 40, objectFit: 'contain' }} onError={() => candidate + 1 < candidates.length ? setCandidate(candidate + 1) : setFailed(true)} />}
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
  const [myLogos, setMyLogos] = useState<Brand[]>([]);
  const [uploadName, setUploadName] = useState('');
  const [uploadFile, setUploadFile] = useState<File | null>(null);
  const blobUrls = useRef<string[]>([]);
  const uploadInput = useRef<HTMLInputElement>(null);
  const [paused, setPaused] = useState(false);
  const [saved, setSaved] = useState('');
  const [searching, setSearching] = useState(false);
  const drag = useRef<{ id: string; pointer: number; x: number; y: number; target: string | null; moved: boolean } | null>(null);
  const [dragging, setDragging] = useState<string | null>(null);
  const [dropTarget, setDropTarget] = useState<string | null>(null);
  function stopDrag() { drag.current = null; setDragging(null); setDropTarget(null); }
  function startDrag(e: PointerEvent<HTMLElement>, id: string) {
    if (busy || selected.length < 2 || !e.isPrimary || e.button !== 0) return;
    e.currentTarget.setPointerCapture(e.pointerId);
    drag.current = { id, pointer: e.pointerId, x: e.clientX, y: e.clientY, target: null, moved: false };
  }
  function dragMove(e: PointerEvent<HTMLElement>) {
    const item = drag.current;
    if (!item || item.pointer !== e.pointerId) return;
    if (!item.moved && Math.hypot(e.clientX - item.x, e.clientY - item.y) < 5) return;
    item.moved = true; setDragging(item.id);
    const hit = document.elementFromPoint(e.clientX, e.clientY)?.closest<HTMLElement>('[data-logo-wall-item]');
    const inWall = hit?.closest('[data-logo-wall]') === e.currentTarget.closest('[data-logo-wall]');
    item.target = inWall ? hit?.dataset.logoWallItem ?? null : null;
    setDropTarget(item.target === item.id ? null : item.target);
    if (e.clientY > window.innerHeight - 48) window.scrollBy(0, 12);
    else if (e.clientY < 100) window.scrollBy(0, -12);
  }
  function endDrag(e: PointerEvent<HTMLElement>) {
    const item = drag.current;
    if (!item || item.pointer !== e.pointerId) return;
    if (item.moved && item.target && item.target !== item.id && !busy) {
      setSelected(items => {
        const from = items.findIndex(b => b.id === item.id);
        const to = items.findIndex(b => b.id === item.target);
        if (from < 0 || to < 0) return items;
        const next = [...items]; const [brand] = next.splice(from, 1); next.splice(to, 0, brand); return next;
      });
      setMessage('순서를 바꿨어요. 저장하면 다음에도 이 순서로 보여요.');
    }
    stopDrag();
    if (e.currentTarget.hasPointerCapture(e.pointerId)) e.currentTarget.releasePointerCapture(e.pointerId);
  }
  const fingerprint = JSON.stringify({ title, ids: selected.map(b => b.id), layout });
  const dirty = fingerprint !== (saved || JSON.stringify({ title: '새 로고월', ids: [], layout: defaultLayout }));
  const canSwitch = () => !dirty || window.confirm('저장하지 않은 변경사항이 있어요. 다른 로고월로 이동할까요?');
  const reset = () => { setCurrent(null); setTitle('새 로고월'); setSelected([]); setLayout(defaultLayout); setSaved(''); setMessage(''); };
  function move(index: number, direction: number) {
    setSelected(items => { const next = [...items]; const to = index + direction; if (to < 0 || to >= next.length) return items; [next[index], next[to]] = [next[to], next[index]]; return next; });
  }
  useEffect(() => onAuthStateChanged(getClientAuth(), u => {
    setUser(u); setReady(true); setTitle('새 로고월'); setUploadName(''); setUploadFile(null); setQuery(''); setWalls([]); setCurrent(null); setSelected([]); setLayout(defaultLayout); setSaved('');
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
  async function personal(id?: string, body?: FormData) {
    if (!user) throw new Error('로그인 후 이용해 주세요.');
    const r = await fetch(`/api/my-logos/${id ? `?id=${encodeURIComponent(id)}` : ''}`, { method: body ? 'POST' : 'GET', headers: { Authorization: `Bearer ${await user.getIdToken()}` }, body, cache: 'no-store' });
    if (!r.ok) throw new Error((await r.json()).error || '로고를 불러오지 못했어요.');
    return r;
  }
  async function privateBrand(id: string, name: string): Promise<Brand> {
    const logo_png = URL.createObjectURL(await (await personal(id)).blob()); blobUrls.current.push(logo_png);
    return { id, name_ko: name, name_en: '', category: '', logo_png } as Brand;
  }
  useEffect(() => {
    let active = true;
    setMyLogos([]);
    if (user) personal().then(r => r.json()).then(async d => {
      const logos = await Promise.all(d.logos.map((l: { id: string; name: string }) => privateBrand(l.id, l.name)));
      if (active) setMyLogos(logos);
    }).catch(e => { if (active) setMessage(e.message); });
    return () => { active = false; blobUrls.current.forEach(URL.revokeObjectURL); blobUrls.current = []; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user]);
  async function upload() {
    if (!uploadFile || !uploadName.trim()) return;
    await run(async () => {
      const form = new FormData(); form.set('name', uploadName.trim()); form.set('file', uploadFile);
      const d = await (await personal(undefined, form)).json();
      const brand = await privateBrand(d.logo.id, d.logo.name);
      setMyLogos(s => s.some(b => b.id === brand.id) ? s : [...s, brand]);
      setSelected(s => s.some(b => b.id === brand.id) || s.length >= 100 ? s : [...s, brand]);
      setUploadName(''); setUploadFile(null); if (uploadInput.current) uploadInput.current.value = ''; setMessage('등록했어요. 로고월을 저장해 주세요.');
    });
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
      fetch(`/api/catalog/?q=${encodeURIComponent(query)}&offset=0&limit=12&revision=${CATALOG_VERSION}`, { signal: abort.signal })
        .then(r => { if (!r.ok) throw new Error('검색에 연결할 수 없어요.'); return r.json(); })
        .then(d => { if (!abort.signal.aborted) setResults(d.brands || []); }).catch(e => { if (!abort.signal.aborted) setMessage(e.message); }).finally(() => { if (!abort.signal.aborted) setSearching(false); });
    }, 300);
    return () => { clearTimeout(timer); abort.abort(); };
  }, [query]);
  const preview = (b: Brand) => logoPngCandidates(b)[0];
  async function open(w: Wall) {
    if (!canSwitch()) return;
    await run(async () => {
      const d = await api('GET', w.id);
      const items = await Promise.all(d.wall.items.map(async (i: Item) => i.asset_snapshot.user_logo_id ? privateBrand(i.asset_snapshot.user_logo_id, i.asset_snapshot.name || '내 로고') : applyQualityReview({ id: i.brand_id, name_ko: i.asset_snapshot.name || i.brand_id, name_en: '', category: '', logo_png: i.asset_snapshot.logo_png, light: i.asset_snapshot.light })));
      const settings = { ...defaultLayout, ...d.wall.settings };
      setCurrent(d.wall); setTitle(d.wall.title); setSelected(items); setLayout(settings);
      setSaved(JSON.stringify({ title: d.wall.title, ids: items.map((b: Brand) => b.id), layout: settings }));
    });
  }
  async function download() {
    if (!current || dirty || !user) return;
    await run(async () => {
      const response = await fetch(`/api/logo-walls/export/?id=${encodeURIComponent(current.id)}`, { headers: { Authorization: `Bearer ${await user.getIdToken()}` }, cache: 'no-store' });
      if (!response.ok) { const error = await response.json(); throw new Error(`${error.error}${Array.isArray(error.details) ? ` (${error.details.join(', ')})` : ''}`); }
      const url = URL.createObjectURL(await response.blob());
      const link = document.createElement('a'); link.href = url; link.download = `logo-wall-${current.id}.zip`; document.body.appendChild(link); link.click(); link.remove();
      setTimeout(() => URL.revokeObjectURL(url), 60_000); setMessage('PNG·설정·독립 미리보기를 ZIP으로 내려받았어요.');
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
          <hr style={{ margin: '24px 0', borderColor: '#e4e4e7' }} />
          <h2 style={{ fontSize: 16 }}>내 로고·다른 로고 등록</h2>
          <p className={styles.hint}>PNG를 등록하면 로고월에서 바로 활용할 수 있어요. 원하시면 세모로고에도 등록해드려요.</p>
          <label className={styles.field}>로고 이름<input maxLength={120} value={uploadName} onChange={e => setUploadName(e.target.value)} disabled={busy} /></label>
          <label className={styles.field}>PNG 파일 (최대 2MB)<input ref={uploadInput} type="file" accept="image/png" disabled={busy} onChange={e => setUploadFile(e.target.files?.[0] ?? null)} /></label>
          <button disabled={busy || !uploadFile || !uploadName.trim()} onClick={upload}>등록하고 추가하기</button>
          <p className={styles.hint}>계정당 최대 20개 · <a href="/submit/">세모로고 등록 요청하기 →</a></p>
          <div className={styles.results}>{myLogos.map(b => <button key={b.id} className={styles.result} disabled={busy || selected.length >= 100 || selected.some(s => s.id === b.id)} onClick={() => setSelected(s => [...s, b])}><SearchLogo brand={b} src={preview(b)} /><span>{b.name_ko}</span></button>)}</div>
        </section>
        <section className={styles.editor} aria-label="로고월 편집">
          <div className={styles.sectionTitle}><h2>2. 배치와 미리보기</h2><span className={styles.saveState}>{dirty ? '저장하지 않은 변경사항' : current ? '저장됨 · 비공개' : '새 로고월 · 비공개'}</span></div>
          <label className={styles.field}>로고월 제목<input maxLength={120} value={title} disabled={busy} onChange={e => setTitle(e.target.value)} /></label>
          <div className={styles.controls}>
            <label>배경<select aria-label="로고월 배경" value={layout.background} disabled={busy} onChange={e => setLayout(l => ({ ...l, background: e.target.value as Layout['background'] }))}><option value="auto">로고에 맞게</option><option value="light">밝게</option><option value="dark">어둡게</option></select></label>
            <label>한 줄 배치<select aria-label="한 줄 로고 개수" value={layout.columns} disabled={busy} onChange={e => setLayout(l => ({ ...l, columns: Number(e.target.value) }))}>{[2,3,4,6].map(n => <option key={n} value={n}>{n}개</option>)}</select></label>
            <label>움직임<select aria-label="로고월 움직임" value={layout.motion} disabled={busy} onChange={e => { setPaused(false); setLayout(l => ({ ...l, motion: e.target.value as Layout['motion'] })); }}><option value="static">정지</option><option value="marquee">한 방향 마퀴</option><option value="alternating">줄마다 반대 방향 마퀴</option></select></label>
            <label>속도<select aria-label="마퀴 속도" value={layout.speed} disabled={busy || layout.motion === 'static'} onChange={e => setLayout(l => ({ ...l, speed: e.target.value as Layout['speed'] }))}><option value="slow">천천히</option><option value="normal">보통</option><option value="fast">빠르게</option></select></label>
            <button disabled={busy || !current} onClick={() => { setCurrent(null); setSaved(''); setTitle(`${title} 복사`); setMessage('저장하면 별도 로고월이 만들어져요.'); }}>복제하기</button>
          </div>
          {selected.length > 0 && layout.motion !== 'static' && <section aria-label="움직임 미리보기">
            <div className={styles.sectionTitle}><h2>움직임 미리보기</h2><button onClick={() => setPaused(p => !p)} aria-pressed={paused}>{paused ? '재생하기' : '일시정지'}</button></div>
            <div className={styles.motionStage} style={{ background: layout.background === 'dark' ? '#18181b' : '#fafafa' }}>
              {Array.from({ length: layout.motion === 'alternating' ? Math.min(3, selected.length, Math.max(2, Math.ceil(selected.length / layout.columns))) : 1 }, (_, row) => {
                const rows = layout.motion === 'alternating' ? Math.min(3, selected.length, Math.max(2, Math.ceil(selected.length / layout.columns))) : 1;
                const logos = selected.filter((_, i) => i % rows === row);
                const repeated = Array.from({ length: Math.max(1, Math.ceil(8 / logos.length)) }, () => logos).flat();
                return <div className={styles.motionRow} key={row}><div className={styles.motionTrack} style={{ animationDuration: `${{ slow: 48, normal: 28, fast: 14 }[layout.speed]}s`, animationDirection: row % 2 ? 'reverse' : 'normal', animationPlayState: paused ? 'paused' : 'running' }}>
                  {[0, 1].map(copy => <div className={styles.motionGroup} key={copy} aria-hidden="true">{repeated.map((b, i) => <div className={styles.motionLogo} key={`${b.id}-${i}`}><SearchLogo brand={b} src={preview(b)} background={layout.background === 'dark' ? '#18181b' : layout.background === 'light' ? '#fff' : undefined} /></div>)}</div>)}
                </div></div>;
              })}
            </div><p className={styles.hint}>아래에서 순서를 편집하세요. 움직임과 속도도 함께 저장돼요. 기기의 움직임 줄이기 설정을 따라요.</p>
          </section>}
          <div className={styles.canvas} style={{ background: layout.background === 'dark' ? '#18181b' : '#fafafa' }}>
            {!selected.length ? <div className={styles.emptyCanvas}><span>＋</span><h3>첫 번째 로고를 추가해 보세요</h3><p>파트너·고객사·좋아하는 브랜드를 한곳에 모아보세요.</p></div> : <div className={styles.wall} data-logo-wall style={{ gridTemplateColumns: `repeat(${layout.columns}, minmax(0, 1fr))` }}>{selected.map((b, index) => <div className={styles.tile} key={b.id} data-logo-wall-item={b.id} data-dragging={dragging === b.id || undefined} data-drop-target={dropTarget === b.id || undefined}>
              <div className={`${styles.logo} ${styles.dragSurface}`} onPointerDown={e => startDrag(e, b.id)} onPointerMove={dragMove} onPointerUp={endDrag} onPointerCancel={stopDrag} onLostPointerCapture={stopDrag}><SearchLogo brand={b} src={preview(b)} large background={layout.background === 'dark' || (layout.background === 'auto' && (b.light || b.light_logo || b.dark_variant === 'white')) ? '#18181b' : '#fff'} /></div>
              <div className={styles.caption}><span>{b.name_ko}</span><div><button aria-label={`${b.name_ko} 앞으로 이동`} disabled={busy || index === 0} onClick={() => move(index, -1)}>←</button><button aria-label={`${b.name_ko} 뒤로 이동`} disabled={busy || index === selected.length - 1} onClick={() => move(index, 1)}>→</button><button aria-label={`${b.name_ko} 제거`} disabled={busy} onClick={() => setSelected(s => s.filter((_, i) => i !== index))}>×</button></div></div>
            </div>)}</div>}
          </div>
          <p className={styles.hint}>로고를 끌어서 순서를 바꿔보세요. 화살표로도 이동할 수 있어요. 배경과 배치도 함께 저장돼요.</p>
          <div className={styles.footer}><button disabled={busy || !current || dirty} onClick={download}>로고월 ZIP 다운로드</button><span>최대 100개 · 저장 후 ZIP 다운로드</span>{current && <button className={styles.danger} disabled={busy} onClick={() => { if (window.confirm('이 로고월을 삭제할까요?')) void run(async () => { await api('DELETE', current.id); reset(); setWalls((await api()).walls); setMessage('삭제했어요.'); }); }}>로고월 삭제</button>}</div>
        </section>
      </div>
    </>}
    <p className={styles.message} role="status" aria-live="polite">{message}</p>
  </main></>;
}
