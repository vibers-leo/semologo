"""Build release from visually reviewed original-path SVGs, no network or publishing."""
from pathlib import Path
import json,hashlib,zipfile,datetime
from PIL import Image
from lxml import etree as E
R=Path(__file__).resolve().parents[1];O=R/'marketing/assets/png-recollection-reviewed-20261010'
rows=json.loads((O/'review-candidates.json').read_text())
chosen={'1764':[0,1,2],'1763':[0,1],'1758':[0,1],'1756':[0,1,2,3],'1766':[0,1,2],'1765':[0],'1748':[0],'1717':[0],'1710':[0,1,2,3],'1700':[0],'1699':[0],'1696':[1],'1688':[0,1],'1678':[0],'1667':[0],'1652':[0,1,3],'1648':[0,2],'1629':[0]}
selected=[x for x in rows if x['candidate'] in chosen.get(x['id'].replace('gongu-ci-',''),[])]
for i,s in enumerate(['','_white']):selected.append({'id':'fukui-seisakusho','name_ko':'후쿠이제작소','candidate':i,'source_page':'https://www.fkis.co.jp/','source_url':'https://www.fkis.co.jp/img/FUKUI_LOGO_20160315_1_olCC'+s+'.svg','original':str((O/'fukui-seisakusho'/('original'+s+'.svg')).relative_to(R)),'svg':str((O/'fukui-seisakusho'/('original'+s+'.svg')).relative_to(R)),'png':str((O/'fukui-seisakusho'/('original'+s+'.png')).relative_to(R))})
uploads=[];manifests={};patches={}
def obj(b,p):
 h=hashlib.sha256(p.read_bytes()).hexdigest();rel=f'sources/official-recollection-20261010/{h[:20]}{p.suffix}';uploads.append({'id':b,'file':str(p.relative_to(R)),'key':f'_clients/{b}/{rel}','sha256':h});return rel
for x in selected:
 b=x['id'];svg=R/x['svg'];r=E.parse(str(svg)).getroot();assert not r.xpath('//*[local-name()="image" or local-name()="text" or local-name()="script"]')
 im=Image.open(R/x['png']).convert('RGBA');assert im.getbbox();im=im.crop(im.getbbox());p=O/b/f'reviewed-{x["candidate"]}.png';im.save(p)
 files={'svg':obj(b,svg),'png':obj(b,p)};key='official-'+str(x['candidate']);v=manifests.setdefault(b,{'schema':1,'algo_v':1,'id':b,'primary':key,'variants':[]})['variants']
 white=(b in ['gongu-ci-1763','gongu-ci-1758','gongu-ci-1652'] and x['candidate']==0 if b=='gongu-ci-1763' else b in ['gongu-ci-1758','gongu-ci-1652'] and x['candidate']==1) or (b=='gongu-ci-1756' and x['candidate']==0) or (b=='gongu-ci-1688' and x['candidate']==0) or (b=='fukui-seisakusho' and x['candidate']==1)
 v.append({'key':key,'label':'공식 로고 '+str(len(v)+1)+(' · 흰색' if white else ''),'form':'unknown','lockup':'unknown','lang':'unknown','color':'white' if white else 'original','files':files,'aspect':im.width/im.height,'origin':'official','provider':'공식 사이트 배포 SVG · 시각 검수','derived_from':x['source_url'],'order':len(v),'asset_group':'logotype'})
 x['checked_at']='2026-10-10';x['review']='verified-vector-identity';x['transparent_png']=str(p.relative_to(R))
for b,m in manifests.items():
 vs=m['variants'];primary=next((v for v in vs if v['color']!='white'),vs[0]);m['primary']=primary['key']
 zipf=O/b/'official-originals.zip'
 with zipfile.ZipFile(zipf,'w',zipfile.ZIP_DEFLATED) as z:
  for x in selected:
   if x['id']==b:z.write(R/x['original'],Path(x['original']).name)
  z.writestr('SOURCES.json',json.dumps([x for x in selected if x['id']==b],ensure_ascii=False,indent=2))
 original=obj(b,zipf);files=primary['files'];url='https://logo.vibers.co.kr/_clients/'+b+'/'+files['png']
 patches[b]={'has_svg':True,'has_png':True,'logo_svg':files['svg'],'svg_transparent':files['svg'],'logo_png':files['png'],'preview_png':url,'collected_originals_url':'https://logo.vibers.co.kr/_clients/'+b+'/'+original,'collected_originals_label':'수집 원본 묶음','variants_n':len(vs),'asset_review_status':'verified','asset_origin':'공식 사이트 SVG 원본 재수집','asset_checked_at':'2026-10-10','logo_published_at':'2026-10-10T09:00:00Z','light':False,'light_logo':False,'presentation':{'file':files['png'],'background':'light'},'rejected_asset_files':['logo-icon.png','logo-800.png','logo-transparent.png','logo-white.png']}
for b,key in [('gongu-ci-1766','official-2'),('gongu-ci-1710','official-3')]:
 m=manifests[b];m['primary']=key;v=next(v for v in m['variants'] if v['key']==key);f=v['files'];patches[b].update(logo_svg=f['svg'],svg_transparent=f['svg'],logo_png=f['png'],preview_png='https://logo.vibers.co.kr/_clients/'+b+'/'+f['png'],presentation={'file':f['png'],'background':'light'})
(O/'release.json').write_text(json.dumps({'schema':1,'reviewed':selected,'uploads':uploads,'patches':patches,'manifests':manifests},ensure_ascii=False,indent=2))
print(json.dumps({'brands':len(manifests),'vectors':len(selected),'transparent_pngs':len(selected),'original_zips':len(manifests),'objects':len(uploads)}))
