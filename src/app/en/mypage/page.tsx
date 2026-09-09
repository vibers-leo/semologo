"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import Header from "@/components/Header";
import { onAuthStateChanged, type User } from "firebase/auth";
import { getClientAuth } from "@/lib/firebase";
export default function EnglishMyPage() {
  const [user,setUser]=useState<User|null>(null); const [ready,setReady]=useState(false);
  useEffect(()=>onAuthStateChanged(getClientAuth(),u=>{setUser(u);setReady(true)}),[]);
  if(!ready)return <><Header/><main className="mx-auto max-w-2xl px-4 py-16 text-center text-gray-500">Loading…</main></>;
  if(!user)return <><Header/><main className="mx-auto max-w-2xl px-4 py-16 text-center"><h1 className="text-2xl font-bold">Sign in to view your account</h1><p className="mt-3 text-sm text-gray-500">You can browse the collection without an account.</p><Link href="/en/login/" className="mt-6 inline-block rounded-full bg-black px-5 py-3 text-sm font-semibold text-white">Sign in</Link></main></>;
  return <><Header/><main className="mx-auto max-w-2xl px-4 py-12 pb-28"><h1 className="text-3xl font-black">My account</h1><p className="mt-2 text-sm text-gray-500">Welcome{user.displayName ? `, ${user.displayName}` : ""}.</p><section className="mt-8 rounded-2xl border bg-white p-6"><h2 className="text-lg font-bold">API access</h2><p className="mt-3 text-sm leading-7 text-gray-600">Need programmatic logo access? Contact us at contact@semologo.com with your project and intended use. We’ll reply with the available options.</p></section></main></>;
}
