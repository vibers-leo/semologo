"use client";
import { useCallback, useEffect, useRef, useState, type FormEvent } from 'react';
import styles from './DeveloperConsole.module.css';
import { ConsoleApiError, consoleFailure, consoleDate, consoleScopes, grantList, grantState, keyList, keyState, keySummary, pilotSummary, secretToken, usageLabels, type ConsoleGrant, type ConsoleKey, type ConsolePilot, type ConsoleScope } from './developer-console-model';
export type ConsoleUser = { uid: string; getIdToken: (forceRefresh?: boolean) => Promise<string> };
const scopeNames: Record<ConsoleScope, string> = { 'walls:read': '로고월 조회·미리보기', 'walls:write': '로고월 만들기', 'collection:request': '누락 로고 수집 요청' };
type LoadState = 'loading' | 'ready' | 'auth' | 'invite' | 'preparing' | 'error';
export default function DeveloperConsolePanel({ user }: { user: ConsoleUser }) {
  const [state, setState] = useState<LoadState>('loading');
  const [keys, setKeys] = useState<ConsoleKey[]>([]), [grants, setGrants] = useState<ConsoleGrant[]>([]), [pilot, setPilot] = useState<ConsolePilot | null>(null);
  const [message, setMessage] = useState(''), [usageError, setUsageError] = useState(''), [notice, setNotice] = useState(''), [busy, setBusy] = useState('');
  const [name, setName] = useState('내 MCP 연결'), [scopes, setScopes] = useState<ConsoleScope[]>(['walls:read', 'walls:write']);
  const [hasSecret, setHasSecret] = useState(false), [copied, setCopied] = useState(false), [copyError, setCopyError] = useState(''), [revoke, setRevoke] = useState<string | null>(null);
  // The full API key is never rendered, stored in browser storage, or put in React state.
  const currentUser = useRef(user); currentUser.current = user;
  const secret = useRef<string | null>(null), secretId = useRef<string | null>(null), alive = useRef(true), epoch = useRef(0), controllers = useRef(new Set<AbortController>());
  const clearSecret = useCallback(() => { secret.current = null; secretId.current = null; setHasSecret(false); setCopied(false); setCopyError(''); }, []);
  const api = useCallback(async (path: string, method = 'GET', body?: unknown) => {
    const controller = new AbortController(); controllers.current.add(controller);
    try {
      const token = await currentUser.current.getIdToken();
      if (!alive.current || controller.signal.aborted) throw Error('console_request_cancelled');
      const response = await fetch(path, { method, headers: { Authorization: `Bearer ${token}`, ...(body ? { 'Content-Type': 'application/json' } : {}) }, ...(body ? { body: JSON.stringify(body) } : {}), cache: 'no-store', signal: controller.signal });
      if (!response.headers.get('content-type')?.toLowerCase().includes('application/json')) throw Error('invalid_console_response');
      const data: unknown = await response.json();
      if (!response.ok) throw new ConsoleApiError(response.status, data && typeof data === 'object' && 'error' in data && typeof data.error === 'string' ? data.error : 'unavailable');
      return data;
    } finally { controllers.current.delete(controller); }
  }, [user.uid]);
  const load = useCallback(async () => {
    const current = ++epoch.current; setState('loading'); setMessage(''); setUsageError('');
    const results = await Promise.allSettled([api('/api/developer/keys/'), api('/api/developer/usage/'), api('/api/admin/developer-pilot/self')]);
    if (!alive.current || current !== epoch.current) return;
    try {
      if (results[0].status === 'rejected') throw results[0].reason;
      setKeys(keyList(results[0].value)); setState('ready');
    } catch (error) { const failed = consoleFailure(error); setState(failed.kind); setMessage(failed.message); setPilot(null); if (failed.kind === 'auth' || failed.kind === 'invite') { clearSecret(); setNotice(''); } return; }
    try { if (results[1].status === 'rejected') throw results[1].reason; setGrants(grantList(results[1].value)); } catch { setGrants([]); setUsageError('사용량을 불러오지 못했어요. 다시 불러와 주세요.'); }
    setPilot(results[2].status === 'fulfilled' ? pilotSummary(results[2].value) : null);
  }, [api, clearSecret]);
  useEffect(() => {
    alive.current = true; clearSecret(); setKeys([]); setGrants([]); setPilot(null); setNotice(''); setBusy(''); setRevoke(null); void load();
    return () => { alive.current = false; epoch.current++; controllers.current.forEach(c => c.abort()); controllers.current.clear(); secret.current = null; secretId.current = null; };
  }, [load, clearSecret]);
  const activeCount = keys.filter(key => keyState(key) === 'active').length;
  async function issue(event: FormEvent) {
    event.preventDefault(); if (busy || hasSecret || activeCount >= 5 || !name.trim() || !scopes.length) return;
    const current = epoch.current; setBusy('issue'); setMessage(''); setNotice('');
    try {
      const response = await api('/api/developer/keys/', 'POST', { name: name.trim(), scopes });
      if (!alive.current || current !== epoch.current) return;
      if (!response || typeof response !== 'object' || !('token' in response) || !secretToken(response.token) || !('key' in response)) throw Error('invalid_console_response');
      const summary = keySummary(response.key);
      secret.current = response.token; delete (response as Record<string, unknown>).token; secretId.current = summary.id;
      setKeys(previous => [summary, ...previous.filter(key => key.id !== summary.id)]); setHasSecret(true); setCopied(false); setRevoke(null); setNotice('새 키를 발급했어요. 지금 복사해 안전하게 보관해 주세요.');
    } catch (error) { if (alive.current && current === epoch.current) setMessage(error instanceof ConsoleApiError ? consoleFailure(error).message : '발급 결과를 확인하지 못했어요. 목록을 다시 불러온 뒤 사용하지 않는 키를 회수해 주세요.'); }
    finally { if (alive.current && current === epoch.current) setBusy(''); }
  }
  async function revokeKey(id: string) {
    if (busy) return; const current = epoch.current; setBusy(id); setMessage(''); setNotice('');
    try { await api(`/api/developer/keys/?id=${encodeURIComponent(id)}`, 'DELETE'); if (!alive.current || current !== epoch.current) return;
      setKeys(previous => previous.map(key => key.id === id ? { ...key, revoked_at: new Date().toISOString() } : key)); if (secretId.current === id) clearSecret(); setRevoke(null); setNotice('키를 회수했어요. 이 키로 연결한 클라이언트에는 새 키가 필요해요.');
    } catch (error) { if (alive.current && current === epoch.current) setMessage(consoleFailure(error).message); }
    finally { if (alive.current && current === epoch.current) setBusy(''); }
  }
  async function copy() {
    const current = epoch.current; setCopyError('');
    try { if (!secret.current) return; await navigator.clipboard.writeText(secret.current); if (alive.current && current === epoch.current) setCopied(true); }
    catch { if (alive.current && current === epoch.current) setCopyError('클립보드 접근을 허용한 뒤 다시 복사해 주세요.'); }
  }
  async function provision() {
    if (busy || !pilot?.eligible || pilot.provisioned) return; const current = epoch.current; setBusy('pilot'); setMessage(''); setNotice('');
    try { await api('/api/admin/developer-pilot/self', 'POST'); if (!alive.current || current !== epoch.current) return; setNotice('파일럿 한도를 연결했어요. 사용량에서 기간과 남은 횟수를 확인해 주세요.'); await load(); }
    catch (error) { if (alive.current && current === epoch.current) setMessage(consoleFailure(error).message); }
    finally { if (alive.current) setBusy(''); }
  }
  function changeScope(scope: ConsoleScope, checked: boolean) {
    setScopes(previous => { let next = checked ? [...previous.filter(s => s !== scope), scope] : previous.filter(s => s !== scope); if (scope === 'collection:request' && checked && !next.includes('walls:write')) next.push('walls:write'); if (scope === 'walls:write' && !checked) next = next.filter(s => s !== 'collection:request'); return next; });
  }
  return <div className={styles.panel}>
    <div className={styles.toolbar}><p>키와 사용량은 로그인한 계정에만 연결돼요.</p><button type="button" onClick={() => void load()} disabled={!!busy || state === 'loading'}>{state === 'loading' ? '불러오는 중…' : '다시 불러오기'}</button></div>
    {notice && <p role="status" className={styles.notice}>{notice}</p>}
    {message && <p role="alert" className={styles.error}>{message}</p>}
    {hasSecret && <section className={styles.secret} aria-label="한 번만 확인할 수 있는 새 키">
      <span className={styles.kicker}>발급 직후 한 번만 확인</span><h2>새 키를 복사해 주세요</h2><p>이 영역을 닫거나 페이지를 새로고침하면 전체 키를 다시 복사할 수 없어요.</p>
      <div className={styles.secretRow}><input aria-label="새 API 키 · 보호됨" type="password" readOnly autoComplete="off" value="****************" tabIndex={-1}/><button type="button" onClick={() => void copy()}>{copied ? '복사했어요' : '키 복사'}</button><button type="button" onClick={clearSecret}>키 닫기</button></div>
      {copyError && <p role="alert" className={styles.error}>{copyError}</p>}
    </section>}
    {state === 'loading' ? <section className={styles.empty} role="status">API 키와 사용량을 불러오고 있어요.</section> : state !== 'ready' ? <section className={styles.empty}>
      <h2>{state === 'invite' ? '초대된 계정으로 이용해 주세요' : state === 'auth' ? '다시 로그인해 주세요' : state === 'preparing' ? '파일럿 준비 중' : '연결을 확인해 주세요'}</h2>
      <p>{state === 'invite' ? '일반 계정의 키 발급과 사용량 조회는 아직 열리지 않았어요.' : state === 'preparing' ? '아직 키를 발급하거나 사용량을 조회할 수 없어요.' : '위 안내를 확인한 뒤 다시 시도해 주세요.'}</p>
      {state === 'auth' || state === 'invite' ? <a href="/login/?next=%2Fdevelopers%2F">Google 계정으로 로그인</a> : <button type="button" onClick={() => void load()}>다시 불러오기</button>}
    </section> : <>
      {pilot && <section className={styles.pilot} aria-label="운영 파일럿 한도"><div><h2>{pilot.provisioned ? '파일럿 한도를 이미 연결했어요' : '파일럿 한도를 연결해 보세요'}</h2><p>{pilot.durationDays}일 동안 기능별로 {pilot.unitsPerMetric.toLocaleString('ko-KR')}회씩 사용할 수 있어요. 결제는 진행되지 않아요.</p></div>{!pilot.provisioned && <button type="button" disabled={!!busy} onClick={() => void provision()}>{busy === 'pilot' ? '연결하는 중…' : `${pilot.durationDays}일 파일럿 한도 받기`}</button>}</section>}
      <div className={styles.columns}>
        <section className={styles.card} aria-labelledby="developer-keys-title">
          <div className={styles.sectionTitle}><h2 id="developer-keys-title">내 API 키</h2><span>활성 {activeCount} / 5개</span></div>
          <p className={styles.description}>클라이언트마다 키를 나눠 쓰면 필요한 연결만 회수할 수 있어요. 전체 키는 발급 직후에만 복사할 수 있어요.</p>
          <form onSubmit={event => void issue(event)} className={styles.form}>
            <label htmlFor="developer-key-name">키 이름</label><input id="developer-key-name" value={name} onChange={event => setName(event.target.value)} maxLength={80} autoComplete="off" placeholder="예: 내 MCP 연결" disabled={!!busy || hasSecret || activeCount >= 5}/>
            <fieldset disabled={!!busy || hasSecret || activeCount >= 5}><legend>사용 권한</legend>{consoleScopes.map(scope => <label key={scope} className={styles.scope}><input type="checkbox" checked={scopes.includes(scope)} onChange={event => changeScope(scope, event.target.checked)}/>{scopeNames[scope]}</label>)}</fieldset>
            <button className={styles.primary} type="submit" disabled={!!busy || hasSecret || activeCount >= 5 || !name.trim() || !scopes.length}>{busy === 'issue' ? '발급하는 중…' : '새 API 키 발급'}</button>
            {activeCount >= 5 && <p className={styles.description}>키 5개를 모두 사용 중이에요. 새 키가 필요하면 사용하지 않는 키를 먼저 회수해 주세요.</p>}
            {hasSecret && <p className={styles.description}>새 키를 복사하고 키 영역을 닫으면 다음 키를 발급할 수 있어요.</p>}
          </form>
          {!keys.length ? <div className={styles.emptySmall}>아직 발급한 키가 없어요. 사용할 클라이언트의 이름으로 첫 키를 만들어 보세요.</div> : <ul className={styles.keyList}>{keys.map(key => { const status = keyState(key); return <li key={key.id}>
            <div className={styles.keyHeading}><strong>{key.name}</strong><span className={status === 'active' ? styles.active : styles.muted}>{status === 'active' ? '사용 중' : status === 'revoked' ? '회수됨' : '만료됨'}</span></div>
            <code>{key.key_prefix}…</code><p>{key.scopes.map(scope => scopeNames[scope]).join(' · ')}</p><p>발급 {consoleDate(key.created_at)} · 만료 {consoleDate(key.expires_at)}</p><p>최근 사용: {consoleDate(key.last_used_at)}</p>
            {status === 'active' && (revoke === key.id ? <div className={styles.confirm}><p>이 키를 회수할까요? 연결된 클라이언트에서 더 이상 사용할 수 없어요.</p><div><button type="button" disabled={!!busy} onClick={() => setRevoke(null)}>취소</button><button type="button" className={styles.danger} disabled={!!busy} onClick={() => void revokeKey(key.id)}>{busy === key.id ? '회수하는 중…' : '키 회수'}</button></div></div> : <button type="button" disabled={!!busy} onClick={() => setRevoke(key.id)}>이 키 회수</button>)}
          </li>; })}</ul>}
        </section>
        <section className={styles.card} aria-labelledby="developer-usage-title"><div className={styles.sectionTitle}><h2 id="developer-usage-title">파일럿 사용량</h2><span>운영 횟수 기준</span></div><p className={styles.description}>실제 결제 금액이 아닌 기능별 사용 한도예요. 자동 초과 과금은 없어요.</p>
          {usageError ? <div role="alert" className={styles.emptySmall}>{usageError}<button type="button" onClick={() => void load()}>다시 불러오기</button></div> : !grants.length ? <div className={styles.emptySmall}>아직 연결된 사용 한도가 없어요. 파일럿 한도를 연결하면 기간과 남은 횟수가 여기에 보여요.</div> : <ul className={styles.usageList}>{grants.map(grant => <li key={grant.id}><div className={styles.keyHeading}><strong>{usageLabels[grant.metric]}</strong><span>{grantState(grant)}</span></div><p>{consoleDate(grant.period_start)} ~ {consoleDate(grant.period_end)}</p><div className={styles.counts}><div><b>{grantState(grant) === '사용 중' ? grant.remaining_units.toLocaleString('ko-KR') : '—'}</b><span>남은 횟수</span></div><div><b>{grant.used_units.toLocaleString('ko-KR')}</b><span>사용</span></div><div><b>{grant.reserved_units.toLocaleString('ko-KR')}</b><span>확인 중</span></div></div><p>전체 한도 {grant.hard_limit.toLocaleString('ko-KR')}회</p></li>)}</ul>}
          {grants.some(grant => grant.reserved_units > 0) && <p className={styles.description}>확인 중인 작업은 남은 한도에서 제외돼요.</p>}
        </section>
      </div>
      <section className={styles.note}><h2>MCP에서 연결하기</h2><p>발급한 키를 클라이언트의 비밀 환경변수나 인증 설정에 보관해 주세요. 대화나 공개 코드에는 붙여넣지 마세요.</p><p>로고월을 준비한 뒤 받은 requestKey를 만들기·수집 요청에 전달하면 중복 실행을 막을 수 있어요. 연결할 클라이언트의 지원 방식은 별도로 확인해요.</p></section>
    </>}
  </div>;
}
