/** Shared by the authenticated API and SSH/local CLI. Never accepts raw HTML. */
export function validateStory(input) {
 const fail = message => { throw new Error(message); };
 if (!input || typeof input !== 'object') fail('글 내용을 확인해 주세요.');
 const text=(v,max,required=true)=>typeof v==='string' && v.trim().length<=max && (!required || v.trim()) ? v.trim() : fail('입력한 글의 길이와 필수 항목을 확인해 주세요.');
 const slug=text(input.slug,100); if(!/^[a-z0-9][a-z0-9-]{0,99}$/.test(slug)||slug==='collection-status') fail('주소는 영문 소문자·숫자·하이픈으로 입력해 주세요.');
 if(!['draft','published','archived'].includes(input.status)) fail('공개 상태를 확인해 주세요.');
 const list=(v,max)=>Array.isArray(v)&&v.length<=max?v:fail('항목 수를 확인해 주세요.');
 const url=v=>{ const s=text(v,2000);let u;try{u=new URL(s);}catch{fail('주소를 확인해 주세요.');}if(u.protocol!=='https:'||u.username||u.password)fail('https 주소를 입력해 주세요.');return u.href; };
 const sections=list(input.sections,100).map(s=>({heading:text(s.heading,200,false),paragraphs:list(s.paragraphs,100).map(v=>text(v,10000))}));
 const date=text(input.date,10);if(!/^\d{4}-\d{2}-\d{2}$/.test(date)||!Number.isFinite(Date.parse(date))||new Date(date).toISOString().slice(0,10)!==date)fail('게시일을 확인해 주세요.');
 const payload={slug,title:text(input.title,200),description:text(input.description,1000),date,category:text(input.category,100),author:text(input.author,100),tags:list(input.tags||[],30).map(v=>text(v,60)),readingMinutes:Math.max(1,Math.min(120,Math.round(Number(input.readingMinutes)||1))),sections};
 if(input.coverImage)payload.coverImage=url(input.coverImage);
 if(input.sources)payload.sources=list(input.sources,30).map(s=>({label:text(s.label,200),url:url(s.url)}));
 if(input.videoScript)payload.videoScript=list(input.videoScript,100).map(v=>text(v,10000));
 if(input.video?.url){const videoUrl=url(input.video.url);const parsed=videoSource(videoUrl);if(!parsed)fail('유튜브 동영상 주소 또는 https MP4 주소를 입력해 주세요.');payload.video={url:videoUrl,featured:input.video.featured===true};if(input.video.poster)payload.video.poster=url(input.video.poster);}
 if(input.status==='published'&&!sections.some(s=>s.paragraphs.length))fail('공개할 글의 본문을 입력해 주세요.');
 const revision=input.revision;if(revision!==undefined&&(!Number.isInteger(revision)||revision<0))fail('수정 버전을 확인해 주세요.');
 if(JSON.stringify(payload).length>180000)fail('글은 180KB 이내로 저장해 주세요.');
 return {slug,status:input.status,payload,revision:revision??0};
}
export function videoSource(value){
 try{const u=new URL(value);if(u.protocol!=='https:'||u.username||u.password)return null;let id;
 if(u.hostname==='youtu.be')id=u.pathname.slice(1);
 else if(['youtube.com','www.youtube.com','m.youtube.com'].includes(u.hostname))id=u.pathname.startsWith('/shorts/')?u.pathname.split('/')[2]:u.pathname==='/watch'?u.searchParams.get('v'):null;
 if(id&&/^[A-Za-z0-9_-]{11}$/.test(id))return {kind:'youtube',id,src:`https://www.youtube-nocookie.com/embed/${id}?playsinline=1&rel=0`};
 if(u.pathname.toLowerCase().endsWith('.mp4'))return {kind:'mp4',src:u.href};
 }catch{}return null;
}

export const storyWriteSql='WITH updated AS (UPDATE semologo.stories SET status=$2,payload=$3::jsonb,revision=revision+1,updated_at=now() WHERE slug=$1 AND revision=$4 RETURNING revision), inserted AS (INSERT INTO semologo.stories(slug,status,payload) SELECT $1,$2,$3::jsonb WHERE $4::int=0 ON CONFLICT DO NOTHING RETURNING revision) SELECT revision FROM updated UNION ALL SELECT revision FROM inserted';
