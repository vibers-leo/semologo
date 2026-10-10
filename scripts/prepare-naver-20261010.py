"""Preserve supplied vector paths and intentional white artwork."""
from pathlib import Path
import fitz,json,hashlib,copy,zipfile,shutil
from lxml import etree as E
import cairosvg
from PIL import Image,ImageDraw
ROOT=Path(__file__).resolve().parents[1];OUT=ROOT/'marketing/assets/naver-20261010';OUT.mkdir(exist_ok=True)
UP=[];MAN={};PATCH={};TILES=[]
def obj(id,p):
 h=hashlib.sha256(p.read_bytes()).hexdigest();rel=f'sources/naver-20261010/{h[:20]}{p.suffix}';UP.append(dict(id=id,file=str(p.relative_to(ROOT)),key=f'_clients/{id}/{rel}',sha256=h));return rel

def svgpdf(src,page,path,indices=None):
 p=fitz.open(src)[page];root=E.fromstring(p.get_svg_image(text_as_path=True).encode());draw=p.get_drawings();paths=root.xpath('//*[local-name()="path" and not(ancestor::*[local-name()="defs"])]');assert len(paths)==len(draw),(len(paths),len(draw))
 chosen=list(range(len(draw))) if indices is None else indices
 for i,e in enumerate(paths):
  if i not in chosen:e.getparent().remove(e)
 bounds=fitz.Rect(draw[chosen[0]]['rect'])
 for i in chosen[1:]:bounds|=draw[i]['rect']
 pad=.25;bounds+=(-pad,-pad,pad,pad)
 root.set('viewBox',f'{bounds.x0} {bounds.y0} {bounds.width} {bounds.height}');root.set('width',str(bounds.width));root.set('height',str(bounds.height));path.write_bytes(E.tostring(root));return path

