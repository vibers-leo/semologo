"""Append official raster originals to existing clubs; never claim raster as SVG."""
from pathlib import Path
import json,subprocess,hashlib,datetime,concurrent.futures,io
from PIL import Image,ImageDraw
R=Path(__file__).resolve().parents[1];D=R/'marketing/assets/baseball-official-20261012';O=D/'release-png';O.mkdir(exist_ok=True);(D/'kbo').mkdir(exist_ok=True)
teams=[('LG','lg-twins','LG 트윈스'),('HH','hanwhaeagles','한화 이글스'),('SK','ssglanders','SSG 랜더스'),('SS','samsung-lions','삼성 라이온즈'),('NC','ncdinos','NC 다이노스'),('KT','kt-wiz','KT 위즈'),('LT','lotte-giants','롯데 자이언츠'),('HT','kia-tigers','KIA 타이거즈'),('OB','doosan-bears','두산 베어스'),('WO','heroes','키움 히어로즈'),('DB','yokohama-dena-baystars','요코하마 DeNA 베이스타스')]
def get(t):
 code,id,name=t;url='https://6ptotvmi5753.edge.naverncp.com/KBO_IMAGE/emblem/regular/fixed/emblem_'+code+'.png' if code!='DB' else 'https://asset.baystars.co.jp/images/common/logo.png';p=D/'kbo'/f'{code}.png';subprocess.run(['curl','--http1.1','-fsSL','--retry','2','--max-time','30',url,'-o',str(p)],check=True);im=Image.open(p).convert('RGBA');return {'code':code,'id':id,'name':name,'url':url,'width':im.width,'height':im.height}
with concurrent.futures.ThreadPoolExecutor(max_workers=4)as pool:proof=list(pool.map(get,teams))
(D/'kbo/downloaded.json').write_text(json.dumps(proof,ensure_ascii=False,indent=2))
sheet=Image.new('RGB',(1100,660),'#ddd');draw=ImageDraw.Draw(sheet)
for i,t in enumerate(proof):
 im=Image.open(D/'kbo'/f"{t['code']}.png").convert('RGBA');im.thumbnail((240,165));x=(i%4)*275;y=(i//4)*220;sheet.paste(im,(x+(275-im.width)//2,y+30),im);draw.text((x+8,y+8),t['code']+' '+str(t['width'])+'x'+str(t['height']),fill='black')
sheet.save(D/'kbo/review.jpg');print('DOWNLOADED',len(proof),'requires visual approval before release')
