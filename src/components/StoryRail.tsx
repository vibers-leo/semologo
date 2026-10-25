"use client";
import {useEffect,useState} from 'react';
import Link from 'next/link';
import {videoSource} from '@/lib/story-input.mjs';
type Clip={slug:string;title:string;video:{url:string;poster?:string}};
export default function StoryRail(){
 const [clips,setClips]=useState<Clip[]>([]),[index,setIndex]=useState(0),[hidden,setHidden]=useState(false),[desktop,setDesktop]=useState(false);
 useEffect(()=>{const media=window.matchMedia("(min-width: 1024px)");const sync=()=>setDesktop(media.matches);sync();media.addEventListener("change",sync);return()=>media.removeEventListener("change",sync);},[]);
 useEffect(()=>{if(!desktop)return;let active=true;try{if(sessionStorage.getItem('semologo-story-rail-hidden')){setHidden(true);return;}}catch{}
 const controller=new AbortController();void fetch('/api/stories/',{signal:controller.signal}).then(async r=>{if(r.ok&&active)setClips((await r.json()).stories||[]);}).catch(()=>{});return()=>{active=false;controller.abort();};},[desktop]);
 if(!desktop||hidden||!clips.length)return null;
 const current=index%clips.length;
 const clip=clips[current],source=videoSource(clip.video.url);if(!source)return null;
 const change=(step:number)=>setIndex(i=>(i+step+clips.length)%clips.length);
 return <aside className="story-rail" aria-label="세모위키 숏폼 영상">
  <div className="story-rail-heading"><Link href={`/blog/${clip.slug}/`} title={clip.title}>세모위키</Link><span aria-live="polite">{current+1}/{clips.length}</span><button aria-label="이번 방문에서 영상 영역 숨기기" onClick={()=>{setHidden(true);try{sessionStorage.setItem('semologo-story-rail-hidden','1');}catch{}}}>×</button></div>
  <div className="story-rail-frame" key={clip.slug}>
   {source.kind==='youtube'?<iframe title={clip.title} src={`${source.src}&autoplay=1&mute=1`} allow="autoplay; encrypted-media; picture-in-picture; fullscreen" allowFullScreen referrerPolicy="strict-origin-when-cross-origin"/>:<video title={clip.title} src={source.src} controls autoPlay muted playsInline preload="metadata"/>}
  </div>
  <nav className="story-rail-navigation" aria-label="숏폼 영상 넘기기">
   <button onClick={()=>change(1)} disabled={clips.length<2} aria-label="다음 영상" title="다음 영상"><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" aria-hidden="true"><path d="m6 9 6 6 6-6"/></svg></button>
   <button onClick={()=>change(-1)} disabled={clips.length<2} aria-label="이전 영상" title="이전 영상"><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" aria-hidden="true"><path d="m6 15 6-6 6 6"/></svg></button>
  </nav>
  <style>{`.story-rail{width:100%;max-height:calc(100dvh - 150px);overflow:auto;background:#fafafa;border:1px solid #e5e5e5;border-radius:0}.story-rail-heading{height:32px;display:flex;align-items:center;gap:8px;padding:0 9px;font-size:10px;color:#737373}.story-rail-heading a{flex:1;font-weight:700;color:#171717}.story-rail-heading button{width:22px;height:24px;font-size:15px}.story-rail-frame{aspect-ratio:9/16;background:#000}.story-rail-frame iframe,.story-rail-frame video{display:block;width:100%;height:100%;border:0;border-radius:0}.story-rail-navigation{display:grid;grid-template-columns:1fr 1fr;border-top:1px solid #e5e5e5}.story-rail-navigation button{height:36px;display:flex;align-items:center;justify-content:center;color:#737373;background:#f5f5f5}.story-rail-navigation button+button{border-left:1px solid #e5e5e5}.story-rail-navigation button:hover{background:#eaeaea}.story-rail-navigation button:disabled{opacity:.35;cursor:default}.story-rail button:focus-visible,.story-rail a:focus-visible{outline:2px solid #6366f1;outline-offset:-2px}`}</style>
 </aside>;
}
