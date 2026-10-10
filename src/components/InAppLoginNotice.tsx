'use client';
import { useState } from 'react';
import { androidBrowserIntent, type loginBrowser } from '@/lib/login-browser';

type Props = { browser: ReturnType<typeof loginBrowser>; url: string; english?: boolean };
export default function InAppLoginNotice({ browser, url, english = false }: Props) {
  const [copied, setCopied] = useState(false);
  const [manualCopy, setManualCopy] = useState(false);
  if (!browser.embedded) return null;
  return <section className="mb-5 rounded-2xl border border-indigo-100 bg-indigo-50 p-4" aria-label={english ? 'Open a browser to sign in' : '브라우저에서 로그인 안내'}>
    <h2 className="text-sm font-semibold text-gray-900">{english ? 'Open your browser to sign in' : '기본 브라우저에서 로그인해 주세요'}</h2>
    <p className="mt-2 text-sm leading-6 text-gray-600">{english ? 'Google sign-in may be blocked inside this app. Open this page in Safari or Chrome to continue.' : `${browser.name} 내부 브라우저에서는 구글 로그인이 제한될 수 있어요. Safari나 Chrome에서 이 페이지를 열어 주세요.`}</p>
    {browser.android && <a href={androidBrowserIntent(url)} className="mt-3 flex min-h-11 items-center justify-center rounded-xl bg-indigo-600 px-4 text-sm font-semibold text-white">{english ? 'Open in browser' : '기본 브라우저로 열기'}</a>}
    <button type="button" onClick={async () => {
      try { await navigator.clipboard.writeText(url); setCopied(true); }
      catch { setManualCopy(true); }
    }} className="mt-2 flex min-h-11 w-full items-center justify-center rounded-xl border border-indigo-200 bg-white px-4 text-sm font-medium text-indigo-700">{copied ? (english ? 'Link copied' : '링크를 복사했어요') : (english ? 'Copy sign-in link' : '로그인 링크 복사')}</button>
    <p className="mt-3 text-xs leading-5 text-gray-600">{english ? 'Use the app menu to open an external browser, or paste the copied link into Safari or Chrome.' : '앱의 ⋯ 또는 공유 메뉴에서 ‘외부 브라우저로 열기’를 선택하거나, 복사한 링크를 Safari·Chrome 주소창에 붙여 넣어 주세요.'}</p>
    <span role="status" className="sr-only">{copied ? (english ? 'Link copied' : '로그인 링크를 복사했어요') : ''}</span>
    {manualCopy && <input aria-label={english ? 'Sign-in link' : '복사할 로그인 링크'} value={url} readOnly onFocus={event => event.currentTarget.select()} className="mt-3 w-full rounded-lg border bg-white p-2 text-xs" />}
  </section>;
}
