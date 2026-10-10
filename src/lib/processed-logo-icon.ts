/** Static, monochrome vector input only. Never evaluate SVG/CSS or recolor multicolor artwork. */
const tags = new Set(['svg','g','path','rect','circle','ellipse','line','polygon','polyline']);
const numeric = new Set(['x','y','x1','y1','x2','y2','cx','cy','r','rx','ry','width','height','stroke-width','stroke-miterlimit']);
const other = new Set(['d','points','transform','fill','stroke','fill-rule','stroke-linecap','stroke-linejoin','opacity','fill-opacity','stroke-opacity','viewBox','xmlns']);
const number = /^[-+]?(?:\d*\.\d+|\d+\.?\d*)(?:e[-+]?\d+)?(?:px)?$/i;
function paint(value: string): string {
  const s=value.trim().toLowerCase();
  if(s==='none')return s;
  if(s==='black'||s==='currentcolor')return '#000000';
  if(s==='white')return '#ffffff';
  if(/^#[0-9a-f]{3}$/.test(s))return '#'+s.slice(1).split('').map(c=>c+c).join('');
  if(/^#[0-9a-f]{6}$/.test(s))return s;
  throw new Error('unsupported');
}
export interface IconVector { body: string; viewBox: [number,number,number,number]; color: string; }
export function monochromeIconVector(input: Buffer): IconVector {
  if(input.length>500_000)throw new Error('large');
  let svg=input.toString('utf8').replace(/^\s*<\?xml[^?]*\?>/,'').replace(/<!--[\s\S]*?-->/g,'').replace(/<(title|desc)\b[^>]*>[^<]*<\/\1>/gi,'');
  if(/<!|<\?|&|\b(?:href|on\w+)\s*=|url\s*\(|@import/i.test(svg))throw new Error('unsupported');
  const stack: {tag:string;fill:string;stroke:string}[]=[];const output:string[]=[];const colors=new Set<string>();let box:IconVector['viewBox']|undefined;let cursor=0;let roots=0;let shapes=0;
  for(const match of svg.matchAll(/<([^>]+)>/g)){
    if(svg.slice(cursor,match.index).trim())throw new Error('unsupported');cursor=match.index!+match[0].length;
    const token=match[1];const close=token.startsWith('/');const self=/\/\s*$/.test(token);const name=/^\/?([A-Za-z][\w-]*)/.exec(token)?.[1];if(!name||!tags.has(name))throw new Error('unsupported');
    if(close){if(token.trim()!==`/${name}`||stack.pop()?.tag!==name)throw new Error('unsupported');if(name!=='svg')output.push(`</${name}>`);continue;}
    if(!stack.length){if(name!=='svg'||roots++)throw new Error('unsupported');}else if(name==='svg')throw new Error('unsupported');
    const attrs:Record<string,string>={};let rest=token.slice(name.length).replace(/\/\s*$/,'');
    while(rest.trim()){
      const a=/^\s+([\w:-]+)\s*=\s*(["'])([\s\S]*?)\2/.exec(rest);if(!a)throw new Error('unsupported');rest=rest.slice(a[0].length);const key=a[1];if(key in attrs)throw new Error('unsupported');attrs[key]=a[3];
    }
    if(attrs.style){const declarations=attrs.style.split(';').filter(s=>s.trim());delete attrs.style;for(const declaration of declarations){const m=/^\s*([\w-]+)\s*:\s*([^:]+)\s*$/.exec(declaration);if(!m||!other.has(m[1])&&!numeric.has(m[1]))throw new Error('unsupported');attrs[m[1]]=m[2].trim();}}
    for(const [key,value] of Object.entries(attrs)){
      if(key==='id'||key==='version'){delete attrs[key];continue;}
      if(key.startsWith('xmlns:')){delete attrs[key];continue;}
      if(!numeric.has(key)&&!other.has(key))throw new Error('unsupported');
      if(numeric.has(key)&&(!number.test(value)||!Number.isFinite(Number(value.replace(/px$/,'')))||Math.abs(Number(value.replace(/px$/,'')))>1_000_000))throw new Error('unsupported');
      if(['d','points','transform'].includes(key)){
        const values=value.match(/[-+]?(?:\d*\.\d+|\d+\.?\d*)(?:[eE][-+]?\d+)?/g)||[];
        if(values.length>50_000||values.some(n=>!Number.isFinite(Number(n))||Math.abs(Number(n))>1_000_000))throw new Error('unsupported');
      }
      if(key==='d'&&!/^[MmLlHhVvCcSsQqTtAaZz0-9eE+.,\s-]*$/.test(value))throw new Error('unsupported');
      if(key==='points'&&!/^[0-9eE+.,\s-]+$/.test(value))throw new Error('unsupported');
      if(key==='transform'&&!/^(?:(?:matrix|translate|scale|rotate|skewX|skewY)\s*\([0-9eE+.,\s-]+\)\s*)+$/.test(value))throw new Error('unsupported');
      if(key==='xmlns'&&value!=='http://www.w3.org/2000/svg')throw new Error('unsupported');
      if(['opacity','fill-opacity','stroke-opacity'].includes(key)&&(!number.test(value)||Number(value)<=0||Number(value)>1))throw new Error('unsupported');
      if(key==='fill-rule'&&!['evenodd','nonzero'].includes(value))throw new Error('unsupported');
      if(key==='stroke-linecap'&&!['butt','round','square'].includes(value))throw new Error('unsupported');
      if(key==='stroke-linejoin'&&!['miter','round','bevel'].includes(value))throw new Error('unsupported');
    }
    const parent=stack.at(-1);const fill=paint(attrs.fill??parent?.fill??'#000000');const stroke=paint(attrs.stroke??parent?.stroke??'none');
    if(name==='svg'){
      const v=attrs.viewBox?.trim().split(/[\s,]+/).map(Number);if(!v||v.length!==4||v.some(n=>!Number.isFinite(n))||v[2]<=0||v[3]<=0||v.some(n=>Math.abs(n)>100_000))throw new Error('unsupported');box=v as IconVector['viewBox'];
      // Root paint/opacity/transform are retained in a group instead of a nested SVG viewport.
      delete attrs.viewBox;delete attrs.width;delete attrs.height;delete attrs.xmlns;
    }else if(name!=='g'){
      shapes++;if(fill!=='none')colors.add(fill);if(stroke!=='none')colors.add(stroke);
    }
    if(attrs.fill)attrs.fill=fill==='none'?'none':'#ffffff';if(attrs.stroke)attrs.stroke=stroke==='none'?'none':'#ffffff';
    if(name==='svg'&&!attrs.fill)attrs.fill='#ffffff';
    const actual=name==='svg'?'g':name;output.push(`<${actual}${Object.entries(attrs).map(([k,v])=>` ${k}="${v}"`).join('')}${self?'/':''}>`);
    if(!self)stack.push({tag:name,fill,stroke});
    if(name==='svg'&&self)throw new Error('unsupported');
  }
  if(svg.slice(cursor).trim()||stack.length||roots!==1||!box||!shapes||colors.size!==1)throw new Error('unsupported');
  // The root opening SVG became a group; close it after the preserved subpaths.
  output.push('</g>');return {body:output.join(''),viewBox:box,color:[...colors][0]};
}
export function processedIconSvg(vector:IconVector,shape:'circle'|'square',background:string):Buffer {
  if(!/^#[0-9a-f]{6}$/i.test(background))throw new Error('unsupported');
  const [x,y,w,h]=vector.viewBox;const scale=720/Math.max(w,h);const tx=(1024-w*scale)/2-x*scale,ty=(1024-h*scale)/2-y*scale;
  const base=shape==='circle'?`<circle cx="512" cy="512" r="512" fill="${background}"/>`:`<rect width="1024" height="1024" fill="${background}"/>`;
  return Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="1024" height="1024" viewBox="0 0 1024 1024"><title>가공 아이콘 · 공식 제공 파일 아님</title>${base}<g transform="translate(${tx} ${ty}) scale(${scale})">${vector.body}</g></svg>`);
}
