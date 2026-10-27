import json,io,hashlib,re
from pathlib import Path
from PIL import Image,ImageDraw
B=Path(__file__).parent;O=B/'kovo-selected';O.mkdir(exist_ok=True);A=json.loads((B/'kovo-downloads.json').read_text());out=[]
def add(i,label,form,box=(0,0,1,1),dark=False,campaign=False):
 x=A[i];im=Image.open(B/x['preview']).convert('RGBA');w,h=im.size;im=im.crop(tuple(round(z*(w if j%2==0 else h))for j,z in enumerate(box)));bb=im.getchannel('A').getbbox();assert bb;im=im.crop(bb)
 if max(im.size)>1800:im.thumbnail((1800,1800))
 key='kovo-'+x['tcode']+'-'+hashlib.sha256((x['name']+str(box)).encode()).hexdigest()[:14];im.save(O/(key+'.png'));out.append({**x,'key':key,'label':label,'form':form,'dark':dark,'campaign':campaign,'vector':False,'selected_size':im.size})
for n,box in enumerate([(.10,.12,.36,.75),(.375,.12,.625,.75),(.64,.12,.90,.75)],1):add(1,'공식 몰리 · 표정 '+str(n),'mascot',box)
add(3,'공식 서포터즈 자일즈 워드마크','wordmark',(.08,.13,.48,.85));add(3,'공식 서포터즈 자일즈 응용형','emblem',(.49,.08,.93,.91))
add(8,'공식 우리카드 우리WON 국영문 워드마크','wordmark',(.05,.15,.95,.88))
add(11,'공식 KB스타즈 슬로건 · 적용 시즌 미확인','wordmark',campaign=True)
add(13,'공식 VIXTORM 단색 엠블럼','emblem',(.55,.15,.91,.78));add(14,'공식 한국전력 마스코트','mascot',(.15,.03,.85,.94))
for i,n in [(15,'저축은행 표기'),(16,'읏맨 표기')]:add(i,'공식 OK 읏맨 가로조합 · '+n,'horizontal')
add(18,'공식 블루팡스 마스코트 기본형','mascot',(.09,.03,.36,.86));add(18,'공식 블루팡스 마스코트 응용형','mascot',(.40,.04,.96,.89))
add(20,'공식 하이패스 캐릭터 응용형','mascot',(0,0,1,1))
add(22,'공식 현대건설 배구단 워드마크','wordmark',(.52,.15,.95,.87))
for n,box in enumerate([(.14,.02,.88,.34),(.10,.34,.90,.65),(.10,.65,.90,.99)],1):add(24,'공식 현대건설 캐릭터 · 구성 '+str(n),'mascot',box)
add(26,'공식 핑크스파이더스 국영문 가로조합','horizontal',(.03,.05,.98,.95))
for name,box in [('핑키',(.08,.02,.45,.91)),('핑거',(.49,.02,.86,.91))]:add(28,'공식 '+name+' 기본형','mascot',box)
add(30,'공식 토랑이 기본형','mascot',(.24,.02,.64,.58));add(30,'공식 토랑이 응용형','mascot',(.08,.55,.95,.96))
for row in range(2):
 for col in range(3):add(32,'공식 SOOPers 워드마크 · 응용 '+str(col+1)+(' · 다크용'if row else''),'wordmark',(col/3+.055,row/2+.10,(col+1)/3-.055,(row+1)/2-.10),dark=bool(row))
add(33,'공식 고고 기본형','mascot',(.10,.05,.49,.82));add(33,'공식 구구 기본형','mascot',(.49,.05,.90,.82))
# Native header artwork from site themes; exact existing-byte duplicates are merged during publication.
for j,x in enumerate(json.loads((B/'kovo-theme.json').read_text())):
 key='kovo-theme-'+str(x['site_id'])+'-'+x['mode'];raw=(B/x['file']).read_bytes();assert b'<svg'in raw and b'<image'not in raw;im=Image.open(B/x['preview']).convert('RGBA');im.save(O/(key+'.png'));(O/(key+'.svg')).write_bytes(raw);out.append({**x,'key':key,'label':'공식 구단 SVG 로고'+(' · 다크용'if x['mode']=='DARK'else''),'form':'emblem','dark':x['mode']=='DARK','campaign':False,'vector':True,'selected_size':im.size,'name':Path(x['file']).name})
(B/'kovo-selected.json').write_text(json.dumps(out,ensure_ascii=False,indent=2))
for start in range(0,len(out),24):
 batch=out[start:start+24];sheet=Image.new('RGB',(1000,((len(batch)+3)//4)*200),'#ccc');d=ImageDraw.Draw(sheet)
 for j,x in enumerate(batch):
  im=Image.open(O/(x['key']+'.png'));im.thumbnail((235,165));xx=j%4*250;yy=j//4*200;sheet.paste(im,(xx+(250-im.width)//2,yy),im);d.text((xx+3,yy+168),str(start+j)+' '+x['tcode']+' '+str(x['selected_size']),fill='black')
 sheet.save(B/('kovo-selected-'+str(start)+'.jpg'))
print(len(out))
