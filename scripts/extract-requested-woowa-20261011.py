"""Extract exact SVG path attributes from official homepage logo modules, without executing JS."""
import re,json,hashlib,shutil,xml.etree.ElementTree as E
from pathlib import Path
import cairosvg
R=Path(__file__).resolve().parents[1];T=R.parents[1]/'task-tmp';D=R/'marketing/assets/requested-finance-business-20261011/woowa';D.mkdir(exist_ok=True)
ns='http://www.w3.org/2000/svg';E.register_namespace('',ns)
for lang,chunk,height in [('ko','chunk-98f3ab06.0cfce595.js',31),('en','chunk-2f732b6b.0f8f24c4.js',24)]:
 source=T/f'woowa-logo-{lang}.js';shutil.copy2(source,D/chunk);text=source.read_text()
 bodies=re.findall(r'\w+\("path",\{attrs:\{(.*?)\}\}',text);assert len(bodies)==(4 if lang=='ko' else 3)
 svg=E.Element('{'+ns+'}svg',{'viewBox':f'0 0 120 {height}','width':'120','height':str(height),'fill':'none'})
 parent=E.SubElement(svg,'{'+ns+'}g',{'clip-path':'url(#clip0_19_2471)'}) if lang=='ko' else svg
 for i,b in enumerate(bodies):
  attrs={}
  for m in re.finditer(r'(?:"([\w-]+)"|(\w+)):"([^"]*)"',b):attrs[m.group(1) or m.group(2)]=m.group(3)
  assert 'd' in attrs and 'fill' in attrs
  if lang=='ko' and i==3:
   defs=E.SubElement(svg,'{'+ns+'}defs');parent=E.SubElement(defs,'{'+ns+'}clipPath',{'id':'clip0_19_2471'})
  E.SubElement(parent,'{'+ns+'}path',attrs)
 path=D/f'official-{lang}.svg';E.ElementTree(svg).write(path,encoding='utf-8',xml_declaration=True)
 cairosvg.svg2png(url=str(path),write_to=str(path.with_suffix('.png')),output_width=1600)
 print(lang,len(bodies),hashlib.sha256(path.read_bytes()).hexdigest())
(D/'provenance.json').write_text(json.dumps({'page':'https://www.woowahan.com/','observed':'2026-10-11','method':'Exact path/fill attributes extracted from official Vue SVG module; browser DOM checked; no tracing or embedded bitmap','sources':['https://woowahan-cdn.woowahan.com/static/js/chunk-98f3ab06.0cfce595.js','https://woowahan-cdn.woowahan.com/static/js/chunk-2f732b6b.0f8f24c4.js']},ensure_ascii=False,indent=2)+'\n')
