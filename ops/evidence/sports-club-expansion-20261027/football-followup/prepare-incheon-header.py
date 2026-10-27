import subprocess,json,hashlib,io
from pathlib import Path
from PIL import Image
import cairosvg
B=Path(__file__).parent;P=B/'kleague-packages.json';A=B/'kleague-prepared.json';d=json.loads(P.read_text());a=json.loads(A.read_text())
for name in ['logo_K18_color.svg','logo_K18_white.svg','logo_incheon_united_color.svg']:
 u='https://www.incheonutd.com/assets/images/common/emblem/svg/'+name;raw=subprocess.run(['curl','-fsSL','--max-time','25',u],check=True,capture_output=True).stdout;assert b'<svg'in raw and b'<image'not in raw and b'data:image/'not in raw;digest=hashlib.sha256(raw).hexdigest();token='K18-'+digest[:16];file='kleague-originals/'+name;(B/file).write_bytes(raw);(B/'kleague-prepared'/(token+'.svg')).write_bytes(raw);im=Image.open(io.BytesIO(cairosvg.svg2png(bytestring=raw,output_width=1200))).convert('RGBA');im.save(B/'kleague-prepared'/(token+'.png'));x={'team':'K18','url':u,'page':'https://www.incheonutd.com/main/index.php','file':file,'sha256':digest,'bytes':len(raw)};d.append(x);a.append({**x,'member':name,'source_sha256':digest,'token':token,'vector':True,'size':im.size})
P.write_text(json.dumps(d,ensure_ascii=False,indent=2));A.write_text(json.dumps(a,ensure_ascii=False,indent=2));print('headers prepared',len(a))
