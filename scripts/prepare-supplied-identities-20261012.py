"""Extract reviewed supplied AI artwork without tracing or raster wrapping."""
from pathlib import Path
import copy, hashlib, json, re, shutil, unicodedata, zipfile
import fitz, cairosvg
from PIL import Image, ImageDraw
from lxml import etree as E

R=Path(__file__).resolve().parents[1]
D=R/'marketing/assets/supplied-identities-20261012'
Z=R/'marketing/assets/zigzag-supplied-20261012'
downloads=Path('/Users/juuuno/Downloads')
supplied={unicodedata.normalize('NFC',p.name):p for p in downloads.iterdir()}
old={r['id']:r for r in json.loads((D/'cms-before.json').read_text())}
old.update({r['id']:r for r in json.loads((Z/'cms-before.json').read_text())})
release={'patches':{},'variants':{}}
uploads=[];tiles=[]

def stage(bid,path):
 if not path.is_relative_to(R):
  target=D/(bid+'-original'+path.suffix.lower());shutil.copy2(path,target);path=target
 raw=path.read_bytes();sha=hashlib.sha256(raw).hexdigest()
 rel='sources/supplied-identities-20261012/'+sha[:20]+path.suffix.lower()
 item=dict(id=bid,key='_clients/'+bid+'/'+rel,file=str(path.relative_to(R)),sha256=sha)
 if not any(u['key']==item['key'] for u in uploads):uploads.append(item)
 return rel

