"""Retain secondary-source EPS attribution; compare against official SK Securities artwork."""
import fitz,json,hashlib,xml.etree.ElementTree as E,cairosvg,zipfile
from pathlib import Path
D=Path('marketing/assets/requested-finance-business-20261011');P=D/'sk-securities';d=fitz.open(P/'secondary-original.pdf');page=d[0];assert not page.get_images();raw=page.get_svg_image(text_as_path=True);data=json.loads((D/'extracted.json').read_text());data['meta']['sk-securities']=['SK증권','SK Securities','금융·결제','https://www.sks.co.kr/main/index.cmd']
with zipfile.ZipFile(P/'secondary-original.zip','w',compression=zipfile.ZIP_DEFLATED) as z:z.write(P/'secondary-original.eps','SK securities.eps')
for lang,label,cond in [('ko','국문 조합',lambda y:y>170),('en','영문 조합',lambda y:y<170)]:
 rect=fitz.Rect()
 for x in page.get_drawings():
  if cond((x['rect'].y0+x['rect'].y1)/2):rect|=x['rect']
 rect+=(-3,-3,3,3);root=E.fromstring(raw);root.set('viewBox',f'{rect.x0} {rect.y0} {rect.width} {rect.height}');root.set('width',str(rect.width));root.set('height',str(rect.height));folder=P/'reviewed'/lang;folder.mkdir(parents=True,exist_ok=True);svg=folder/'logo.svg';png=folder/'logo.png';svg.write_bytes(E.tostring(root));cairosvg.svg2png(bytestring=svg.read_bytes(),write_to=str(png),output_width=1600)
 data['rows'].append(dict(id='sk-securities',key='secondary-'+lang,label=label+' · 출처 표기 수집본',svg=str(svg),png=str(png),source_url='https://muesign.tistory.com/152',sha256=hashlib.sha256(svg.read_bytes()).hexdigest(),visual_review='pending',provider='attributed-secondary-source',source_note='ILUO 공개 EPS 수집본 · 공식 SK증권 홈페이지 로고와 형태 대조 · 공식 배포 파일로 단정하지 않음'))
(D/'extracted.json').write_text(json.dumps(data,ensure_ascii=False,indent=2)+'\n')
