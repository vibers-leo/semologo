"use client";
export default function BlogError({reset}:{reset:()=>void}){return <main className="content-page py-16"><h1 className="text-xl font-bold">이야기를 불러오지 못했어요.</h1><p className="mt-3">잠시 후 다시 시도해 주세요.</p><button onClick={reset} className="mt-6 rounded-lg bg-indigo-600 px-5 py-3 text-white">다시 불러오기</button></main>;}