def extract(bid,key,label,path,page_no,box,form='horizontal',color='color'):
 doc=fitz.open(path);page=doc[page_no]
 assert not page.get_images(), 'Raster images present in AI'
 root=E.fromstring(page.get_svg_image(text_as_path=True).encode())
 x,y,x1,y1=box or tuple(page.rect)
 def bounds(x,y,w,h):
  root.set('viewBox',f'{x} {y} {w} {h}');root.set('width',str(w));root.set('height',str(h))
 bounds(x,y,x1-x,y1-y)
 # A coarse render provides tight alpha bounds while preserving path geometry.
 w=x1-x;h=y1-y;scale=1200/max(w,h)
 raw=cairosvg.svg2png(bytestring=E.tostring(root),output_width=round(w*scale),output_height=round(h*scale))
 import io
 im=Image.open(io.BytesIO(raw)).convert('RGBA');bb=im.getchannel('A').getbbox();assert bb
 if color not in ['pink-background','black-background','cream-background']:
  dx=w/im.width;dy=h/im.height
  bounds(x+bb[0]*dx,y+bb[1]*dy,(bb[2]-bb[0])*dx,(bb[3]-bb[1])*dy)
 svg=D/(bid+'-'+key+'.svg');png=svg.with_suffix('.png')
 content=E.tostring(root);assert not re.search(rb'<(?:script|foreignObject)\b',content,re.I)
 hybrid=bool(re.search(rb'<image\b|data:image',content,re.I))
 svg.write_bytes(content)
 vb=list(map(float,root.get('viewBox').split()));factor=2400/max(vb[2:])
 cairosvg.svg2png(bytestring=content,write_to=str(png),output_width=round(vb[2]*factor),output_height=round(vb[3]*factor))
 files={e:stage(bid,p) for e,p in ([('png',png)] if hybrid else [('svg',svg),('png',png)])}
 record=dict(key=key,label=label,form=form,lang='en' if bid=='zigzag' else 'ko',color=color,
             files=files,preview_png=files['png'],provider='사용자 제공 AI 원본',origin='manual',
             source_note='제공 AI의 벡터 패스 추출 · PNG 긴 변 2400px · 규격 표기 제외',order=10)
 if hybrid:record['source_note']='제공 AI에 방패 비트맵 포함 · SVG로 분류하지 않음 · AI 원본과 PNG 제공'
 im=Image.open(png).convert('RGBA');im.thumbnail((430,145));tile=Image.new('RGB',(460,180),'#d5d5d5')
 tile.paste(im,((460-im.width)//2,(150-im.height)//2),im);ImageDraw.Draw(tile).text((8,158),bid+' / '+key,fill='black');tiles.append(tile)
 return record

groups={bid:[] for bid in ['zigzag','gongu-ci-1368','snuh']}
for i,(label,color) in enumerate([('블랙 워드마크','black'),('화이트 워드마크','white'),('핑크 배경 · 블랙 워드마크','pink-background'),('블랙 배경 · 핑크 워드마크','black-background'),('크림 배경 · 핑크 워드마크','cream-background')]):
 v=extract('zigzag','supplied-color-'+str(i+1),label,Z/'original.ai',i,None,'wordmark',color)
 original=supplied[f'지그재그-로고-0{i+1}-scaled.png'];target=D/('zigzag-original-'+str(i+1)+'.png');shutil.copy2(original,target)
 v['original_png']=stage('zigzag',target);groups['zigzag'].append(v)
for key,label,box,form in [
 ('signature-short','국문 가로조합 · 미추홀구',(60,15,360,100),'horizontal'),
 ('signature-full','국문 가로조합 · 인천광역시 미추홀구',(60,115,490,205),'horizontal'),
 ('signature-vertical','국문 세로조합',(65,220,195,330),'vertical'),
 ('signature-tall','국문 세로쓰기 조합',(260,220,405,450),'vertical')]:
 groups['gongu-ci-1368'].append(extract('gongu-ci-1368',key,label,D/'signature-0.ai',0,box,form))
groups['gongu-ci-1368'].append(extract('gongu-ci-1368','symbol','심볼',D/'symbol.pdf',0,(0,0,355,185),'symbol'))
groups['gongu-ci-1368'].append(extract('gongu-ci-1368','mascot','미추 · 마스코트',D/'mascot.pdf',0,(80,0,388,459.46),'mascot'))
for key,label,box,form in [
 ('signature-main','SNUH · 국문 가로조합',(90,280,510,345),'horizontal'),
 ('signature-ko','SNUH · 국문 가로조합 소형',(90,585,325,640),'horizontal'),
 ('signature-en','SNUH · 영문 가로조합',(90,650,360,705),'horizontal'),
 ('signature-mixed','SNUH · 국영문 가로조합',(90,715,360,775),'horizontal'),
 ('signature-ko-stacked','SNUH · 국문 상하조합',(380,585,510,642),'vertical'),
 ('signature-en-stacked','SNUH · 영문 상하조합',(380,650,510,707),'vertical'),
 ('signature-mixed-stacked','SNUH · 영문 상하조합 강조형',(380,712,510,775),'vertical')]:
 groups['snuh'].append(extract('snuh',key,label,D/'snuh-0.ai',0,box,form))

originals={
 'zigzag':{'zip':supplied['지그재그-로고.ai.zip'],'ai':Z/'original.ai'},
 'gongu-ci-1368':{'zip':D/'michuhol-originals.zip','ai':D/'signature-0.ai'},
 'snuh':{'ai':D/'snuh-0.ai'}}
with zipfile.ZipFile(originals['gongu-ci-1368']['zip'],'w',compression=zipfile.ZIP_DEFLATED) as z:
 for n in ['signature (1).zip','markai.zip','mascotai.zip']:z.write(supplied[n],n)
for bid,rows in groups.items():
 previous=(old[bid].get('asset_manifest') or {}).get('variants')
 m=copy.deepcopy(previous) if previous else dict(schema=1,algo_v=1,id=bid,primary='',variants=[])
 oldkeys={v['key'] for v in m['variants']}
 for row in rows:
  row['key']='supplied-20261012-'+row['key'];row['order']=10+len(m['variants'])
  if row['key'] not in oldkeys:m['variants'].append(row)
 main=rows[0];m['primary']=main['key']
 orig={ext:stage(bid,path) for ext,path in originals[bid].items()}
 main['files'].update(orig)
 # Retain original existing variants, and replace only the reviewed representative.
 patch=dict(id=bid,name_ko=old[bid]['payload']['name_ko'],category=old[bid]['payload']['category'],
            logo_svg=main['files'].get('svg',False),svg_transparent=main['files'].get('svg',''),
            logo_png=main['files']['png'],has_svg=True,has_png=True,
            preview_png='https://logo.vibers.co.kr/_clients/'+bid+'/'+main['files']['png'],
            presentation={'file':main['files']['png'],'bg':'light'},
            variants_n=len(m['variants']),light=False,light_logo=False,dark_variant=False,
            asset_origin='사용자 제공 AI 원본',asset_review_status='verified',
            logo_published_at='2026-10-11T23:00:00Z',source_ai=orig['ai'])
 if 'zip' in orig:patch['source_zip']=orig['zip']
 if bid=='gongu-ci-1368':patch['icon_png']=next(v['files']['png'] for v in rows if v['form']=='symbol')
 if bid=='snuh' and 'svg' not in main['files']:
  patch.update(logo_svg=old[bid]['payload']['svg_transparent'],svg_transparent=old[bid]['payload']['svg_transparent'])
 if bid=='zigzag':patch.update(name_en='ZIGZAG',aliases=['지그재그','ZIGZAG','zigzag','카카오스타일 지그재그'])
 release['patches'][bid]=patch;release['variants'][bid]=m
for name,value in [('release',release),('uploads',uploads)]:
 (D/(name+'.json')).write_text(json.dumps(value,ensure_ascii=False,indent=2)+'\n')
sheet=Image.new('RGB',(1380,180*((len(tiles)+2)//3)),'white')
for i,tile in enumerate(tiles):sheet.paste(tile,(i%3*460,i//3*180))
sheet.save(D/'review-contact.jpg')
print('Extracted',sum(map(len,groups.values())),'variants;',len(uploads),'objects. Visual review required.')
