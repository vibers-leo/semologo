"use client";
import {usePathname} from 'next/navigation';
import {storyRailMode} from '@/lib/story-rail-policy.mjs';
import StoryRail from './StoryRail';
export default function PageStoryRail(){
 const pathname=usePathname();
 const mode=storyRailMode(pathname);
 if(mode==='off')return null;
 return <StoryRail key={pathname} defaultCollapsed={mode==='collapsed'} storageScope={mode==='collapsed'?'home':'content'}/>;
}
