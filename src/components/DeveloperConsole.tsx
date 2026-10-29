"use client";
import { useEffect, useState } from 'react';
import { onAuthStateChanged, type User } from 'firebase/auth';
import { getClientAuth } from '@/lib/firebase';
import Header from '@/components/Header';
import DeveloperConsolePanel from './DeveloperConsolePanel';
import styles from './DeveloperConsole.module.css';
export default function DeveloperConsole() {
  const [ready, setReady] = useState(false), [user, setUser] = useState<User | null>(null), [failed, setFailed] = useState(false);
  useEffect(() => { try { return onAuthStateChanged(getClientAuth(), next => { setUser(next); setReady(true); setFailed(false); }); } catch { setFailed(true); setReady(true); } }, []);
  return <div className={styles.page}><Header/><main className={styles.main}><header className={styles.heading}><span className={styles.eyebrow}>SEMOLOGO DEVELOPERS</span><h1>개발자 콘솔</h1><p>내 계정의 API 키와 로고월 기능 사용량을 관리해요. 현재는 초대된 계정으로 운영 파일럿을 진행해요.</p></header>
    {!ready ? <p className={styles.loading} role="status">로그인 상태를 확인하고 있어요.</p> : !user ? <section className={styles.login}><h2>내 계정으로 연결해 보세요</h2><p>{failed ? '로그인 상태를 불러오지 못했어요. 다시 로그인해 주세요.' : 'Google 계정으로 로그인하면 API 키 발급·회수와 파일럿 사용량을 확인할 수 있어요.'}</p><a href="/login/?next=%2Fdevelopers%2F">Google로 계속하기</a></section> : <DeveloperConsolePanel user={user} key={user.uid}/>}
  </main></div>;
}
