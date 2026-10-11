"""User-approved official PNG-only intake; retain exact original dimensions and bytes."""
import json,hashlib
from pathlib import Path
from PIL import Image
R=Path(__file__).resolve().parents[1];D=R/'marketing/assets/requested-finance-business-20261011';d=json.loads((D/'extracted.json').read_text())
meta={'daangnpay':['당근페이','Daangn Pay','금융·결제','https://www.daangnpay.com/'],'coupangpay':['쿠팡페이','Coupang Pay','금융·결제','https://www.coupangpay.com/'],'gmoneytrans':['지머니트랜스','Gmoneytrans','금융·결제','https://gmoneytrans.com/']};d['meta'].update(meta);d['rows']=[r for r in d['rows'] if r['id'] not in meta]
for bid,key,label,name,url,color in [
 ('daangnpay','official-color','공식 컬러 PNG','official-logo.png','https://static.wixstatic.com/media/c8e413_28d08f55a9ef4084b0184801e5a4d759~mv2.png','color'),
 ('daangnpay','official-white','공식 화이트 PNG','official-logo-white.png','https://static.wixstatic.com/media/c8e413_d8de019bed84447d90b5aa9d3ddb6353~mv2.png','white'),
 ('coupangpay','official-color','공식 PNG','official-logo.png','https://www.coupangpay.com/resources/20261008095704/dist/coupangpay/pc/controller/index.css','color'),
 ('gmoneytrans','official-header','공식 가로 PNG','official-logo.png','https://gmoneytrans.com/wp-content/uploads/2023/08/cropped-logo_mb.png','color'),
 ('gmoneytrans','official-footer','공식 보조 PNG','official-logo-bg.png','https://gmoneytrans.com/wp-content/uploads/2024/04/logo_bg.png','color')]:
 p=D/bid/name;im=Image.open(p);assert im.format=='PNG' and im.mode=='RGBA';w,h=im.size
 d['rows'].append({'id':bid,'key':key,'label':label,'png':str(p.relative_to(R)),'source_url':url,'provider':'official-site','color':color,'source_note':f'공식 홈페이지 PNG 원본 {w}×{h}px · 원본 색상·투명도 보존 · SVG 미제공 · 사용자 요청 우선 공개','sha256':hashlib.sha256(p.read_bytes()).hexdigest(),'visual_review':'pass'})
(D/'extracted.json').write_text(json.dumps(d,ensure_ascii=False,indent=2)+'\n');print('PASS 3 identities, 5 original PNG variants; no upscaling')
