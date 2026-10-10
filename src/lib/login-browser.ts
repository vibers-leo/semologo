export function loginBrowser(userAgent: string) {
  const android = /Android/i.test(userAgent);
  const ios = /iPhone|iPad|iPod/i.test(userAgent);
  const name = /NAVER/i.test(userAgent) ? '네이버' : /KAKAOTALK/i.test(userAgent) ? '카카오톡' : /Instagram/i.test(userAgent) ? '인스타그램' : /FBAN|FBAV/i.test(userAgent) ? '페이스북' : /Line\//i.test(userAgent) ? 'LINE' : '';
  const webview = /;\s*wv\)|SemoLogoApp/i.test(userAgent) || (ios && /AppleWebKit/i.test(userAgent) && !/Safari|CriOS|FxiOS|EdgiOS|OPiOS/i.test(userAgent));
  return { embedded: !!name || webview, android, ios, name: name || '앱' };
}

export function safeLoginNext(value: string | null, fallback = '/') {
  if (!value || !value.startsWith('/') || value.startsWith('//') || /[\\\u0000-\u001f\u007f]/.test(value)) return fallback;
  return value;
}

/** Copy only the login route and safe return path, never OAuth response parameters. */
export function externalLoginUrl(current: string) {
  const source = new URL(current);
  const result = new URL(source.pathname.startsWith('/en/') ? '/en/login/' : '/login/', source.origin);
  const next = safeLoginNext(source.searchParams.get('next'), '');
  if (next) result.searchParams.set('next', next);
  return result.href;
}

export function androidBrowserIntent(url: string) {
  const target = new URL(url);
  if (target.protocol !== 'https:') return url;
  return `intent://${target.host}${target.pathname}${target.search}#Intent;scheme=https;action=android.intent.action.VIEW;category=android.intent.category.BROWSABLE;S.browser_fallback_url=${encodeURIComponent(target.href)};end`;
}
