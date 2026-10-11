"""Extract only supplied official vector artwork; retain untouched originals."""
from pathlib import Path
import json,hashlib,re,xml.etree.ElementTree as E
import fitz,cairosvg
from PIL import Image,ImageDraw
R=Path(__file__).resolve().parents[1];D=R/'marketing/assets/requested-finance-business-20261011'; rows=[]
meta={'jbbank':('전북은행','Jeonbuk Bank','금융·결제','https://www.jbbank.co.kr/bank_info_coid_intr.act?_MENU_PRJ_TYPE_=INTRODUCE'),'unipost':('유니포스트','UNIPOST','IT·테크','https://unipost.co.kr/'),'roumit':('로움아이티','roumiT','IT·테크','https://www.roumit.com/'),'firfin':('퍼핀','firfin','금융·결제','https://www.firfin.family/'),'nicednr':('NICE디앤알','NICE D&R','IT·테크','https://www.nicednr.co.kr/ko/index.do')}
def add(bid,key,label,raw,source):
 d=D/bid/'reviewed'/key;d.mkdir(parents=True,exist_ok=True);s=d/'logo.svg';p=d/'logo.png';E.fromstring(raw);assert not re.search(rb'<(?:image|script|foreignObject)\b|data:image|onload\s*=',raw,re.I);s.write_bytes(raw);cairosvg.svg2png(bytestring=raw,write_to=str(p),output_width=1600)
 im=Image.open(p).convert('RGBA');assert im.getextrema()[3][0]==0
 rows.append(dict(id=bid,key=key,label=label,svg=str(s.relative_to(R)),png=str(p.relative_to(R)),source_url=source,sha256=hashlib.sha256(raw).hexdigest(),visual_review='pending'))
for bid in ['unipost','roumit','nicednr']:
 add(bid,'official-ko','공식 로고', (D/bid/'logo.svg').read_bytes(),{'unipost':'https://unipost.co.kr/portal/resources/design/v1/images/logo-unipost.svg','roumit':'https://www.roumit.com/img/logo_roumit.svg','nicednr':'https://www.nicednr.co.kr/images/common/logo_kr_bl.svg'}[bid])
add('firfin','official-ko-character','국문 로고 · 캐릭터 조합',(D/'firfin/inline-0.svg').read_bytes(),meta['firfin'][3])
doc=fitz.open(D/'jbbank/original-0.ai');raw=doc[0].get_svg_image(text_as_path=True)
for key,label,box in [('signature-ko-horizontal','국문 가로 조합',(291,307,551,364)),('signature-ko-vertical','국문 세로 조합',(320,617,522,787)),('symbol','심볼',(291,307,347,364))]:
 root=E.fromstring(raw);x,y,x1,y1=box;root.set('viewBox',f'{x} {y} {x1-x} {y1-y}');root.set('width',str(x1-x));root.set('height',str(y1-y));add('jbbank',key,label,E.tostring(root),meta['jbbank'][3])
sheet=Image.new('RGB',(1200,260*((len(rows)+2)//3)),'#eeeeef');draw=ImageDraw.Draw(sheet)
for i,row in enumerate(rows):
 im=Image.open(R/row['png']).convert('RGBA');im.thumbnail((370,210));x=i%3*400;y=i//3*260;sheet.paste(im,(x+(400-im.width)//2,y+20+(210-im.height)//2),im);draw.text((x+10,y+238),row['id']+' / '+row['key'],fill='black')
sheet.save(D/'contact-reviewed.png');(D/'extracted.json').write_text(json.dumps({'meta':meta,'rows':rows},ensure_ascii=False,indent=2)+'\n');print('Extracted',len(rows),'variants across',len(meta),'identities')
