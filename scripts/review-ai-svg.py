"""Create conservative publication subset; collected-only items remain reviewable."""
import json,sys,hashlib
from pathlib import Path
from collections import defaultdict
from urllib.parse import urlparse
from PIL import Image,ImageDraw
ROOT=Path(__file__).resolve().parents[1];W=ROOT/'artifacts/ai-svg-collection';C=Path('/Volumes/Untitled/brand-logos/_clients')
def fingerprint(p):
 im=Image.open(p).convert('RGBA');box=im.getchannel('A').getbbox()
 if not box:return ''
 im=im.crop(box);im.thumbnail((160,160));c=Image.new('RGBA',(164,164));c.alpha_composite(im,((164-im.width)//2,(164-im.height)//2));return hashlib.sha256(c.tobytes()).hexdigest()
def main():
 r=json.loads((W/'review.json').read_text());b={x['id']:x for x in json.loads((C/'brands.json').read_text())['brands']};ok=[];held=list(r['held']);dup=list(r['duplicates']);seen=defaultdict(set)
 holds=json.loads((ROOT/'data/collection/ai-svg-quality-holds.json').read_text())
 for x in r['approved']:
  reason=holds.get(x['provider']+':'+x['key'])
  if reason:held.append(dict(**x,reason=reason));continue
  bid=x['id'];vpath=C/bid/'variants.json';v=json.loads(vpath.read_text()) if vpath.exists() else {'variants':[]}
  # Existing SVGL assets are useful only when adding a missing form. Main logos are not overwritten.
  if not x['is_new'] and x['provider']=='svgl' and any(a.get('form')==x['form'] for a in v['variants']):
   dup.append(dict(**x,reason='existing catalog already offers this form; no extra SVGL copy'));continue
  if not x['is_new']:
   host=lambda u:urlparse(u if '://' in u else 'https://'+u).hostname or ''
   oldhost=host(b[bid].get('domain') or b[bid].get('website') or '')
   newhost=host(x['website'])
   # Name collisions with unrelated existing businesses are held, not merged.
   if oldhost and newhost and oldhost.removeprefix('www.')!=newhost.removeprefix('www.'):
    held.append(dict(**x,reason='existing brand domain differs',existing_domain=oldhost));continue
  for p in [C/bid/'logo.png']+[C/bid/a.get('files',{}).get('png','__missing') for a in v['variants']]:
   if p.exists() and p.is_file():
    try:seen[bid].add(fingerprint(p))
    except Exception:pass
  if x['visual_sha256'] in seen[bid]:dup.append(dict(**x,reason='same pixels as existing or accepted variant'));continue
  seen[bid].add(x['visual_sha256']);ok.append(x)
 r.update(approved=ok,held=held,duplicates=dup,new_ids=sorted({x['id'] for x in ok if x['is_new']}))
 (W/'publish-review.json').write_text(json.dumps(r,ensure_ascii=False,indent=2))
 for start in range(0,len(ok),100):
  batch=ok[start:start+100];sheet=Image.new('RGB',(1500,((len(batch)+9)//10)*120),'#e5e5e5');d=ImageDraw.Draw(sheet)
  for j,x in enumerate(batch):
   im=Image.open((W/'stage'/x['id']/x['rel']).with_suffix('.png')).convert('RGBA');im.thumbnail((135,80));a=j%10*150;c=j//10*120
   sheet.paste(im,(a+(150-im.width)//2,c+(83-im.height)//2),im);d.text((a+3,c+86),str(start+j)+' '+x['id'][:21],fill='black');d.text((a+3,c+101),x['provider']+' '+x['form'],fill='black')
  sheet.save(W/f'publish-{start//100}.jpg')
 print({k:len(r[k]) for k in ['approved','held','duplicates','new_ids']})
if __name__=='__main__':main()
