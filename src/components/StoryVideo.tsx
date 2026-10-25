"use client";
import {useState} from 'react';
import {videoSource} from '@/lib/story-input.mjs';
export default function StoryVideo({url,poster,title}:{url:string;poster?:string;title:string}){
 const [playing,setPlaying]=useState(false);const source=videoSource(url);if(!source)return null;
 return <div className="overflow-hidden rounded-xl bg-[#17171b] text-white">
 {playing?<><div className="flex justify-end"><button className="px-3 py-2 text-xs" onClick={()=>setPlaying(false)}>영상 닫기 ×</button></div><div style={{aspectRatio:'9 / 16'}}>{source.kind==='youtube'?<iframe title={title} src={source.src} allow="fullscreen; picture-in-picture; encrypted-media" allowFullScreen className="h-full w-full border-0" referrerPolicy="strict-origin-when-cross-origin"/>:<video src={source.src} controls playsInline preload="metadata" poster={poster} className="h-full w-full"/>}</div></>:<button onClick={()=>setPlaying(true)} className="relative flex min-h-28 w-full flex-col items-center justify-center gap-3 p-4 text-center" aria-label={`${title} 영상 보기`}>
 {poster&&<img src={poster} alt="" loading="lazy" referrerPolicy="no-referrer" className="max-h-48 w-full rounded-lg object-cover" onError={e=>{e.currentTarget.hidden=true;}}/>}<span className="flex h-10 w-10 items-center justify-center rounded-full bg-white text-black" aria-hidden="true">▶</span><span className="text-sm font-bold">영상 보기</span></button>}
 </div>;
}
