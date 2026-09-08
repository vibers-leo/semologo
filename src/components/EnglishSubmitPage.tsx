"use client";
import { useRef, useState } from "react";
import Link from "next/link";
import Header from "./Header";
import { trackEvent } from "@/lib/analytics";

export default function EnglishSubmitPage() {
  const [name, setName] = useState(""); const [category, setCategory] = useState(""); const [website, setWebsite] = useState(""); const [memo, setMemo] = useState(""); const [file, setFile] = useState<File|null>(null); const [status, setStatus] = useState("idle"); const fileRef = useRef<HTMLInputElement>(null);
  async function submit(e: React.FormEvent) { e.preventDefault(); if (!name || !category) return; setStatus("sending"); const fd = new FormData(); fd.set("brand_name", name); fd.set("category", category); fd.set("logo_url", website); fd.set("memo", memo); if (file) fd.set("logo_file", file); try { const r = await fetch("https://ai.vibers.co.kr/api/logo-submit", {method:"POST",body:fd}); const j = await r.json(); setStatus(j.success ? "done" : "error"); if(j.success) trackEvent("logo_submitted", {category, has_file:Boolean(file), has_domain:Boolean(website)}); } catch {setStatus("error");} }
  return <div className="min-h-screen" style={{background:"var(--bg)"}}><Header/><main className="mx-auto max-w-[600px] px-4 py-12">
    <Link href="/en/" className="text-sm text-gray-500">← SemoLogo home</Link><h1 className="mt-6 text-3xl font-black">Submit a logo</h1><p className="mt-2 text-sm text-gray-500">Help us add a brand that is missing from the collection.</p>
    {status === "done" ? <div className="py-16 text-center"><p className="text-5xl">✅</p><h2 className="mt-4 text-2xl font-bold">Submission received</h2><p className="mt-2 text-sm text-gray-500">Thanks. We’ll review it and add it when it meets our quality and rights checks.</p><Link href="/en/" className="mt-6 inline-block rounded-full bg-black px-5 py-3 text-sm font-semibold text-white">Browse logos</Link></div> : <form onSubmit={submit} className="mt-8 flex flex-col gap-5">
      <div><label className="mb-2 block text-sm font-semibold">Logo file <span className="font-normal text-gray-500">(SVG or PNG recommended)</span></label><button type="button" onClick={()=>fileRef.current?.click()} className="w-full rounded-xl border-2 border-dashed p-7 text-sm text-gray-500">{file ? file.name : "Choose a file · SVG, PNG, JPG or WEBP"}</button><input ref={fileRef} type="file" accept=".svg,.png,.jpg,.jpeg,.webp" className="hidden" onChange={e=>setFile(e.target.files?.[0]||null)}/></div>
      <label className="text-sm font-semibold">Brand name<input required value={name} onChange={e=>setName(e.target.value)} placeholder="e.g. Acme" className="mt-2 w-full rounded-lg border p-3 font-normal"/></label>
      <label className="text-sm font-semibold">Category<select required value={category} onChange={e=>setCategory(e.target.value)} className="mt-2 w-full rounded-lg border p-3 font-normal"><option value="">Choose a category</option><option>IT·테크</option><option>AI·머신러닝</option><option>금융·결제</option><option>패션·뷰티</option><option>식품·음료</option><option>기타</option></select></label>
      <label className="text-sm font-semibold">Official website <span className="font-normal text-gray-500">(optional)</span><input type="url" value={website} onChange={e=>setWebsite(e.target.value)} placeholder="https://example.com" className="mt-2 w-full rounded-lg border p-3 font-normal"/></label>
      <label className="text-sm font-semibold">Notes <span className="font-normal text-gray-500">(optional)</span><textarea value={memo} onChange={e=>setMemo(e.target.value)} rows={3} placeholder="Source or details about this logo" className="mt-2 w-full rounded-lg border p-3 font-normal"/></label>
      {status === "error" && <p role="alert" className="text-sm text-red-600">Couldn’t submit right now. Please try again.</p>}<button disabled={status==="sending"||!name||!category} className="rounded-xl bg-black py-3.5 text-sm font-bold text-white disabled:opacity-40">{status === "sending" ? "Sending…" : "Submit logo"}</button><p className="text-center text-xs text-gray-500">All logos remain the property of their respective brands.</p>
    </form>}
  </main></div>;
}
