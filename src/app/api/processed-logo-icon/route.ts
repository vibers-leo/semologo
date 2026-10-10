import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import sharp from 'sharp';
import { CDN, VERSION } from '@/lib/cdn';
import { trafficDb } from '@/lib/traffic-db';
import { cmsBrand } from '@/lib/cms-brand';
import { applyReviewedAssets, reviewedVariants } from '@/lib/reviewed-logo-assets';
import { monochromeIconVector, processedIconSvg, type IconVector } from '@/lib/processed-logo-icon';
export const runtime='nodejs';
export const dynamic='force-dynamic';
const vectors=new Map<string,{at:number;vector:IconVector}>();
const pending=new Map<string,Promise<IconVector>>();
let active=0;
async function inputFor(id:string):Promise<IconVector>{
  if(active>=3)throw new Error('busy');active++;
  try{
    let brand=applyReviewedAssets({id,name_ko:id,name_en:id,category:'',has_svg:true});
    try{const result=await trafficDb().query("SELECT payload FROM semologo.logo_posts WHERE id=$1 AND status='published' LIMIT 1",[id]);if(result.rows[0])brand=applyReviewedAssets(cmsBrand(id,result.rows[0].payload));}catch{/* Fixed public CDN remains readable when optional CMS is unavailable. */}
    if(brand.hidden||brand.merged_into)throw new Error('unsupported');
    const manifest=reviewedVariants[id];const symbol=manifest?.variants.find(v=>v.form==='symbol'&&v.files.svg&&v.color!=='white'&&v.color!=='mono-light');
    const files=[symbol?.files.svg,brand.svg_transparent,typeof brand.logo_svg==='string'?brand.logo_svg:null,'logo.svg'].filter((f):f is string=>Boolean(f));
    for(const file of [...new Set(files)]){
      if(brand.rejected_asset_files?.includes(file))continue;
      try{
        let input:Buffer;
        if(file.startsWith('/submissions/')&&!file.includes('..')&&!file.includes('\\')&&/^\/submissions\/[\w./-]+\.svg$/.test(file)){
          input=await readFile(join(process.cwd(),'public',file));
        }else{
          if(!/^(?:[\w-]+\/)*[\w.-]+\.svg$/.test(file)||file.includes('..'))continue;
          const response=await fetch(`${CDN}/${encodeURIComponent(id)}/${file}?v=${VERSION}`,{cache:'no-store',redirect:'error',signal:AbortSignal.timeout(5000)});
          if(!response.ok||!response.body){await response.body?.cancel();continue;}
          const reader=response.body.getReader();const parts:Uint8Array[]=[];let size=0;
          try{while(true){const part=await reader.read();if(part.done)break;size+=part.value.byteLength;if(size>500_000)throw new Error('large');parts.push(part.value);}}finally{await reader.cancel();}
          input=Buffer.concat(parts);
        }
        const vector=monochromeIconVector(input);if(vectors.size>=64)vectors.delete(vectors.keys().next().value!);vectors.set(id,{at:Date.now(),vector});return vector;
      }catch{/* A multicolor, active or unavailable source is never blindly whitened. */}
    }
    throw new Error('unsupported');
  }finally{active--;}
}
export async function GET(request:Request){
  const params=new URL(request.url).searchParams;const id=params.get('id')||'';const format=params.get('format')||'info';const shape=params.get('shape')||'circle';const color=params.get('color');
  if(!/^[\p{L}\p{N}._-]{1,200}$/u.test(id)||!['info','svg','png'].includes(format)||!['circle','square'].includes(shape)||(color!==null&&!/^#[0-9a-f]{6}$/i.test(color)))return Response.json({error:'아이콘 설정을 확인해 주세요.'},{status:400});
  try{
    const cached=vectors.get(id);let vector=cached&&Date.now()-cached.at<600_000?cached.vector:undefined;
    if(!vector){let task=pending.get(id);if(!task){task=inputFor(id);pending.set(id,task);}try{vector=await task;}finally{pending.delete(id);}}
    // An all-white source needs a user-selected contrasting background rather than an invented brand color.
    if(format==='info')return Response.json({available:true,color:vector.color==='#ffffff'?null:vector.color,label:'가공 아이콘',notice:'원본 벡터를 편집한 아이콘이에요. 공식 제공 파일과 구분해 사용해 주세요.'},{headers:{'Cache-Control':'private,max-age=600'}});
    const background=color??(vector.color==='#ffffff'?null:vector.color);if(!background)return Response.json({error:'아이콘 배경색을 골라 주세요.'},{status:422});
    const svg=processedIconSvg(vector,shape as 'circle'|'square',background);
    const bytes=format==='svg'?svg:await sharp(svg,{limitInputPixels:2_000_000}).timeout({seconds:3}).png().toBuffer();
    return new Response(new Uint8Array(bytes),{headers:{'Content-Type':format==='svg'?'image/svg+xml':'image/png','Cache-Control':'public,max-age=600','X-Content-Type-Options':'nosniff','Content-Security-Policy':"default-src 'none'; sandbox",...(params.get('download')==='1'?{'Content-Disposition':`attachment; filename="processed-icon-${shape}.${format}"`}:{})}});
  }catch(e){const busy=e instanceof Error&&e.message==='busy';return Response.json({available:false,error:busy?'아이콘을 준비하고 있어요. 잠시 후 다시 시도해 주세요.':'이 로고는 자동 가공을 지원하지 않아요. 공식 로고 파일을 이용해 주세요.'},{status:busy?503:422,headers:{'Cache-Control':'no-store'}});}
}
