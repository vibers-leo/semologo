import json,zipfile,hashlib,subprocess,io
from pathlib import Path
import fitz
from PIL import Image,ImageDraw
B=Path(__file__).parent;D=B/'kleague-prepared';D.mkdir(exist_ok=True);rows=[];held=[];seen=set()
for x in json.loads((B/'kleague-packages.json').read_text()):
 if 'file'not in x:continue
 f=B/x['file'];members=[]
 if zipfile.is_zipfile(f):
  z=zipfile.ZipFile(f)
  for n in z.infolist():
   if '__MACOSX'in n.filename or n.is_dir():continue
   name=n.filename
   if not n.flag_bits&0x800:
    try:name=name.encode('cp437').decode('cp949')
    except (UnicodeError,LookupError):pass
   # AI preferred where same named PNG is present. Daejeon PDF duplicates AI.
   if name.lower().endswith('.pdf'):continue
   if name.lower().endswith('.png') and any(t.filename.rsplit('.',1)[0]==n.filename.rsplit('.',1)[0] and t.filename.lower().endswith('.ai') for t in z.infolist()):continue
   if name.lower().endswith(('.ai','.png')):members.append((name,z.read(n)))
 else:members=[(f.name,f.read_bytes())]
 for name,raw in members:
  digest=hashlib.sha256(raw).hexdigest()
  if (x['team'],digest)in seen:continue
  seen.add((x['team'],digest));stem=x['team']+'-'+digest[:16];(D/(stem+Path(name).suffix)).write_bytes(raw)
  try:
   base={**x,'member':name,'source_sha256':digest}
   if name.lower().endswith('.png'):
    im=Image.open(io.BytesIO(raw)).convert('RGBA');im.save(D/(stem+'.png'));rows.append({**base,'token':stem,'vector':False,'size':im.size});continue
   if not raw.startswith(b'%PDF'):
    pdf=D/(stem+'.pdf');subprocess.run(['gs','-q','-dSAFER','-dBATCH','-dNOPAUSE','-sDEVICE=pdfwrite','-sOutputFile='+str(pdf),str(D/(stem+Path(name).suffix))],capture_output=True,check=True,timeout=45);raw=pdf.read_bytes()
   doc=fitz.open(stream=raw,filetype='pdf')
   for i,page in enumerate(doc):
    if i>=20:break
    token=stem+'-p'+str(i);svg=page.get_svg_image(text_as_path=True);(D/(token+'.svg')).write_text(svg);scale=min(2,1400/max(page.rect.width,page.rect.height));im=Image.open(io.BytesIO(page.get_pixmap(matrix=fitz.Matrix(scale,scale),alpha=True).tobytes('png'))).convert('RGBA');im.save(D/(token+'.png'));rows.append({**base,'token':token,'vector':'<image'not in svg,'size':im.size})
  except Exception as e:held.append({'team':x['team'],'member':name,'error':str(e)[:120]})
(B/'kleague-prepared.json').write_text(json.dumps(rows,ensure_ascii=False,indent=2));(B/'kleague-held.json').write_text(json.dumps(held,ensure_ascii=False,indent=2))
for start in range(0,len(rows),20):
 batch=rows[start:start+20];sheet=Image.new('RGB',(1200,((len(batch)+3)//4)*220),'#ddd');d=ImageDraw.Draw(sheet)
 for j,x in enumerate(batch):
  im=Image.open(D/(x['token']+'.png'));im.thumbnail((290,180));xx=j%4*300;yy=j//4*220;sheet.paste(im,(xx+(300-im.width)//2,yy),im);d.text((xx+3,yy+184),str(start+j)+' '+x['team']+' V'+str(x['vector']),fill='black');d.text((xx+3,yy+201),x['member'][-36:].encode('ascii','replace').decode(),fill='black')
 sheet.save(B/('kleague-sheet-'+str(start)+'.jpg'))
print('prepared',len(rows),'held',held)
