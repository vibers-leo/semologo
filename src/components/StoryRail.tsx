"use client";
import {useEffect,useState} from 'react';
import Link from 'next/link';
import StoryVideo from './StoryVideo';
type Clip={slug:string;title:string;video:{url:string;poster?:string}};
export default function StoryRail(){
 const [clips,setClips]=useState<Clip[]>([]),[index,setIndex]=useState(0),[hidden,setHidden]=useState(false);
 useEffect(()=>{let active=true;try{if(sessionStorage.getItem('semologo-story-rail-hidden')){setHidden(true);return;}}catch{}
 const controller=new AbortController();void fetch('/api/stories/',{signal:controller.signal}).then(async r=>{if(r.ok&&active)setClips((await r.json()).stories||[]);}).catch(()=>{});return()=>{active=false;controller.abort();};},[]);
 if(hidden||!clips.length)return null;const clip=clips[index];
 return <aside className="story-rail" aria-label="세모위키 · 숏폼"><div className="mb-3 flex items-center justify-between"><b className="text-xs">세모위키 · 숏폼</b><button aria-label="이번 방문에서 영상 영역 숨기기" onClick={()=>{setHidden(true);try{sessionStorage.setItem('semologo-story-rail-hidden','1');}catch{}}} className="p-1 text-gray-500">×</button></div>
 <StoryVideo portrait key={clip.slug} url={clip.video.url} poster={clip.video.poster} title={clip.title}/><p className="mt-3 text-sm font-bold leading-6">{clip.title}</p><Link href={`/blog/${clip.slug}/`} className="mt-2 block text-xs text-indigo-600">이야기 읽기 ↗</Link>
 {clips.length>1&&<div className="mt-4 flex items-center justify-between text-xs"><button aria-label="이전 영상" onClick={()=>setIndex(i=>(i-1+clips.length)%clips.length)}>←</button><span>{index+1} / {clips.length}</span><button aria-label="다음 영상" onClick={()=>setIndex(i=>(i+1)%clips.length)}>→</button></div>}
 <style>{`.story-rail{width:100%;max-height:calc(100dvh - 150px);overflow:auto;background:var(--bg,#fff);border:1px solid var(--border,#e5e7eb);border-radius:16px;padding:10px}`}</style>
 </aside>;
}
