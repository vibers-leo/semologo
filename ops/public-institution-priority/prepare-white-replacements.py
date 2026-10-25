"""Find unchanged transparent first-party PNGs for human visual review."""
import concurrent.futures,hashlib,io,json,re
from html.parser import HTMLParser
from pathlib import Path
from urllib.parse import urljoin,urlsplit
import requests
from PIL import Image,ImageDraw,ImageFont
ROOT=Path(__file__).resolve().parents[2];OUT=ROOT/'ops/evidence/public-white-background-20261025'
sources=json.loads((ROOT/'ops/public-institution-priority/repair-sources.json').read_text())
targets=sources['targets'];sites=sources['sites']
import unicodedata
norm=lambda s:re.sub('[^가-힣a-z0-9]','',unicodedata.normalize('NFKC',s).lower().replace('주식회사','').replace('재단법인','').replace('(주)','').replace('(재)',''))
repaired_file=OUT/'repaired-current.json'
repaired={r['id'] for r in json.loads(repaired_file.read_text())} if repaired_file.exists() else set()
work=[]
for t in targets:
 if t['id'] in repaired:continue
 s=sites.get(norm(t['name']))
 if s:work.append({**t,'officialSite':s['homepage'],'officialCI':s['sourcePage']})
 if len(work)>=30:break
(OUT/'replacement-candidates').mkdir(exist_ok=True)
class Logos(HTMLParser):
 def __init__(self):super().__init__();self.images=[]
 def handle_starttag(self,t,a):
  d=dict(a);src=d.get('src','');alt=d.get('alt','')
  if t=='img' and ('logo' in (src+' '+d.get('class','')).lower() or '로고' in alt):self.images.append((src,alt))
def fetch(t):
 result={**t,'candidates':[]}
 try:
  site=t['officialSite'].replace('http://','https://',1)
  r=requests.get(site,timeout=18,headers={'User-Agent':'Mozilla/5.0'});r.raise_for_status();p=Logos();p.feed(r.text)
  seen=set()
  for src,alt in p.images[:8]:
   url=urljoin(r.url,src)
   if url in seen or not url.startswith('https://'):continue
   seen.add(url)
   if urlsplit(url).hostname.removeprefix('www.')!=urlsplit(r.url).hostname.removeprefix('www.'):continue
   try:
    a=requests.get(url,timeout=12,headers={'User-Agent':'Mozilla/5.0'});a.raise_for_status();raw=a.content
    if len(raw)>2_000_000:continue
    im=Image.open(io.BytesIO(raw));im.load()
    if im.format!='PNG' or im.width<100 or im.height<20:continue
    rgba=im.convert('RGBA');alpha=rgba.getchannel('A')
    if alpha.getextrema()[0]!=0 or not alpha.getbbox():continue
    sha=hashlib.sha256(raw).hexdigest();path=OUT/'replacement-candidates'/(t['id']+'-'+sha[:10]+'.png');path.write_bytes(raw)
    result['candidates'].append({'sourcePage':r.url,'sourceUrl':url,'file':str(path.relative_to(ROOT)),
      'sha256':sha,'width':im.width,'height':im.height,'alt':alt})
    if len(result['candidates'])==2:break
   except Exception:continue
 except Exception as e:result['error']=str(e)[:150]
 return result
with concurrent.futures.ThreadPoolExecutor(max_workers=4) as pool:results=list(pool.map(fetch,work))
(OUT/'replacement-candidates.json').write_text(json.dumps(results,ensure_ascii=False,indent=2))
tiles=[(r,c) for r in results for c in r['candidates']]
font=ImageFont.truetype('/System/Library/Fonts/AppleSDGothicNeo.ttc',15)
for page in range((len(tiles)+19)//20):
 batch=tiles[page*20:(page+1)*20];sheet=Image.new('RGB',(1000,((len(batch)+1)//2)*125),'#eeeeee');draw=ImageDraw.Draw(sheet)
 for n,(t,c) in enumerate(batch):
  x=(n%2)*500;y=(n//2)*125;draw.text((x+8,y+4),t['id']+' '+t['name'],font=font,fill='black')
  im=Image.open(ROOT/c['file']).convert('RGBA');im.thumbnail((450,72));sheet.paste(im,(x+20,y+33),im)
 sheet.save(OUT/('replacement-sheet-'+str(page+1)+'.png'))
print(json.dumps({'sites':len(results),'withTransparentPng':sum(bool(r['candidates']) for r in results),'candidates':len(tiles)},ensure_ascii=False))
