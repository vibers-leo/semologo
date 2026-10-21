"use client";

import Image from "next/image";
import InAppLoginNotice from "@/components/InAppLoginNotice";
import { loginBrowser, externalLoginUrl, safeLoginNext } from "@/lib/login-browser";
import { getRedirectResult, onAuthStateChanged } from "firebase/auth";
import { startGoogleLogin, hasNativeGoogleLogin, authErrorCode } from "@/lib/google-login";
import { getClientAuth } from "@/lib/firebase";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import Header from "@/components/Header";

export default function EnglishLoginPage() {
  const router = useRouter();
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [nativeLogin, setNativeLogin] = useState(false);
  const [browser, setBrowser] = useState<ReturnType<typeof loginBrowser> | null>(null);
  const [externalUrl, setExternalUrl] = useState('');
  useEffect(() => {
    const current = loginBrowser(navigator.userAgent);
    setBrowser(current);
    setExternalUrl(externalLoginUrl(window.location.href));
    const native = hasNativeGoogleLogin();
    setNativeLogin(native);
    if (current.embedded && !native) return;
    const auth = getClientAuth();
    const destination = () => safeLoginNext(new URLSearchParams(window.location.search).get("next"), "/en/");
    const unsubscribe = onAuthStateChanged(auth, user => { if (user) router.replace(destination()); });
    if (!native) getRedirectResult(auth).catch(() => setError("We couldn’t complete sign-in. Please try again."));
    return unsubscribe;
  }, [router]);

  const handleGoogle = async () => {
    if (busy || (loginBrowser(navigator.userAgent).embedded && !hasNativeGoogleLogin())) return;
    setError("");
    setBusy(true);
    try {
      await startGoogleLogin();
      if (getClientAuth().currentUser) router.replace(safeLoginNext(new URLSearchParams(window.location.search).get("next"), "/en/"));
    } catch (error) {
      const code = authErrorCode(error);
      if (!["auth/popup-closed-by-user", "auth/cancelled-popup-request"].includes(code)) {
        setError(code === "auth/popup-blocked" ? "Allow pop-ups for SemoLogo in Safari Settings, then try again." : code === "auth/network-request-failed" ? "Check your internet connection and try again." : "We couldn’t complete sign-in. Please try again.");
      }
    } finally { setBusy(false); }
  };

  return <div className="min-h-screen" style={{ background: "var(--bg)" }}><Header /><main className="mx-auto flex max-w-sm flex-col items-center px-4 py-16">
    <Image src="/semologo.png" alt="SemoLogo" width={280} height={80} priority className="mb-5 h-16 w-auto object-contain" />
    <h1 className="text-xl font-bold">Sign in to SemoLogo</h1>
    <p className="mt-2 text-center text-sm text-gray-500">Submit logos and manage your account.</p>
    {browser && !nativeLogin && <InAppLoginNotice browser={browser} url={externalUrl} english />}
    <button disabled={busy || !!(browser?.embedded && !nativeLogin)} aria-busy={busy} onClick={handleGoogle} className="mt-8 flex w-full items-center justify-center gap-3 rounded-full border px-4 py-3 text-sm font-medium hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"><svg width="18" height="18" viewBox="0 0 24 24"><path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/><path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/><path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/><path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/></svg>{busy ? "Signing in…" : "Continue with Google"}</button>
    {error && <p role="alert" className="mt-4 text-center text-sm text-red-600">{error}</p>}
    <p className="mt-6 text-xs text-gray-500">You can browse the logo collection without signing in.</p>
  </main></div>;
}
