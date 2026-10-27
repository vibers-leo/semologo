import json,re,io,hashlib
from pathlib import Path
from PIL import Image,ImageDraw
import cairosvg
from xml.etree import ElementTree as E
B=Path(__file__).parent;A=json.loads((B/'kleague-prepared.json').read_text());M=[];O=B/'kleague-selected';O.mkdir(exist_ok=True);out=[]
def add(x,label,form,box=(0,0,1,1),historical=False,dark=False):
 key=x['team']+'-'+hashlib.sha256((x.get('token',x.get('key',''))+str(box)).encode()).hexdigest()[:16];vector=x.get('vector',False);svg=None
 if vector:
  raw=(B/'kleague-prepared'/(x['token']+'.svg')).read_text();dims=list(map(float,E.fromstring(raw).get('viewBox').split()));l,t,r,b=box;v=[dims[0]+l*dims[2],dims[1]+t*dims[3],(r-l)*dims[2],(b-t)*dims[3]]
  def sz(raw,v):
   raw=re.sub(r'viewBox="[^"]+"','viewBox="'+' '.join(map(str,v))+'"',raw,count=1);raw=re.sub(r'width="[^"]+"',f'width="{v[2]}"',raw,count=1);return re.sub(r'height="[^"]+"',f'height="{v[3]}"',raw,count=1)
  raw=sz(raw,v);im=Image.open(io.BytesIO(cairosvg.svg2png(bytestring=raw.encode(),output_width=round(1600*v[2]/max(v[2],v[3])),output_height=round(1600*v[3]/max(v[2],v[3]))))).convert('RGBA');bb=im.getchannel('A').getbbox();assert bb;w,h=im.size;l,t,r,b=bb;v=[v[0]+v[2]*l/w,v[1]+v[3]*t/h,v[2]*(r-l)/w,v[3]*(b-t)/h];svg=sz(raw,v);im=im.crop(bb);(O/(key+'.svg')).write_text(svg)
 else:
  file=x.get('file')if'token'not in x else 'kleague-prepared/'+x['token']+'.png';im=Image.open(B/file).convert('RGBA');w,h=im.size;im=im.crop(tuple(round(z*(w if j%2==0 else h))for j,z in enumerate(box)));bb=im.getchannel('A').getbbox();assert bb;im=im.crop(bb)
 im.save(O/(key+'.png'));out.append({**x,'key':key,'vector':vector,'label':label,'form':form,'historical':historical,'dark':dark,'crop':box,'selected_size':im.size})

for label,box in [('국문',(.08,.197,.62,.24)),('영문',(.08,.305,.62,.335)),('국영문 상하조합',(.08,.40,.62,.455)),('국영문 약자',(.08,.53,.32,.57)),('영문 상하조합',(.08,.64,.40,.69))]:add(A[0],'공식 안양 로고타입 · '+label,'wordmark',box)
for label,box,dark in [('컬러',(.125,.22,.35,.43),False),('컬러 · 다크용',(.475,.22,.70,.43),True),('검정',(.125,.535,.35,.74),False),('흰색 · 다크용',(.475,.535,.70,.74),True)]:add(A[2],'공식 안양 세로 시그니처 · '+label,'vertical',box,dark=dark)
for label,box,dark in [('컬러',(.13,.205,.90,.30),False),('컬러 · 다크용',(.13,.415,.90,.51),True),('검정',(.13,.64,.90,.74),False),('흰색 · 다크용',(.13,.87,.90,.965),True)]:add(A[5],'공식 안양 가로 시그니처 · '+label,'horizontal',box,dark=dark)
add(A[6],'공식 서울 기본 엠블럼','emblem',(.20,.26,.80,.70))
for i,label,form in [(13,'영문 가로','horizontal'),(18,'영문 세로','vertical'),(23,'국문 가로','horizontal'),(28,'국문 세로','vertical')]:add(A[i],'공식 서울 '+label+' 시그니처 · 다크용',form,(.20,.34,.80,.65),dark=True)
for i,label,form in [(34,'엠블럼','emblem'),(35,'기념 로고','emblem'),(36,'가로 조합형','horizontal')]:add(A[i],'공식 서울 40주년 · '+label,form,historical=True)
for i,label,form,dark in [(39,'컬러 엠블럼','emblem',False),(40,'흰색 엠블럼 · 다크용','emblem',True)]:add(A[i],'공식 인천 '+label,form,dark=dark)
(B/'kleague-selected.json').write_text(json.dumps(out,ensure_ascii=False,indent=2))
for start in range(0,len(out),20):
 batch=out[start:start+20];sheet=Image.new('RGB',(1200,((len(batch)+3)//4)*230),'#ddd');d=ImageDraw.Draw(sheet)
 for j,x in enumerate(batch):
  im=Image.open(O/(x['key']+'.png'));im.thumbnail((290,195));xx=j%4*300;yy=j//4*230;sheet.paste(im,(xx+(300-im.width)//2,yy),im);d.text((xx+3,yy+198),str(start+j)+' '+x['team']+' '+x['form'],fill='black');d.text((xx+3,yy+213),str(x['selected_size']),fill='black')
 sheet.save(B/('kleague-selected-'+str(start)+'.jpg'))
print('selected',len(out))
