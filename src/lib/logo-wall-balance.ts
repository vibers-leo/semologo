export type WallInk = { width: number; height: number; density?: number };
const clamp = (n:number,a:number,b:number) => Math.max(a,Math.min(b,n));
/** Balance visible ink mass across a group; never distort aspect ratios. */
export function balancedWallScales(logos: WallInk[]): number[] {
  if(!logos.length)return [];
  const heights=logos.map(m=>Math.pow(clamp(m.width/Math.max(1,m.height),.2,20),-.42)*Math.pow(clamp(m.density??.45,.08,1),-.18));
  const sorted=heights.slice().sort((a,b)=>a-b);const reference=sorted[Math.floor(sorted.length/2)]||1;
  return heights.map(h=>Math.round(clamp(h/reference*100,50,180)));
}
export function previewWallFits(logos: WallInk[],boxWidth:number,boxHeight:number,scales:number[]) {
  // Persisted scales are authoritative. Geometry sets a stable canvas baseline,
  // so resizing one logo never silently rescales every other logo.
  const automatic=balancedWallScales(logos);
  const chosen=scales;
  const capacities=logos.map((m,i)=>Math.min(boxHeight*.74,boxWidth*.88/(m.width/Math.max(1,m.height)))/(automatic[i]/100));
  const sorted=capacities.slice().sort((a,b)=>a-b);const base=sorted[Math.floor(sorted.length*.25)]||boxHeight*.65;
  return logos.map((m,i)=>{const ratio=m.width/Math.max(1,m.height);const h=Math.min(base*.9*chosen[i]/100,boxHeight*.82,boxWidth*.92/ratio);return {width:Math.max(1,Math.round(h*ratio)),height:Math.max(1,Math.round(h))};});
}
