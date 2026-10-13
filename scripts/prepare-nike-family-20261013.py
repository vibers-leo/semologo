"""Prepare reviewed Nike family groups and displayed white-canvas examples; no publication."""
from pathlib import Path
import json,hashlib,subprocess,importlib.util,copy,re,io
from PIL import Image,ImageDraw
R=Path(__file__).resolve().parents[1];D=R/'marketing/assets/nike-and-white-background-20261013';C=R/'marketing/assets/english-svg-preview-20261010/source-cache'
spec=importlib.util.spec_from_file_location('audit',R/'scripts/audit-svg-backgrounds.py');a=importlib.util.module_from_spec(spec);spec.loader.exec_module(a)
(D/'visual-approved.json').unlink(missing_ok=True)
rows={r['id']:r for r in json.loads((D/'before-cms.json').read_text())};release={'patches':{},'variants':{}};uploads=[];proof=[];review=[]
groups={'nike':['nike--src-a11f159','nike-8','nike-5','nike-4-2','nike-9','nike-3-1','nike-2','nike-9-1','nike-8--src-7f74d2f','nike-8-1','nike-6'],'nike-golf':['nike-golf','nike-golf-1','nike-golf-2','nike-golf-3'],'nike-com':['nike-com'],'nike-ipod':['logo-of-nike-ipod'],'nike-football':['nike-football','nike-football-1','nikefootball-com'],'techniker-krankenkasse':['techniker-krankenkasse-1'],'omnikey':['omnikey'],'chernikeeff':['chernikeeff','chernikeeff-6157']}
labels={'nike':['나이키','Nike'],'nike-golf':['나이키 골프','Nike Golf'],'nike-com':['나이키 닷컴','Nike.com'],'nike-ipod':['나이키+iPod','Nike+iPod'],'nike-football':['나이키 풋볼','Nike Football'],'techniker-krankenkasse':['테크니커 크랑켄카세','Techniker Krankenkasse'],'omnikey':['옴니키','OMNIKEY'],'chernikeeff':['체르니키프','Chernikeeff']}
def original(id,file='logo.svg'):
 p=C/id/file
 if p.exists():return p.read_bytes()
 url='https://kr.object.ncloudstorage.com/vibers-bucket/_clients/'+id+'/'+file
 return subprocess.run(['curl','-fsSL','--max-time','30',url],capture_output=True,check=True).stdout

def make(target,source,raw,label):
 assert not re.search(rb'<(?:[\w-]+:)?(?:image|script|foreignObject|filter)\b|<!ENTITY|data:image|(?:href\s*=\s*["\'](?:https?:|//|file:))',raw,re.I),source
 tree,bgs=a.candidates(raw);clean=raw;removed=False
 # Keep negative white Swoosh inside the black oval. It needs a separate vector review.
 if source=='nike-3-1':
  tree=a.E.fromstring(raw);canvas=tree[0][0]
  assert canvas.get('fill')=='#fff' and canvas.get('d')=='m0 0h192.756v192.756h-192.756z'
  canvas.getparent().remove(canvas);clean=a.E.tostring(tree);removed=True
 elif source=='nike-5':
  tree=a.E.fromstring(raw);canvas=tree[0][0];mark=tree[0][1]
  assert canvas.get('d')=='M0 0h192.756v192.756H0V0z'
  # Restrict the white underlay to the black oval's exact outer contour.
  # The enclosed white Swoosh stays white while the surrounding paper becomes transparent.
  canvas.set('d',mark.get('d').split('z',1)[0]+'z');clean=a.E.tostring(tree);removed=True
 elif bgs:
  assert not any(a.E.QName(el).localname=='path' and (len(re.findall(r'[Mm]',el.get('d','')))!=1 or re.search(r'[Zz].*[^\s,]',el.get('d','').strip())) for el in bgs),('compound',source)
  for el in bgs:el.getparent().remove(el)
  clean=a.E.tostring(tree);removed=True
 im=a.render(clean,640);assert im.getbbox();box=im.getchannel('A').getbbox();im=im.crop(box)
 hi=a.render(clean,2000);hi=hi.crop(hi.getchannel('A').getbbox())
 files={}
 for name,body in [('original.svg',raw),('transparent.svg',clean),('preview.png',None),('logo.png',None)]:
  if body is None:
   b=io.BytesIO();(im if name=='preview.png' else hi).save(b,format='PNG',optimize=True);body=b.getvalue()
  sha=hashlib.sha256(body).hexdigest();f='sources/family-review-20261013/'+sha[:20]+'/'+name;p=D/target/f;p.parent.mkdir(parents=True,exist_ok=True);p.write_bytes(body);files[name]=f;uploads.append({'id':target,'file':str(p.relative_to(R)),'key':'_clients/'+target+'/'+f,'sha256':sha})
 if source=='nike':
  icon=a.render(clean,1024);assert icon.size==(1024,1024)
  b=io.BytesIO();icon.save(b,format='PNG',optimize=True);body=b.getvalue();sha=hashlib.sha256(body).hexdigest();f='sources/family-review-20261013/'+sha[:20]+'/icon.png';p=D/target/f;p.parent.mkdir(parents=True,exist_ok=True);p.write_bytes(body);files['icon.png']=f;uploads.append({'id':target,'file':str(p.relative_to(R)),'key':'_clients/'+target+'/'+f,'sha256':sha})
 key='reviewed-'+hashlib.sha256((files['transparent.svg']+label).encode()).hexdigest()[:12]
 variant={'key':key,'form':'symbol' if source=='nike' else 'unknown','lang':'unknown','color':'original','label':label,'files':{'svg':files['transparent.svg'],'png':files['logo.png']},'preview_png':files['preview.png'],'original_svg':files['original.svg'],'provider':'보유 SVG · 배경 검수 · 제작 시기 미확인','origin':'derived' if removed else 'collected','order':0}
 proof.append({'target':target,'source':source,'original_sha256':hashlib.sha256(raw).hexdigest(),'canvas_removed':removed,'preview_alpha':im.getchannel('A').getextrema(),'source_preserved':True});review.append((source,im))
 return variant,files

