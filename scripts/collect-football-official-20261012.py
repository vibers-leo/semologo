"""Collect actual official Premier League vectors and render transparent derivatives for review."""
from pathlib import Path
import json,subprocess,concurrent.futures,hashlib,re,io
import cairosvg
from PIL import Image,ImageDraw
R=Path(__file__).resolve().parents[1];D=R/'marketing/assets/sports-expansion-20261012';teams=[{'code':t['id'],'name':t['name'],'source_url':'https://resources.premierleague.com/premierleague/badges/t'+t['id']+'.svg'} for t in json.loads((D/'pl-teams.json').read_text())['data']];assert len(teams)==20

def collect(t):
 code=t['code'];name=t['name'];url=t['source_url'];assert url.startswith('https://resources.premierleague.com/premierleague/badges/');p=D/'pl'/code;p.mkdir(parents=True,exist_ok=True);svg=p/'original.svg';subprocess.run(['curl','--http1.1','-fsSL','--retry','2','--max-time','30',url,'-o',str(svg)],check=True);raw=svg.read_bytes();assert b'<svg' in raw;
 if re.search(rb'<image\b|data:image|<script',raw,re.I):return {'code':code,'name':name,'source_url':url,'rejected':'raster embedded or executable content'}
 cairosvg.svg2png(bytestring=raw,write_to=str(p/'logo.png'),output_width=2000);im=Image.open(p/'logo.png').convert('RGBA');assert im.getbbox();im.thumbnail((640,640));im.save(p/'preview.png');return {'code':code,'name':name,'source_url':url,'sha256':hashlib.sha256(raw).hexdigest()}
with concurrent.futures.ThreadPoolExecutor(max_workers=4)as pool:rows=list(pool.map(collect,teams))
(D/'pl-rejected.json').write_text(json.dumps([x for x in rows if x.get('rejected')],indent=2)+'\n');rows=[x for x in rows if not x.get('rejected')]
(D/'pl-downloads.json').write_text(json.dumps(rows,ensure_ascii=False,indent=2)+'\n')
for n in range(2):
 sheet=Image.new('RGB',(1200,960),'#eee');draw=ImageDraw.Draw(sheet)
 for i,t in enumerate(rows[n*16:(n+1)*16]):
  im=Image.open(D/'pl'/t['code']/'preview.png').convert('RGBA');im.thumbnail((250,190));x=(i%4)*300;y=(i//4)*240;sheet.paste(im,(x+(300-im.width)//2,y+35),im);draw.text((x+8,y+8),t['name'],fill='black')
 sheet.save(D/f'pl-review-{n+1}.jpg')
print('COLLECTED',len(rows),'official SVG + 2000px PNG; awaiting visual and identity review')
