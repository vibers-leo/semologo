import { BLOG_POSTS, type BlogPost } from './blog';
import { trafficDb } from './traffic-db';
export type Story = BlogPost & {coverImage?:string;video?:{url:string;poster?:string;featured:boolean}};
export async function getStories():Promise<Story[]> {
 // Read all statuses so an archived or draft CMS entry suppresses its legacy fallback.
 if(!process.env.DB_VIBERS_MAIN_URL)return BLOG_POSTS;
 const rows=await trafficDb().query('SELECT slug,status,payload FROM semologo.stories');
 const managed=new Set(rows.rows.map(r=>r.slug));
 return [...rows.rows.filter(r=>r.status==='published').map(r=>r.payload as Story),...BLOG_POSTS.filter(p=>!managed.has(p.slug))].sort((a,b)=>b.date.localeCompare(a.date)||b.slug.localeCompare(a.slug));
}
export async function getStory(slug:string){return (await getStories()).find(p=>p.slug===slug);}
