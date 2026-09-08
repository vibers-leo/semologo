"""Stage current upstream Lobe Icons/SVGL vectors, with conservative identity matching.
Never writes the production catalog. Review report before publish-ai-svg.py.
"""
import json,re,sys,hashlib,subprocess,unicodedata
from pathlib import Path
from urllib.parse import urlparse,unquote
from collections import defaultdict
from lxml import etree as E
from PIL import Image,ImageDraw,ImageChops
ROOT=Path(__file__).resolve().parents[1]; WORK=ROOT/'artifacts/ai-svg-collection'; C=Path('/Volumes/Untitled/brand-logos/_clients')
sys.path.insert(0,str(C.parent/'scripts'));import safesvg
N=lambda s:re.sub(r'[^a-z0-9가-힣]','',unicodedata.normalize('NFC',str(s or '')).lower())
def sha(b):return hashlib.sha256(b).hexdigest()
def main():
 brands=json.loads((C/'brands.json').read_text())['brands']; bm={b['id']:b for b in brands}; names=defaultdict(set)
 for b in brands:
  for n in [b['id'],b.get('name_en'),b.get('name_ko')]+b.get('aliases',[]):
   if N(n):names[N(n)].add(b['id'])
 overrides=json.loads((ROOT/'data/collection/ai-svg-identities.json').read_text()) if (ROOT/'data/collection/ai-svg-identities.json').exists() else {}
 rows=[];held=[];dupes=[]
 def add(provider,key,title,url,f,kind,aliases=()):
  token=provider+':'+key
  matches=set().union(*(names.get(N(s),set()) for s in [key,title,*aliases]))
  matches={bm[x].get('variant_of') or x for x in matches}
  override=overrides.get(token,'AUTO')
  if override is None:held.append(dict(provider=provider,key=key,reason='identity/current status held by review'));return
  if override!='AUTO':bid=override
  elif len(matches)>1:held.append(dict(provider=provider,key=key,title=title,candidates=sorted(matches),reason='ambiguous identity'));return
  elif matches:bid=next(iter(matches))
  else:bid=re.sub('[^a-z0-9]+','-',key.lower()).strip('-')
  if not bid or (bid in bm and bm[bid].get('hidden')):held.append(dict(provider=provider,key=key,reason='hidden or invalid identity'));return
  rows.append(dict(provider=provider,key=key,id=bid,title=title,website=url,file=str(f.relative_to(WORK)),form=kind,is_new=bid not in bm))
 # Generic platform companies are supplied by SVGL; this source is the AI-focused pass.
 non_ai=set('Adobe Alibaba AlibabaCloud AntGroup Apple Aws Azure Baidu BaiduCloud Bilibili Bing Brave ByteDance CapCut Cloudflare Figma Github Google GoogleCloud Huawei HuaweiCloud IBM LG Meta Microsoft Notion Nvidia Obsidian Qiniu RSSHub Railway Snowflake Tencent TencentCloud Vercel Volcengine Yandex Zapier Zeabur'.split())
 for x in json.loads((WORK/'lobe-icons/src/toc.json').read_text()):
  if x['id'] in non_ai:continue
  prefix=x['id'].lower(); d=WORK/'lobe-icons/packages/static-svg/icons'
  f=d/(prefix+'-color.svg');f=f if f.exists() else d/(prefix+'.svg')
  if f.exists():add('lobe',prefix,x['title'],x['desc'],f,'symbol',[x['fullTitle']])
  t=d/(prefix+'-text.svg')
  if t.exists():add('lobe',prefix,x['title'],x['desc'],t,'wordmark',[x['fullTitle']])
 for x in json.loads((WORK/'svgl-catalog.json').read_text()):
  key=re.sub('[^a-z0-9]+','-',x['title'].lower()).strip('-')
  for typ in ['route','wordmark']:
   u=x.get(typ)
   if not u:continue
   if isinstance(u,dict):u=u.get('light')
   if not u:continue
   f=WORK/'svgl/static'/unquote(urlparse(u).path).lstrip('/')
   if not f.exists():held.append(dict(provider='svgl',key=key,reason='file absent in pinned upstream'));continue
   if re.search(r'(?:old|legacy|deprecated)',f.stem,re.I):held.append(dict(provider='svgl',key=key,reason='legacy filename'));continue
   add('svgl',key,x['title'],x.get('url',''),f,'wordmark' if typ=='wordmark' else 'unknown')
 # Resolve same-name new candidates across providers to the same canonical id.
 newnames={}
 for r in rows:
  if r['is_new']:
   n=N(r['title']);r['id']=newnames.setdefault(n,r['id'])
 out=WORK/'stage';out.mkdir(exist_ok=True);approved=[];known=defaultdict(set)
 for i,r in enumerate(rows):
  try:
   raw=(WORK/r['file']).read_bytes();xml=E.fromstring(raw,E.XMLParser(resolve_entities=False,no_network=True))
   assert not xml.xpath('//*[local-name()="script" or local-name()="image" or local-name()="foreignObject" or local-name()="text"]'),'non-vector/active/font dependent'
   assert b'<!ENTITY' not in raw and b'@import' not in raw and b'data:image' not in raw
   for el in xml.iter():
    if not isinstance(el.tag,str):continue
    for k,v in el.attrib.items():
     assert not E.QName(k).localname.lower().startswith('on')
     if E.QName(k).localname in ['href','src']:assert v.startswith('#')
     for u in re.findall(r'url\((.*?)\)',v):assert u.strip(' \"\'').startswith('#')
   # Static mono exports use CSS currentColor; black is the explicit default.
   raw=raw.replace(b'currentColor',b'#000000');xml=E.fromstring(raw)
   svgkey=sha(raw)
   if svgkey in known[r['id']]:dupes.append(dict(**r,reason='identical upstream SVG'));continue
   known[r['id']].add(svgkey)
   p=out/r['id']/'sources'/r['provider']/Path(r['file']).name;p.parent.mkdir(parents=True,exist_ok=True)
   # Maintain upstream copyright in every independently downloaded SVG.
   license=(WORK/('lobe-icons' if r['provider']=='lobe' else 'svgl')/'LICENSE').read_text()
   E.SubElement(xml,'{http://www.w3.org/2000/svg}metadata').text=license
   raw=E.tostring(xml,encoding='utf-8');p.write_bytes(raw)
   if not p.with_suffix('.png').exists():safesvg.render_to_file(raw,p.with_suffix('.png'),800,transparent=True)
   im=Image.open(p.with_suffix('.png')).convert('RGBA');a=im.getchannel('A');box=a.getbbox();assert box,'blank'
   visible=Image.new('RGBA',im.size,'white');visible.alpha_composite(im)
   assert ImageChops.difference(visible.convert('RGB'),Image.new('RGB',im.size,'white')).getbbox(),'white on white'
   # Raster-normalized comparison also catches different SVG serializations of an existing logo.
   thumb=im.crop(box);thumb.thumbnail((160,160));canvas=Image.new('RGBA',(164,164));canvas.alpha_composite(thumb,((164-thumb.width)//2,(164-thumb.height)//2))
   visual=sha(canvas.tobytes());r.update(rel=str(p.relative_to(out/r['id'])),sha256=sha(raw),visual_sha256=visual,aspect=round(im.width/im.height,4))
   if r['form']=='unknown':r['form']='horizontal' if im.width/im.height>1.4 else 'symbol'
   approved.append(r)
  except Exception as e:held.append(dict(**r,reason='SVG validation/render: '+str(e)))
  if i%150==0:print('validated',i,'/',len(rows),flush=True)
 # Exact visual dedup within import batch and against existing downloadable variants.
 final=[];seen=defaultdict(set)
 for r in approved:
  h=r['visual_sha256']
  if h in seen[r['id']]:dupes.append(dict(**r,reason='same rendered artwork'));continue
  seen[r['id']].add(h);final.append(r)
 report={'upstreams':{p:subprocess.check_output(['git','-C',str(WORK/p),'rev-parse','HEAD'],text=True).strip() for p in ['lobe-icons','svgl']},'approved':final,'held':held,'duplicates':dupes,'new_ids':sorted({r['id'] for r in final if r['is_new']})}
 (WORK/'review.json').write_text(json.dumps(report,ensure_ascii=False,indent=2))
 for start in range(0,len(final),100):
  batch=final[start:start+100];sheet=Image.new('RGB',(1500,((len(batch)+9)//10)*115),'#e8e8e8');draw=ImageDraw.Draw(sheet)
  for j,r in enumerate(batch):
   im=Image.open((out/r['id']/r['rel']).with_suffix('.png')).convert('RGBA');im.thumbnail((135,80));x=j%10*150;y=j//10*115
   sheet.paste(im,(x+(150-im.width)//2,y+(83-im.height)//2),im);draw.text((x+3,y+85),str(start+j)+' '+r['id'][:20],fill='black');draw.text((x+3,y+100),r['provider']+' '+r['form'],fill='black')
  sheet.save(WORK/f'review-{start//100}.jpg')
 print(json.dumps({k:len(v) for k,v in report.items() if k!='upstreams'}))
if __name__=='__main__':main()
