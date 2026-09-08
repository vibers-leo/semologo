"""Stage reviewed vector imports and explicit manifests without replacing existing primary logos."""
import json,re,hashlib,sys,copy
from pathlib import Path
from lxml import etree as E
from PIL import Image,ImageStat
ROOT=Path(__file__).resolve().parents[1]
ASSETS=ROOT/'artifacts/logo-collection-20260908'
CLIENTS=Path('/Volumes/Untitled/brand-logos/_clients')
sys.path.insert(0,str(CLIENTS.parent/'scripts'))
import safesvg

def main():
 out=ASSETS/'publish';out.mkdir(exist_ok=True)
 cat=json.loads((CLIENTS/'brands.json').read_text());by={x['id']:x for x in cat['brands']}
 generic=set('access email epub h-card h-entry h-feed language-icon lock mail microformats phone print vegetarian webmention jsonfeed sparql'.split())
 overrides={'atom':None,'r':None,'grafana_loki':None,'rockstar':'rockstargames','x':'x-twitter','upi':'unified-payments-interface','itunes_podcasts':'applepodcasts','google_plus':None,'ok':'odnoklassniki','outlook':'microsoft-outlook','vlc':'vlcmediaplayer','djangoproject':'django','expressjs':'express','drawio':'diagramsdotnet','tutanota':'tuta','uplay':'ubisoft','google_pay_old':'googlepay'}
 for a,b in [('google_calendar','googlecalendar'),('google_drive','googledrive'),('google_drive_old','googledrive'),('google_maps','googlemaps'),('google_maps_old','googlemaps'),('google_meet','googlemeet'),('google_photos','googlephotos'),('google_play','googleplay'),('linux_mint','linuxmint'),('raspberry_pi','raspberrypi'),('semantic_web','semanticweb'),('unreal','unrealengine'),('wear_os','wearos')]:overrides[a]=b
 new_allowed=set('acast amberframework andotp apache_age briar coil coinpot delicious digidentity downpour ente_auth expressionengine filestash gatehub google_findhub guacamole hackernews homekit keepassdx keskonfai librespeed luckyframework nobara opencores parrotos plausible portronics samsung_internet sonarqube-community stitcher subscribestar svgomg thisamericanlife tox wekan workato x11'.split())
 def norm(s):return re.sub('[^a-z0-9]','',s.lower())
 allnames={norm(s) for x in by.values() for s in [x['id'],x.get('name_en') or '']}
 plan=[];held=[]
 for row in json.loads((ASSETS/'mapping-review.json').read_text()):
  stem=Path(row['file']).stem;id=None
  if stem in generic:held.append({'file':row['file'],'reason':'generic icon or standard, not a brand candidate'});continue
  if row['text']:held.append({'file':row['file'],'reason':'live text depends on fonts'});continue
  if stem in overrides:id=overrides[stem]
  elif len(row['candidates'])==1:id=row['candidates'][0]
  elif stem in new_allowed and norm(row['title']) not in allnames and norm(stem) not in allnames:id=stem.replace('_','-')
  if not id:held.append({'file':row['file'],'reason':'identity or canonical brand needs review'});continue
  if id in by and (by[id].get('hidden') or by[id].get('variant_of')):held.append({'file':row['file'],'reason':'existing hidden/merged record preserved'});continue
  if stem in overrides and id not in by:held.append({'file':row['file'],'reason':'canonical override missing'});continue
  plan.append(dict(id=id,name_en=row['title'],name_ko=row['title'],source='supertiny',file=row['file'],category='IT·테크',form='symbol'))
 for l in (ROOT/'data/collection/apparel-reviewed-map.txt').read_text().splitlines():
  f,id,ko,en=l.split('|');plan.append(dict(id=id,name_en=en,name_ko=ko,source='apparel',file=f+'.svg',category='뷰티·패션',form='unknown'))
 approved=[];updated={};manifests={};new_ids=[];duplicates=[]
 license_text=(ASSETS/'supertiny/LICENSE').read_text()
 for i,row in enumerate(plan):
  id=row['id'];src=ASSETS/row['source']/row['file'];raw=src.read_bytes();xml=E.fromstring(raw)
  assert not xml.xpath('//*[local-name()="script" or local-name()="image" or local-name()="foreignObject" or local-name()="text"]')
  for el in xml.iter():
   for k,v in el.attrib.items():
    assert not E.QName(k).localname.lower().startswith('on')
    if E.QName(k).localname in ('href','src'):assert v.startswith('#')
  assert b'@import' not in raw and b'data:image' not in raw
  target=out/id;target.mkdir(exist_ok=True)
  if id not in updated:
   updated[id]=copy.deepcopy(by.get(id) or dict(id=id,name_ko=row['name_ko'],name_en=row['name_en'],category=row['category'],folder='_clients/'+id,logo_svg='logo.svg',logo_png=True,has_svg=True,has_png=True,svg_source=row['source'],added_at='2026-09-08'))
   if id not in by:new_ids.append(id)
   old=CLIENTS/id/'variants.json'
   if old.exists():manifests[id]=json.loads(old.read_text())
   else:
    variants=[]
    if id in by:variants=[dict(key='original',form='unknown',lang='unknown',color='color',label='기존 로고',files={**({'svg':'logo.svg'} if by[id].get('has_svg') or by[id].get('logo_svg') else {}),**({'png':'logo.png'} if by[id].get('has_png') or by[id].get('logo_png') else {})},origin='collected',order=0)]
    manifests[id]=dict(schema=1,algo_v=1,id=id,primary='original' if variants else '',variants=variants)
  # An exact original match adds no useful downloadable variant.
  old=CLIENTS/id/'logo.svg'
  if old.exists() and old.read_bytes()==raw:duplicates.append(row);continue
  if row['source']=='supertiny':
   meta=E.SubElement(xml,'{http://www.w3.org/2000/svg}metadata');meta.text=license_text
   raw=E.tostring(xml,encoding='utf-8')
  rel=Path('sources')/('supertiny' if row['source']=='supertiny' else 'apparel-collection')/row['file']
  p=target/rel;p.parent.mkdir(parents=True,exist_ok=True)
  needs_render=not p.exists() or p.read_bytes()!=raw
  p.write_bytes(raw)
  try:
   if needs_render or not p.with_suffix('.png').exists():safesvg.render_to_file(raw,p.with_suffix('.png'),800,transparent=True)
  except Exception as e:held.append(dict(file=row['file'],reason='render failed: '+str(e)));p.unlink();continue
  im=Image.open(p.with_suffix('.png')).convert('RGBA');assert im.getchannel('A').getbbox()
  extrema=ImageStat.Stat(im.convert('RGB')).stddev
  if max(extrema)<1:held.append(dict(file=row['file'],reason='blank or solid-color render'));p.unlink();p.with_suffix('.png').unlink();continue
  aspect=im.width/im.height;form=row['form'] if row['source']=='supertiny' else ('horizontal' if aspect>1.3 else 'vertical' if aspect<.8 else 'symbol')
  key=row['source']+'-'+Path(row['file']).stem
  label='앱 아이콘 · SuperTinyIcons' if row['source']=='supertiny' else '의류 모음 수록본 · '+Path(row['file']).stem
  if '_old' in row['file']:label+=' (구형)'
  variant=dict(key=key,form=form,lang='unknown',color='color',label=label,files={'svg':str(rel),'png':str(rel.with_suffix('.png'))},aspect=round(aspect,4),provider=row['source'],origin='collected',order=100+len(manifests[id]['variants']))
  manifests[id]['variants']=[v for v in manifests[id]['variants'] if v['key']!=key]+[variant]
  if not manifests[id]['primary']:manifests[id]['primary']=key
  sources=updated[id].setdefault('sources',[])
  if not any(x.get('file')==str(rel) for x in sources):sources.append(dict(provider=row['source'],file=str(rel),label=label))
  if id in new_ids and not (target/'logo.svg').exists():
   (target/'logo.svg').write_bytes(raw);(target/'logo.png').write_bytes(p.with_suffix('.png').read_bytes());(target/'logo-800.png').write_bytes(p.with_suffix('.png').read_bytes())
  row.update(rel=str(rel),sha256=hashlib.sha256(raw).hexdigest());approved.append(row)
  if i%80==0:print('Rendered',i,'/',len(plan),flush=True)
 affected=sorted({r['id'] for r in approved});new_ids=[id for id in new_ids if id in affected]
 for id in affected:
  (out/id/'brand.json').write_text(json.dumps(updated[id],ensure_ascii=False,separators=(',',':')))
  (out/id/'variants.json').write_text(json.dumps(manifests[id],ensure_ascii=False,indent=1))
 report=dict(approved=approved,held=held,duplicates=duplicates,affected=affected,new_ids=new_ids,apparel_held=['opt','oodles','zooty','unidentified-scorpion'])
 (out/'report.json').write_text(json.dumps(report,ensure_ascii=False,indent=2))
 print(json.dumps(dict(approved=len(approved),held=len(held),affected=len(affected),new=len(new_ids),apparel=sum(r['source']=='apparel' for r in approved))))
if __name__=='__main__':main()
