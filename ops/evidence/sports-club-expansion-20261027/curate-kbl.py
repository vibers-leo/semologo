import json,re,io,hashlib
from pathlib import Path
from PIL import Image,ImageDraw
import cairosvg
from xml.etree import ElementTree as E
B=Path(__file__).parent;O=B/'kbl-selected';O.mkdir(exist_ok=True);A=json.loads((B/'kbl-downloads.json').read_text());out=[]
def add(i,label,form,box=(0,0,1,1),dark=False,historical=False):
 x=A[i];assert 'held'not in x;key='kbl-'+x['code']+'-'+hashlib.sha256((x['name']+str(box)).encode()).hexdigest()[:14];im=Image.open(B/x['preview']).convert('RGBA');svg=None
 if x['vector']:
  svg=(B/x['file']).read_text();dims=list(map(float,E.fromstring(svg).get('viewBox').split()));l,t,r,b=box;v=[l*dims[2],t*dims[3],(r-l)*dims[2],(b-t)*dims[3]]
  def sz(raw,v):
   raw=re.sub(r'viewBox="[^"]+"','viewBox="'+' '.join(map(str,v))+'"',raw,count=1);raw=re.sub(r'width="[^"]+"',f'width="{v[2]}"',raw,count=1);return re.sub(r'height="[^"]+"',f'height="{v[3]}"',raw,count=1)
  svg=sz(svg,v);im=Image.open(io.BytesIO(cairosvg.svg2png(bytestring=svg.encode(),output_width=1200))).convert('RGBA');bb=im.getchannel('A').getbbox();assert bb;w,h=im.size;l,t,r,b=bb;v=[v[0]+v[2]*l/w,v[1]+v[3]*t/h,v[2]*(r-l)/w,v[3]*(b-t)/h];svg=sz(svg,v);im=im.crop(bb);(O/(key+'.svg')).write_text(svg)
 else:
  w,h=im.size;im=im.crop(tuple(round(z*(w if j%2==0 else h))for j,z in enumerate(box)));bb=im.getchannel('A').getbbox();assert bb;im=im.crop(bb)
 im.save(O/(key+'.png'));out.append({**x,'key':key,'label':label,'form':form,'dark':dark,'historical':historical,'crop':box,'selected_size':im.size})
add(1,'공식 프로미 캐릭터 기본형','mascot',(.06,.08,.44,.83));add(2,'공식 그린몬스터 기본형','mascot',(.04,.07,.42,.83))
for i,name in [(7,'검정'),(8,'골드'),(9,'실버'),(10,'컬러 · 다크용'),(11,'검정 · 다크용'),(12,'골드 · 다크용'),(13,'실버 · 다크용')]:add(i,'공식 현대모비스 엠블럼 · '+name,'emblem',dark=i>=10)
for i,n in [(4,'A'),(5,'B')]:add(i,'공식 현대모비스 마스코트 설정 · '+n,'mascot',(.08,.12,.92,.92))
for i,n in [(14,'기본'),(15,'빨강')]:add(i,'공식 현대모비스 국문 워드마크 · '+n,'wordmark',(.14,.2,.86,.8))
add(19,'공식 KCC 이지스 워드마크','wordmark',(.1,.2,.9,.85));add(20,'공식 KCC 마스코트 · 기본형','mascot',(.29,.1,.47,.9));add(20,'공식 KCC 마스코트 엠블럼','mascot',(.49,.1,.73,.9))
add(22,'공식 정관장 프로스포츠 CI','wordmark',(.04,.1,.96,.9));add(23,'공식 레드부 · 기본형','mascot',(.46,.07,.66,.15));add(23,'공식 레드부 · 조력자형','mascot',(.66,.07,.89,.15))
add(26,'공식 ONE TEAM ONE DREAM 슬로건','wordmark',(.08,.08,.92,.9))
for i,n in [(28,'영문 조합형'),(29,'영문 단독형')]:add(i,'공식 세이커스 워드마크 · '+n,'wordmark',(.15,.17,.86,.88))
add(30,'공식 챔비','mascot',(.25,.18,.47,.91));add(30,'공식 꼬마 챔비','mascot',(.65,.33,.90,.91))
add(33,'공식 페가수스 워드마크','wordmark',(0,0,1,1));add(34,'공식 페가수스 마스코트 기본형','mascot',(.12,.07,.50,.91));add(34,'공식 페가수스 마스코트 응용형','mascot',(.49,.06,.89,.94))
for i,n in [(35,'워드마크'),(37,'국문 커뮤니케이션명'),(38,'영문 커뮤니케이션명')]:add(i,'공식 SK 나이츠 '+n,'wordmark',(.13,.25,.89,.88))
for i,n in [(39,'2017–18 챔피언'),(40,'2021–22 챔피언'),(41,'20주년 엠블럼'),(42,'20주년 슬로건')]:add(i,'기념 · SK 나이츠 '+n,'emblem'if i!=42 else'wordmark',(.14,.18,.88,.9),historical=True)
for i,n in [(43,'A'),(44,'B'),(45,'C'),(46,'D')]:add(i,'공식 SK 나이츠 FANTASTIC 응용형 · '+n,'wordmark',(.14,.18,.88,.9))
for i,n in [(47,'A'),(48,'B')]:add(i,'공식 SK 나이츠 마스코트 · '+n,'mascot',(.19,.09,.83,.92))
for i,n in [(49,'쏘냐'),(50,'위냐')]:add(i,'공식 '+n+' · 3면도','mascot',(.08,.03,.95,.95))
add(56,'공식 썬더스 영문 조합형 · 다크용','wordmark',dark=True)
for i,n in [(52,'영문·국문'),(53,'국문·영문'),(54,'국문·국문')]:add(i,'공식 썬더스 워드마크 · '+n,'wordmark',(.14,.24,.89,.87))
(B/'kbl-selected.json').write_text(json.dumps(out,ensure_ascii=False,indent=2))
for start in range(0,len(out),24):
 batch=out[start:start+24];sheet=Image.new('RGB',(1000,((len(batch)+3)//4)*205),'#ccc');d=ImageDraw.Draw(sheet)
 for j,x in enumerate(batch):
  im=Image.open(O/(x['key']+'.png'));im.thumbnail((235,165));xx=j%4*250;yy=j//4*205;sheet.paste(im,(xx+(250-im.width)//2,yy),im);d.text((xx+3,yy+168),str(start+j)+' '+x['code']+' '+str(x['selected_size']),fill='black')
 sheet.save(B/('kbl-selected-'+str(start)+'.jpg'))
print('selected',len(out))