def add(id,key,label,svg,form='wordmark',color='original'):
 raw=svg.read_bytes();r=E.fromstring(raw);_,_,w,h=map(float,r.get('viewBox').split());png=svg.with_suffix('.png');cairosvg.svg2png(bytestring=raw,write_to=str(png),output_width=round(2000*w/max(w,h)),output_height=round(2000*h/max(w,h)))
 files={'svg':obj(id,svg),'png':obj(id,png)};m=MAN.setdefault(id,dict(schema=1,algo_v=1,id=id,primary=key,variants=[]));m['variants'].append(dict(key=key,label=label,form=form,lockup=form,lang='en' if id=='naver' else 'ko',color=color,files=files,provider='사용자 제공 네이버 벡터 원본',origin='manual',order=len(m['variants'])))
 im=Image.open(png).convert('RGBA');im.thumbnail((500,230));tile=Image.new('RGBA',(540,280),'#242424' if color=='white' else '#ededed');tile.alpha_composite(im,((540-im.width)//2,(240-im.height)//2));ImageDraw.Draw(tile).text((8,255),id+' / '+key,fill='white' if color=='white' else 'black');TILES.append(tile.convert('RGB'));return files
src=Path('/Users/juuuno/Downloads');blog='naver-blog'
configs=[('wordmark','blog 워드마크','wordmark'),('symbol','블로그 심볼','symbol'),('app-black','앱 아이콘 · 검정 배경','symbol'),('n-blog','N blog 가로조합','horizontal'),('naver-blog','NAVER blog 가로조합','horizontal'),('app-green','앱 아이콘 · 녹색 배경','symbol')]
for i,(key,label,form) in enumerate(configs):add(blog,key,label,svgpdf(src/'2026 네이버 블로그 리브랜딩.pdf',i,OUT/(blog+'-'+key+'.svg')),form)
z=zipfile.ZipFile(src/'NaverBrand_Resource.zip')
for color in ['Green','Black','White']:
 name=next(n for n in z.namelist() if n.endswith('/Logotype_'+color+'.svg'));p=OUT/('naver-'+color.lower()+'.svg');p.write_bytes(z.read(name));add('naver',color.lower(),'NAVER 워드마크 · '+color,p,color=color.lower())
for key,label,indices,form in [('icon','스마트스토어 앱 아이콘',[7,8,9],'symbol'),('vertical','스마트스토어 세로조합',list(range(7)),'vertical')]:add('smartstore-naver',key,label,svgpdf(src/'스마트스토어 아이콘.ai',0,OUT/('smartstore-'+key+'.svg'),indices),form)
for id,m in MAN.items():
 primary=m['variants'][0]['files'];PATCH[id]=dict(has_svg=True,has_png=True,logo_svg=primary['svg'],svg_transparent=primary['svg'],logo_png=primary['png'],preview_png='https://logo.vibers.co.kr/_clients/'+id+'/'+primary['png'],presentation=dict(file=primary['png'],bg='light'),light=False,light_logo=False,dark_variant=False,variants_n=len(m['variants']),asset_review_status='verified',asset_origin='사용자 제공 네이버 벡터 원본',origin='KR',hidden=False,logo_published_at='2026-10-10T11:25:00Z',rejected_asset_files=['logo-icon.png','logo-800.png','logo-transparent.png','logo-white.png'])
 archive=OUT/(id+'-originals.zip')
 with zipfile.ZipFile(archive,'w',zipfile.ZIP_DEFLATED) as a:
  names={'naver':['NaverBrand_Resource.zip'],'naver-blog':['2026 네이버 블로그 리브랜딩.ai','2026 네이버 블로그 리브랜딩.pdf'],'smartstore-naver':['스마트스토어 아이콘.ai']}[id]
  for name in names:a.write(src/name,name)
 PATCH[id]['source_zip']=obj(id,archive)
PATCH[blog].update(id=blog,name_ko='네이버 블로그',name_en='NAVER Blog',aliases=['네이버블로그','블로그','NAVER BLOG','Naver Blog','blog','2026 네이버 블로그','네이버 블로그 리브랜딩'],category='미디어·엔터',added_at='2026-10-10',icon_png=MAN[blog]['variants'][-1]['files']['png'])
PATCH['naver'].update(name_ko='네이버',name_en='NAVER',aliases=['네이버','NAVER','Naver Corporation','네이버 로고','네이버 공식 로고','네이버 주식회사'])
PATCH['smartstore-naver'].update(name_ko='네이버 스마트스토어',name_en='NAVER Smart Store',aliases=['네이버스마트스토어','스마트스토어','Smart Store','Smartstore','네이버 스토어'],category='유통·쇼핑',icon_png=MAN['smartstore-naver']['variants'][0]['files']['png'])
# Existing historical assets are retained when the audited source copies exist.
for key,label in [('legacy-naver-2','이전 NAVER 워드마크 · 기존 수집본'),('legacy-naver-src','이전 모자 심볼 조합 · 기존 수집본')]:
 svg=OUT/(key+'.svg');png=OUT/(key+'.png')
 if svg.exists() and png.exists():
  files={'svg':obj('naver',svg),'png':obj('naver',png)}
  MAN['naver']['variants'].append(dict(key=key,label=label,form='horizontal',lang='en',color='original',files=files,origin='collected',provider='통합한 기존 네이버 콘텐츠',order=len(MAN['naver']['variants'])))
PATCH['naver']['variants_n']=len(MAN['naver']['variants'])
for id in ['naver-2','naver--src-83d3c48']:
 PATCH[id]=dict(variant_of='naver',merged_into='naver',hidden=True,hidden_reason='공식 제공 네이버 로고와 이전 수집본을 하나의 콘텐츠로 통합')
for id,boost in [('naver',120),('naver-blog',100),('smartstore-naver',80)]:PATCH[id]['discovery_boost']=boost
(OUT/'release.json').write_text(json.dumps({'patches':PATCH,'variants':MAN},ensure_ascii=False,indent=2));(OUT/'uploads.json').write_text(json.dumps(UP,ensure_ascii=False,indent=2))
sheet=Image.new('RGB',(1620,((len(TILES)+2)//3)*280),'white')
for i,t in enumerate(TILES):sheet.paste(t,((i%3)*540,(i//3)*280))
sheet.save(OUT/'extracted-contact.jpg');print('Prepared',len(UP),'objects')
