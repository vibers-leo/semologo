"use client";

import Image from "next/image";
import { signInWithPopup } from "firebase/auth";
import { getClientAuth, googleProvider } from "@/lib/firebase";
import { useRouter, useSearchParams } from "next/navigation";
import Header from "@/components/Header";

export default function EnglishLoginPage() {
  const router = useRouter();
  const params = useSearchParams();
  const handleGoogle = async () => {
    try {
      await signInWithPopup(getClientAuth(), googleProvider);
      const next = params.get("next");
      router.push(next && next.startsWith("/") && !next.startsWith("//") ? next : "/en/");
    } catch (error) {
      console.error(error);
    }
  };
  return <div className="min-h-screen" style={{ background: "var(--bg)" }}><Header /><main className="mx-auto flex max-w-sm flex-col items-center px-4 py-16">
    <Image src="/semologo.png" alt="SemoLogo" width={280} height={80} priority className="mb-5 h-16 w-auto object-contain" />
    <h1 className="text-xl font-bold">Sign in to SemoLogo</h1>
    <p className="mt-2 text-center text-sm text-gray-500">Use favorites, submit logos and manage your account.</p>
    <button onClick={handleGoogle} className="mt-8 flex w-full items-center justify-center gap-3 rounded-full border px-4 py-3 text-sm font-medium hover:bg-gray-50"><svg width="18" height="18" viewBox="0 0 24 24"><path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/><path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/><path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/><path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/></svg>Continue with Google</button>
    <p className="mt-6 text-xs text-gray-500">You can browse and save favorites without signing in.</p>
  </main></div>;
}
