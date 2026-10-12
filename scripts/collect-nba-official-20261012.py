"""Collect actual official NBA vectors and render transparent derivatives for review."""
from pathlib import Path
import json,subprocess,concurrent.futures,hashlib,re,io
import cairosvg
from PIL import Image,ImageDraw
R=Path(__file__).resolve().parents[1];D=R/'marketing/assets/sports-expansion-20261012';teams=json.loads((D/'nba-roster.json').read_text());assert len(teams)==30

def collect(t):
 code=t['code'];name=t['name'];url=t['source_url'];assert url.startswith('https://cdn.nba.com/logos/nba/');p=D/'nba'/code;p.mkdir(parents=True,exist_ok=True);svg=p/'original.svg';subprocess.run(['curl','--http1.1','-fsSL','--retry','2','--max-time','30',url,'-o',str(svg)],check=True);raw=svg.read_bytes();assert b'<svg' in raw and not re.search(rb'<image\b|data:image|<script',raw,re.I);cairosvg.svg2png(bytestring=raw,write_to=str(p/'logo.png'),output_width=2000);im=Image.open(p/'logo.png').convert('RGBA');assert im.getbbox();im.thumbnail((640,640));im.save(p/'preview.png');return {'code':code,'name':name,'source_url':url,'sha256':hashlib.sha256(raw).hexdigest()}
with concurrent.futures.ThreadPoolExecutor(max_workers=4)as pool:rows=list(pool.map(collect,teams))
(D/'nba-downloads.json').write_text(json.dumps(rows,ensure_ascii=False,indent=2)+'\n')
for n in range(2):
 sheet=Image.new('RGB',(1200,960),'#eee');draw=ImageDraw.Draw(sheet)
 for i,t in enumerate(rows[n*16:(n+1)*16]):
  im=Image.open(D/'nba'/t['code']/'preview.png').convert('RGBA');im.thumbnail((250,190));x=(i%4)*300;y=(i//4)*240;sheet.paste(im,(x+(300-im.width)//2,y+35),im);draw.text((x+8,y+8),t['name'],fill='black')
 sheet.save(D/f'nba-review-{n+1}.jpg')
print('COLLECTED',len(rows),'official SVG + 2000px PNG; awaiting visual and identity review')
