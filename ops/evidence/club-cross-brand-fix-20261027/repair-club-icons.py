import runpy,json,copy,io
from pathlib import Path
import cairosvg
from PIL import Image
h=runpy.run_path('/root/ops/kbo-complete-20261027/publish-helpers.py');globals().update({k:v for k,v in h.items()if not k.startswith('__')});B=Path('/root/ops/sports-expansion-20261027/cross-brand');out=[]
for ident in ['aipeppers','kaljumbos','gsvolleyball']:
 old=p['current'](c['node'],ident);payload=old['payload'];raw=p['get'](s,'_clients/'+ident+'/'+payload['logo_svg']);assert raw and b'<image'not in raw;im=Image.open(io.BytesIO(cairosvg.svg2png(bytestring=raw,output_width=1024))).convert('RGBA');bb=im.getchannel('A').getbbox();assert bb;im=im.crop(bb);im.thumbnail((896,896));canvas=Image.new('RGBA',(1024,1024));canvas.alpha_composite(im,((1024-im.width)//2,(1024-im.height)//2));buf=io.BytesIO();canvas.save(buf,format='PNG');data=buf.getvalue();file='sources/corrected-club-icon-20261027/'+sha(data)[:24]+'.png';p['put'](s,'_clients/'+ident+'/'+file,data,'image/png',sha);p['cdn_check'](ident,file,data);mf=copy.deepcopy(old['asset_manifest']['variants']);out.append(commit(ident,old,mf,{'icon_png':file,'official_source_page':payload.get('official_source_page')}))
(B/'icon-repair-receipt.json').write_text(json.dumps(out,ensure_ascii=False,indent=2));print(out)
