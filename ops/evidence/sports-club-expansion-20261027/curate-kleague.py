import json,re,io,hashlib
from pathlib import Path
from PIL import Image,ImageDraw
import cairosvg
from xml.etree import ElementTree as E
B=Path(__file__).parent;A=json.loads((B/'kleague-prepared.json').read_text());M=json.loads((B/'kleague-mascots.json').read_text());O=B/'kleague-selected';O.mkdir(exist_ok=True);out=[]
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
add(A[0],'역대 공식 울산현대축구단 조합형 · 연도 미상','horizontal',(0,0,1,1),historical=True)
add(A[1],'공식 대전 영문 세로 조합형','vertical',(.30,.12,.70,.65))
# Crop individual color versions, excluding guide panels rather than publishing a guide as a logo.
for label,box,dark in [('컬러',(.15,.24,.255,.46),False),('검정',(.35,.53,.455,.74),False),('초록',(.15,.53,.255,.74),False)]:
 add(A[3],'공식 대전 단독 엠블럼 · '+label,'emblem',box,dark=dark)
add(A[6],'공식 대전 로열 크레스트','emblem')
add(A[7],'공식 대전 Together We Stand 슬로건','vertical')
for i in range(27,46):
 x=A[i];name=Path(x['member']).stem;form='emblem'if name.startswith(('1 ','1-')) else'wordmark'if'로고타입'in name else'vertical'if'상하'in name else'horizontal';label='공식 제주 '+re.sub(r'^\d+(?:-\d+)?\s*','',name).replace('_',' · ');add(x,label,form)
add(A[65],'공식 김천 상무 엠블럼','emblem',(.17,.26,.56,.91))
add(A[66],'공식 김천 비전 CI · 축구로 하나되는 행복한 김천','emblem')
for i,label,form,box in [(67,'엠블럼','emblem',(.18,.12,.70,.90)),(68,'영문 로고타입','wordmark',(.18,.28,.90,.80)),(69,'상하 조합형','vertical',(.16,.10,.73,.93)),(70,'좌우 조합형','horizontal',(.13,.28,.87,.77))]:add(A[i],'공식 광주 '+label,form,box)
add(M[0],'공식 미타 · 기본형','mascot',(0,0,.39,1));add(M[1],'공식 미타 · 응용 동작','mascot')
# Real-world mascot event photo collage is excluded.
add(M[3],'공식 하나 · 기본형','mascot',(.22,.085,.52,.90));add(M[4],'공식 자주 · 기본형','mascot',(.50,.10,.83,.90))
add(M[5],'공식 제주 감귤 캐릭터 · 기본형','mascot');add(M[6],'공식 제주 백록 캐릭터 · 기본형','mascot')
(B/'kleague-selected.json').write_text(json.dumps(out,ensure_ascii=False,indent=2))
for start in range(0,len(out),20):
 batch=out[start:start+20];sheet=Image.new('RGB',(1200,((len(batch)+3)//4)*230),'#ddd');d=ImageDraw.Draw(sheet)
 for j,x in enumerate(batch):
  im=Image.open(O/(x['key']+'.png'));im.thumbnail((290,195));xx=j%4*300;yy=j//4*230;sheet.paste(im,(xx+(300-im.width)//2,yy),im);d.text((xx+3,yy+198),str(start+j)+' '+x['team']+' '+x['form'],fill='black');d.text((xx+3,yy+213),str(x['selected_size']),fill='black')
 sheet.save(B/('kleague-selected-'+str(start)+'.jpg'))
print('selected',len(out))
