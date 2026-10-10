import json,sys
from pathlib import Path
from PIL import Image,ImageDraw
ROOT=Path(__file__).resolve().parents[1];OUT=ROOT/'marketing/assets'/(sys.argv[1] if len(sys.argv)>1 else 'figma-global-collection-20261010');r=json.loads((OUT/'analysis.json').read_text());items=r['items']
for start in range(0,len(items),64):
 sheet=Image.new('RGB',(1600,8*130),'#ddd');d=ImageDraw.Draw(sheet)
 for n,item in enumerate(items[start:start+64]):
  x=n%8*200;y=n//8*130;f=OUT/'items'/item['id']/'preview.png'
  if f.exists():
   im=Image.open(f).convert('RGBA');im.thumbnail((94,100))
   for j,c in enumerate(['#eee','#222']):
    bg=Image.new('RGBA',(98,105),c);bg.alpha_composite(im,((98-im.width)//2,(105-im.height)//2));sheet.paste(bg.convert('RGB'),(x+j*100,y))
  d.text((x,y+110),item['id'],fill='black')
 sheet.save(OUT/f'contact-{start//64+1:02d}.jpg',quality=90)
print('Contact sheets',((len(items)+63)//64))
