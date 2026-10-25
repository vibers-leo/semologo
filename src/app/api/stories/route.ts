import { getStories } from '@/lib/story-cms';
export const dynamic='force-dynamic';
export async function GET(){try{return Response.json({stories:(await getStories()).filter(p=>p.video?.featured).slice(0,7).map(({slug,title,description,video})=>({slug,title,description,video}))},{headers:{'Cache-Control':'public, max-age=0, s-maxage=30'}});}catch{return Response.json({stories:[],error:'영상을 불러오지 못했어요.'},{status:503,headers:{'Cache-Control':'no-store'}});}}
