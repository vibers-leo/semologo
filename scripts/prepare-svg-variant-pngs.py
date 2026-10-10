"""Prepare immutable PNG companions; review release.json before publishing.
SVG canvas/white artwork is preserved. Never removes white pixels automatically.
"""
import argparse, hashlib, json, re, subprocess
from pathlib import Path
import cairosvg
from PIL import Image
ROOT=Path(__file__).resolve().parents[1]
p=argparse.ArgumentParser();p.add_argument('--manifest',type=Path,required=True);p.add_argument('--release-dir',type=Path,required=True);p.add_argument('--rerender-existing',action='store_true');a=p.parse_args()
out=a.release_dir.resolve();assert out.is_relative_to(ROOT/'marketing/assets');out.mkdir(exist_ok=True)
m=json.loads(a.manifest.read_text());brand=m['id'];assert re.fullmatch(r'[A-Za-z0-9_-]+',brand)
u=[]
for v in m['variants']:
 files=v['files']
 if not files.get('svg') or (files.get('png') and not a.rerender_existing):continue
 rel=files['svg'];assert '..' not in rel.split('/') and re.fullmatch(r'[A-Za-z0-9_./-]+',rel)
 raw=subprocess.check_output(['curl','-fsSL','--max-time','30',f'https://logo.vibers.co.kr/_clients/{brand}/{rel}']);assert len(raw)<10_000_000
 # Render only self-contained vector assets; external resources need manual review.
 assert not re.search(rb'<(?:\w+:)?(?:image|script|foreignObject)\b',raw,re.I)
 assert not re.search(rb'(?:href\s*=\s*["\'](?!#)|url\(\s*["\']?(?:https?:|file:)|<!ENTITY)',raw,re.I)
 key=hashlib.sha256(raw).hexdigest()[:16];svg=out/(key+'.svg');svg.write_bytes(raw)
 png=out/(key+'.png');cairosvg.svg2png(bytestring=raw,write_to=str(png),output_width=1600)
 im=Image.open(png).convert('RGBA');assert im.getbbox();assert max(im.size)<=10000
 digest=hashlib.sha256(png.read_bytes()).hexdigest();dest=f'sources/{out.name}/{digest[:16]}.png';files['png']=dest
 u.append({'id':brand,'file':str(png.relative_to(ROOT)),'key':f'_clients/{brand}/{dest}','sha256':digest})
release={'patches':{brand:{'has_png':True}},'variants':{brand:m}}
(out/'release.json').write_text(json.dumps(release,ensure_ascii=False,indent=2)+'\n');(out/'uploads.json').write_text(json.dumps(u,indent=2)+'\n');print(f'Prepared {len(u)} PNG companions for {brand}')
