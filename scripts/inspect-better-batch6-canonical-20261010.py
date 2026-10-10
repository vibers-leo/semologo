"""Read-only canonical logo comparisons; failed sources stay held."""
from pathlib import Path
from PIL import Image,ImageDraw
import json,subprocess,io,concurrent.futures
ROOT=Path(__file__).resolve().parents[1];OUT=ROOT/'marketing/assets/figma-better-batch6-20261010';rows=json.loads((OUT/'cms-candidates.json').read_text());folder=OUT/'canonical';folder.mkdir(exist_ok=True)
def work(row):
 id=row['id'];p=row['payload'];urls=[]
 for value in [p.get('preview_png'),p.get('logo_png'),'logo.png']:
  if isinstance(value,str):urls.append(value if value.startswith('https:') else 'https://logo.vibers.co.kr/_clients/'+id+'/'+value)
 for url in dict.fromkeys(urls):
  try:
   raw=subprocess.run(['curl','--fail','--silent','--max-time','15',url],capture_output=True,check=True).stdout;im=Image.open(io.BytesIO(raw));im.load();assert im.width>5;im.convert('RGBA').save(folder/(id+'.png'));return {'id':id,'url':url,'size':im.size,'verified':True}
  except Exception:pass
 return {'id':id,'verified':False}
with concurrent.futures.ThreadPoolExecutor(max_workers=6) as pool:proof=list(pool.map(work,rows))
for start in range(0,len(proof),30):
 sheet=Image.new('RGB',(1800,1080),'#ddd');d=ImageDraw.Draw(sheet)
 for j,r in enumerate(proof[start:start+30]):
  x=j%5*360;y=j//5*180;d.text((x+8,y+151),r['id'],fill='black')
  if r['verified']:
   im=Image.open(folder/(r['id']+'.png'));im.thumbnail((340,135));sheet.paste(im,(x+10,y+10),im)
 sheet.save(OUT/('canonical-contact-'+str(start//30+1)+'.jpg'))
(OUT/'canonical-proof.json').write_text(json.dumps(proof,indent=2));print('Canonical PNG verified',sum(r['verified'] for r in proof),'/',len(proof))
