import sharp from 'sharp';
import { cropLogoWallPng } from './logo-wall-crop';
import type { WallInk } from './logo-wall-balance';
export async function wallInkMetrics(png:Buffer):Promise<WallInk>{
  const {data}=await cropLogoWallPng(png);
  const meta=await sharp(data,{limitInputPixels:16000000}).metadata();
  const sample=await sharp(data).resize(96,96,{fit:'inside',withoutEnlargement:true}).ensureAlpha().raw().toBuffer({resolveWithObject:true});
  const w=sample.info.width,h=sample.info.height,p=sample.data;let edges=0,white=0,ink=0;
  for(let y=0;y<h;y++)for(let x=0;x<w;x++)if(x===0||y===0||x===w-1||y===h-1){const i=(y*w+x)*4;edges++;if(p[i+3]>245&&Math.min(p[i],p[i+1],p[i+2])>245)white++;}
  const paper=white/Math.max(1,edges)>.95;
  for(let i=0;i<p.length;i+=4)if(p[i+3]>32&&!(paper&&Math.min(p[i],p[i+1],p[i+2])>245))ink++;
  if(ink/Math.max(1,w*h)<.003)throw new Error('empty_logo');
  return {width:meta.width||1,height:meta.height||1,density:ink/Math.max(1,w*h)};
}
