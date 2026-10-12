"""Collect MLB official team vectors plus official KBO/NPB source pages; never publish unreviewed art."""
from pathlib import Path
import json,subprocess,concurrent.futures,hashlib,datetime,xml.etree.ElementTree as E
import cairosvg
from PIL import Image,ImageDraw
R=Path(__file__).resolve().parents[1];D=R/'marketing/assets/baseball-official-20261012';D.mkdir(exist_ok=True)
T=Path('/Volumes/HDD-1TB/semologo-migration/task-tmp');teams=json.loads((T/'mlb-teams.json').read_text())['teams'];assert len(teams)==30
(D/'mlb-roster-original.json').write_bytes((T/'mlb-teams.json').read_bytes())
def task(t):
 url=f'https://www.mlbstatic.com/team-logos/{t["id"]}.svg';p=D/'mlb'/str(t['id']);p.mkdir(parents=True,exist_ok=True);r=subprocess.run(['curl','-fsSL','--max-time','35',url],capture_output=True,check=True);raw=r.stdout;root=E.fromstring(raw)
 assert root.tag.split('}')[-1]=='svg';assert not any(e.tag.split('}')[-1] in ['image','script','foreignObject'] for e in root.iter());assert not any(v.startswith(('http:','https:','javascript:')) for e in root.iter() for k,v in e.attrib.items() if k.endswith('href'))
 (p/'original.svg').write_bytes(raw);cairosvg.svg2png(bytestring=raw,write_to=str(p/'logo.png'),output_width=2000);im=Image.open(p/'logo.png');assert im.mode=='RGBA' and im.getextrema()[3][0]==0
 im.thumbnail((640,640));im.save(p/'preview.png');return {'official_id':t['id'],'name':t['name'],'source_url':url,'svg_sha256':hashlib.sha256(raw).hexdigest(),'png_dimensions':Image.open(p/'logo.png').size,'status':'downloaded-vector-needs-visual-review'}
rows=[]
with concurrent.futures.ThreadPoolExecutor(max_workers=4) as pool:
 for row in pool.map(task,teams):rows.append(row);print('downloaded',len(rows),row['name'],flush=True)
(D/'downloaded.json').write_text(json.dumps(rows,indent=2)+'\n')
for start in range(0,30,15):
 sheet=Image.new('RGB',(1250,850),'#e5e5e5');draw=ImageDraw.Draw(sheet)
 for i,r in enumerate(rows[start:start+15]):
  x=(i%5)*250;y=(i//5)*280;im=Image.open(D/'mlb'/str(r['official_id'])/'logo.png');im.thumbnail((210,210));sheet.paste(im,(x+(250-im.width)//2,y+30),im);draw.text((x+5,y+5),str(r['official_id'])+' '+r['name'],fill='black')
 sheet.save(D/f'mlb-review-{start//15+1}.jpg')
print('READY 30 official vectors and transparent PNGs')
