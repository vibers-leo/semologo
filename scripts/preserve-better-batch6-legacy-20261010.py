"""Preserve public legacy manifests and dark-background original variants."""
from pathlib import Path
import json,copy
from PIL import Image,ImageDraw
ROOT=Path(__file__).resolve().parents[1]
OUT=ROOT/'marketing/assets/figma-better-batch6-20261010'
release=json.loads((OUT/'release.json').read_text())
prior=json.loads((OUT/'cdn-prior-variants.json').read_text())
dark={'northflank','pulte-homes','step-fintech','osedea','thrive-capital','tigerglobal','westcap'}
for id,manifest in release['variants'].items():
 previous=prior.get(id)
 if previous:
  own=[v for v in manifest['variants'] if v['key'].startswith('figma-better-')]
  kept=[v for v in manifest['variants'] if not v['key'].startswith('figma-better-')]
  for v in previous['variants']:
   matches=[n for n in kept if n['key']==v['key']]
   if matches:assert matches==[v],id+' conflicting legacy key'
   else:kept.append(copy.deepcopy(v))
  manifest['variants']=kept+own
  if manifest.get('primary') is None and previous.get('primary'):manifest['primary']=previous['primary']
  for v in previous['variants']:assert v in manifest['variants']
 for order,v in enumerate(manifest['variants']):
  if v['key'].startswith('figma-better-'):
   v['order']=order
   if id in dark and v['color']=='original':v['light']=True
 release['patches'][id]['variants_n']=len(manifest['variants'])
 patch=release['patches'][id]
 if 'id' in patch and id in dark:
  selected=next(v for v in manifest['variants'] if v['key']==manifest['primary'])
  patch['light']=patch['light_logo']=selected['light']
  patch['presentation']['bg']='dark' if selected['light'] else 'light'
(OUT/'release.json').write_text(json.dumps(release,ensure_ascii=False,indent=2)+'\n')
rows=json.loads((OUT/'approved-candidates.json').read_text())
for start in range(0,len(rows),30):
 sheet=Image.new('RGB',(1800,1080),'white')
 for j,row in enumerate(rows[start:start+30]):
  use_dark=row['color']=='white' or (row['id'] in dark and row['color']=='original')
  tile=Image.new('RGB',(360,180),'#222' if use_dark else '#ddd')
  im=Image.open(ROOT/row['preview']);im.thumbnail((340,130));tile.paste(im,((360-im.width)//2,12),im)
  ImageDraw.Draw(tile).text((6,150),row['id']+' '+row['color'],fill='white' if use_dark else 'black')
  sheet.paste(tile,(j%5*360,j//5*180))
 sheet.save(OUT/('approved-contact-'+str(start//30+1)+'.jpg'))
validation=json.loads((OUT/'validation.json').read_text()) if (OUT/'validation.json').exists() else {'visual_review':'pending final contact sheets','second_pass_validation':'running'}
validation['legacy_cdn_manifests_preserved']=sum(bool(v) for v in prior.values())
validation['mixed_originals_dark_background']=[id for id in sorted(dark) if id in release['variants']]
(OUT/'validation.json').write_text(json.dumps(validation,ensure_ascii=False,indent=2)+'\n')
print('Public legacy variants preserved; white wordmarks use dark backgrounds.')