for target,sources in groups.items():
 f=D/(target+'-manifest.json');current=((rows[target].get('asset_manifest')or{}).get('variants')or{}) or (json.loads(f.read_text()) if f.exists() else {})
 manifest=copy.deepcopy(current) if current else {'schema':1,'id':target,'variants':[]};manifest.setdefault('variants',[])
 if target=='nike':
  # Nike.com and Nike Golf are moved into their own identities below, not discarded.
  manifest['variants']=[]
  for v in manifest['variants']:
   if v['key']=='horizontal':v.update(form='symbol',label='Swoosh · 기본 심볼')
  sources=['nike',*sources]
 seen={};newvars=[]
 for source in sources:
  raw=original(source);label={'nike':'Swoosh · 기본 심볼','nike-2':'JUST DO IT. · 슬로건','nike--src-a11f159':'NIKE 글자 + Swoosh · 오렌지','nike-3-1':'NIKE 글자 + Swoosh · 검정','nike-6':'Swoosh · 골드','nike-5':'타원형 Swoosh · 흰 심볼 보존'}.get(source,source.replace('-',' ')+' · 수집 버전')
  v,files=make(target,source,raw,label)
  sha=hashlib.sha256(raw).hexdigest()
  if sha in seen:seen[sha].setdefault('also_collected_from',[]).append(source)
  else:manifest['variants'].append(v);seen[sha]=v;newvars.append((v,files,source))
  if source!=target:release['patches'][source]={'hidden':True,'variant_of':target,'merged_into':target,'hidden_reason':'동일 브랜드의 수집 버전을 대표 콘텐츠 구성으로 통합'}
 # Move the misclassified main Nike variants into the correct family groups.
 if target in ['nike-golf','nike-com']:
  old=next(v for v in json.loads((D/'nike-manifest.json').read_text())['variants'] if v['key']==('wordmark' if target=='nike-golf' else 'symbol'))
  v,files=make(target,'moved-from-nike-'+target,original('nike',old['files']['svg']),'기존 나이키 콘텐츠에서 이동 · '+labels[target][1]);manifest['variants'].append(v)
 for i,v in enumerate(manifest['variants']):v['order']=i
 primary,files,source=newvars[0];manifest['primary']=primary['key']
 patch={'name_ko':labels[target][0],'name_en':labels[target][1],'category':'스포츠' if target.startswith('nike') else rows[target]['payload'].get('category','브랜드'),'aliases':list(dict.fromkeys([*sources,*labels[target],*('나이키 NIKE Swoosh 스우시 JUST DO IT'.split() if target=='nike' else [])])),'has_svg':True,'has_png':True,'logo_svg':files['transparent.svg'],'svg_transparent':files['transparent.svg'],'logo_png':files['logo.png'],'preview_png':'https://logo.vibers.co.kr/_clients/'+target+'/'+files['preview.png'],'presentation':{'file':files['preview.png'],'bg':'light'},'light':False,'light_logo':False,'dark_variant':False,'variants_n':len(manifest['variants']),'asset_review_status':'awaiting-visual-review'}
 if target=='nike':patch.update(icon_png=files['icon.png'])
 release['patches'][target]=patch;release['variants'][target]=manifest
# Misidentified/cropped graphics stay archived pending identity and geometry review.
for id,reason in [('nike-7','U.S. Air Force 표장으로 보이며 나이키 소속 근거 미확인'),('nike-11','Swoosh 일부처럼 보이는 도형 · 완전한 로고 원본 검수 대기'),('nike-react-2','원본 뷰박스에서 글자가 잘린 상태 · 별도 검수 대기')]:release['patches'][id]={'hidden':True,'hidden_reason':reason}
for id,name in [('nike-acg','나이키 ACG'),('nike-shox','나이키 Shox'),('nike-town','나이키타운'),('nike-factory-store','나이키 팩토리 스토어'),('nike-tennis','나이키 테니스'),('nike-1','나이키 농구'),('nike-720','나이키 Air 720'),('nike-270','나이키 Air 270'),('nike-200','나이키 Air 200')]:release['patches'][id]={'name_ko':name,'category':'스포츠'}
for start in range(0,len(review),20):
 sheet=Image.new('RGB',(1200,((len(review[start:start+20])+3)//4)*185),'#aaa');dr=ImageDraw.Draw(sheet)
 for i,(id,im) in enumerate(review[start:start+20]):
  im=im.copy();im.thumbnail((140,145));x=i%4*300;y=i//4*185
  for j,color in enumerate(['#eee','#222']):
   bg=Image.new('RGBA',(145,150),color);bg.alpha_composite(im,((145-im.width)//2,(150-im.height)//2));sheet.paste(bg.convert('RGB'),(x+j*150,y))
  dr.text((x,y+154),id,fill='black')
 sheet.save(D/f'review-{start//20+1}.jpg')
for name,value in [('release',release),('uploads',uploads),('proof',proof)]: (D/(name+'.json')).write_text(json.dumps(value,ensure_ascii=False,indent=2)+'\n')
print('READY',len(release['patches']),'patches',len(uploads),'objects; visual review required')
