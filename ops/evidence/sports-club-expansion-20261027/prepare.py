import zipfile,json,hashlib,io,re,subprocess
from pathlib import Path
import fitz
from PIL import Image,ImageDraw
B=Path(__file__).parent;D=B/'prepared';D.mkdir(exist_ok=True);rows=[];held=[]
packages=[('jeonbuk',B/'jeonbuk-official-2025-2026.zip','https://hyundai-motorsfc.com/club','https://jbhd-upload-file.s3.ap-northeast-2.amazonaws.com/uploadFile/MotorsEmblem_2025_2026.zip')]+[('pohang',B/'originals'/a['name'],'https://www.steelers.co.kr/club/'+('mascot' if 'mascot' in a['name'] else 'emblem'),a['url'])for a in json.load(open(B/'pohang-downloads.json'))]
for team,p,page,url in packages:
 z=zipfile.ZipFile(p)
 for n in z.infolist():
  if not n.filename.lower().endswith(('.ai','.pdf')) or '__MACOSX' in n.filename:continue
  raw=z.read(n);token=team+'-'+hashlib.sha256(raw).hexdigest()[:14];(D/(token+'.ai')).write_bytes(raw)
  try:
   if not raw.startswith(b'%PDF'):
    out=D/(token+'.pdf');subprocess.run(['gs','-q','-dSAFER','-dBATCH','-dNOPAUSE','-sDEVICE=pdfwrite','-sOutputFile='+str(out),str(D/(token+'.ai'))],capture_output=True,check=True,timeout=30);raw=out.read_bytes()
   doc=fitz.open(stream=raw,filetype='pdf')
   for i,pdfpage in enumerate(doc):
    if i>=25:break
    svg=pdfpage.get_svg_image(text_as_path=True);stem=token+'-p'+str(i);(D/(stem+'.svg')).write_text(svg);scale=min(1.5,1500/max(pdfpage.rect.width,pdfpage.rect.height));im=Image.open(io.BytesIO(pdfpage.get_pixmap(matrix=fitz.Matrix(scale,scale),alpha=True).tobytes('png'))).convert('RGBA');im.save(D/(stem+'.png'));rows.append({'team':team,'member':n.filename,'package':str(p.relative_to(B)),'source_url':url,'source_page':page,'source_sha256':hashlib.sha256(z.read(n)).hexdigest(),'token':stem,'vector':'<image' not in svg,'size':im.size})
  except Exception as e:held.append([n.filename,str(e)[:160]])
(B/'prepared.json').write_text(json.dumps(rows,ensure_ascii=False,indent=2));(B/'held.json').write_text(json.dumps(held,ensure_ascii=False,indent=2))
for start in range(0,len(rows),24):
 batch=rows[start:start+24];sheet=Image.new('RGB',(1000,((len(batch)+3)//4)*220),'#ccc');d=ImageDraw.Draw(sheet)
 for j,x in enumerate(batch):
  im=Image.open(D/(x['token']+'.png'));im.thumbnail((235,170));xx=j%4*250;yy=j//4*220;sheet.paste(im,(xx+(250-im.width)//2,yy),im);d.text((xx+3,yy+175),str(start+j)+' '+x['member'][-26:].encode('ascii','replace').decode(),fill='black');d.text((xx+3,yy+193),str(x['size'])+' V'+str(x['vector']),fill='black')
 sheet.save(B/('sheet-'+str(start)+'.jpg'))
print(len(rows),held)
