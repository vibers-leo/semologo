export type LogoBounds = { width:number; height:number; x:number; y:number; inkWidth:number; inkHeight:number };
const cache = new Map<string, LogoBounds>();

/** Read a small sample once; original files and their colours remain untouched. */
export function measureLogo(image:HTMLImageElement):LogoBounds {
  const width=image.naturalWidth, height=image.naturalHeight;
  const fallback={width,height,x:0,y:0,inkWidth:width,inkHeight:height};
  if (!width || !height) return fallback;
  const cached=cache.get(image.currentSrc || image.src); if(cached)return cached;
  let result=fallback;
  try {
    const c=document.createElement('canvas'); const factor=128/Math.max(width,height);
    c.width=Math.max(1,Math.round(width*factor));c.height=Math.max(1,Math.round(height*factor));
    const ctx=c.getContext('2d',{willReadFrequently:true}); if(!ctx)return fallback;
    ctx.drawImage(image,0,0,c.width,c.height); const data=ctx.getImageData(0,0,c.width,c.height).data;
    const white=(i:number)=>data[i+3]>245&&data[i]>245&&data[i+1]>245&&data[i+2]>245;
    // A white opaque border is paper, whereas transparent white ink is part of the mark.
    let edge=0,paper=0;
    for(let y=0;y<c.height;y++)for(let x=0;x<c.width;x++)if(x===0||y===0||x===c.width-1||y===c.height-1){edge++;if(white((y*c.width+x)*4))paper++;}
    const whitePaper=paper/edge>.95;
    let left=c.width,right=-1,top=c.height,bottom=-1;
    for(let y=0;y<c.height;y++)for(let x=0;x<c.width;x++){const i=(y*c.width+x)*4;if(data[i+3]>32&&!(whitePaper&&white(i))){left=Math.min(left,x);right=Math.max(right,x);top=Math.min(top,y);bottom=Math.max(bottom,y);}}
    if(right>=left&&bottom>=top)result={width,height,x:left/c.width*width,y:top/c.height*height,inkWidth:(right-left+1)/c.width*width,inkHeight:(bottom-top+1)/c.height*height};
  }catch{/* Cross-origin images keep the safe natural-aspect fallback. */}
  if(cache.size>=256)cache.delete(cache.keys().next().value!);
  cache.set(image.currentSrc||image.src,result); return result;
}

export function opticalFit(bounds:LogoBounds,boxWidth:number,boxHeight:number) {
  const ratio=bounds.inkWidth/Math.max(1,bounds.inkHeight);
  const horizontal=Math.max(0,Math.min(1,(ratio-1.4)/3));
  const fit=Math.min(boxWidth*(.74+.14*horizontal)/Math.max(1,bounds.inkWidth),boxHeight*(.72-.04*horizontal)/Math.max(1,bounds.inkHeight));
  return {width:bounds.width*fit,height:bounds.height*fit,offsetX:(bounds.width/2-bounds.x-bounds.inkWidth/2)*fit,offsetY:(bounds.height/2-bounds.y-bounds.inkHeight/2)*fit};
}

export async function initialWallScale(url:string):Promise<number> {
  const image=new Image();image.crossOrigin='anonymous';
  const loaded=await new Promise<boolean>(resolve=>{const timeout=setTimeout(()=>resolve(false),5000);image.onload=()=>{clearTimeout(timeout);resolve(true)};image.onerror=()=>{clearTimeout(timeout);resolve(false)};image.src=url;});
  if(!loaded)return 100;
  const b=measureLogo(image),ratio=b.inkWidth/Math.max(1,b.inkHeight);
  // Modest defaults; the editor's existing slider/handles and auto-fit remain authoritative.
  return Math.round(ratio<=1.4?88:ratio>=3?108:88+(ratio-1.4)/1.6*20);
}
