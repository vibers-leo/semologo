import json,io,re,hashlib
from pathlib import Path
from PIL import Image,ImageDraw
import cairosvg
from xml.etree import ElementTree as E
B=Path(__file__).parent;D=B/'prepared';O=B/'selected';O.mkdir(exist_ok=True);A=json.loads((B/'prepared.json').read_text());out=[]
def add(i,label,form,box=(0,0,1,1),historical=False,dark=False):
 x=A[i];key=x['token']+'-v'+str(len(out));im=Image.open(D/(x['token']+'.png')).convert('RGBA');svg=None
 if x['vector']:
  raw=(D/(x['token']+'.svg')).read_text();dims=list(map(float,E.fromstring(raw).get('viewBox').split()));l,t,r,b=box;v=[l*dims[2],t*dims[3],(r-l)*dims[2],(b-t)*dims[3]]
  def sz(raw,v):
   raw=re.sub(r'viewBox="[^"]+"','viewBox="'+' '.join(map(str,v))+'"',raw,count=1);raw=re.sub(r'width="[^"]+"',f'width="{v[2]}"',raw,count=1);return re.sub(r'height="[^"]+"',f'height="{v[3]}"',raw,count=1)
  raw=sz(raw,v);im=Image.open(io.BytesIO(cairosvg.svg2png(bytestring=raw.encode(),output_width=round(1200*v[2]/max(v[2],v[3])),output_height=round(1200*v[3]/max(v[2],v[3]))))).convert('RGBA');bbox=im.getchannel('A').getbbox();assert bbox;iw,ih=im.size;l,t,r,b=bbox;v=[v[0]+v[2]*l/iw,v[1]+v[3]*t/ih,v[2]*(r-l)/iw,v[3]*(b-t)/ih];svg=sz(raw,v);im=im.crop(bbox);(O/(key+'.svg')).write_text(svg)
 else:
  w,h=im.size;im=im.crop(tuple(round(z*(w if j%2==0 else h)) for j,z in enumerate(box)));bbox=im.getchannel('A').getbbox();assert bbox;im=im.crop(bbox)
 im.save(O/(key+'.png'));out.append({**x,'key':key,'label':label,'form':form,'historical':historical,'dark':dark,'size':im.size})
for i,l in [(3,'공식 기본 컬러 엠블럼'),(2,'공식 단색 엠블럼'),(1,'공식 ACL 엠블럼 · 별 2개')]:add(i,l,'emblem')
for j,(label,box) in enumerate([('컬러',(.19,.235,.49,.465)),('흰색',(.50,.235,.80,.465)),('검정',(.19,.48,.49,.72)),('빨강',(.50,.48,.80,.72))]):add(4,'공식 포항 엠블럼 · '+label,'emblem',box,dark=label=='흰색')
add(5,'공식 레트로 20주년 엠블럼','emblem',historical=True);add(6,'공식 40주년 엠블럼','emblem',historical=True)
for i,label in [(7,'쇠돌이 · 정면·측면·후면'),(8,'쇠순이 · 정면·측면·후면'),(10,'쇠돌이·쇠순이 · 얼굴형'),(11,'쇠순이 · 응원 동작 A'),(12,'쇠순이 · 응원 동작 B'),(13,'쇠돌이 · 축구 동작'),(14,'쇠돌이 · 헤딩·골키퍼 동작')]:add(i,'공식 '+label,'mascot')
# Standalone official PNGs from current club page and club history; do not fabricate SVGs.
for x in json.loads((B/'jeonbuk-png.json').read_text()):
 im=Image.open(B/x['file']).convert('RGBA');bbox=im.getchannel('A').getbbox();assert bbox;im=im.crop(bbox);key='jeonbuk-'+hashlib.sha256((B/x['file']).read_bytes()).hexdigest()[:16];im.save(O/(key+'.png'));name=x['name'].split('.')[0]
 if name.startswith('obj_'):
  m=re.fullmatch(r'obj_mascot_([12])_(\d+)',name);label='공식 '+('나이티 얼굴형' if m[1]=='1' else '써치')+' · 표정 '+m[2];form='mascot';historic=False
 elif name.startswith('img_mascot_'):label='공식 '+('나이티' if name.endswith('_1') else '써치')+' · 기본형';form='mascot';historic=False
 else:
  year=int(name.split('_')[1]);label='공식 구단 연혁 · '+str(year)+' 표기 도안';form='mascot' if year==1995 else 'wordmark' if year==2000 else 'emblem';historic=year<2025
 out.append({'team':'jeonbuk','key':key,'label':label,'form':form,'historical':historic,'dark':False,'vector':False,'source_url':x['url'],'source_page':'https://hyundai-motorsfc.com/club','source_sha256':hashlib.sha256((B/x['file']).read_bytes()).hexdigest(),'member':Path(x['file']).name,'size':im.size,'package':None})
(B/'selected.json').write_text(json.dumps(out,ensure_ascii=False,indent=2))
for start in range(0,len(out),24):
 batch=out[start:start+24];sheet=Image.new('RGB',(1000,((len(batch)+3)//4)*200),'#ccc');d=ImageDraw.Draw(sheet)
 for j,x in enumerate(batch):
  im=Image.open(O/(x['key']+'.png'));im.thumbnail((235,165));xx=j%4*250;yy=j//4*200;sheet.paste(im,(xx+(250-im.width)//2,yy),im);d.text((xx+3,yy+168),str(start+j)+' '+x['form']+' V'+str(x['vector']),fill='black')
 sheet.save(B/('selected-'+str(start)+'.jpg'))
print(len(out))
