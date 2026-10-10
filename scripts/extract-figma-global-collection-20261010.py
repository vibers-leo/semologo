"""Split user-provided anonymous Figma SVG; no automatic brand mapping/publication."""
import copy,hashlib,json,re,argparse
from pathlib import Path
from collections import Counter
from lxml import etree as E
ROOT=Path(__file__).resolve().parents[1]
parser=argparse.ArgumentParser();parser.add_argument('--source',type=Path,default=Path('/Users/juuuno/Downloads/1,400 SVG Logos Collection (1,439 components) (Community).svg'));parser.add_argument('--out',default='figma-global-collection-20261010');args=parser.parse_args()
OUT=ROOT/'marketing/assets'/args.out;OUT.mkdir(exist_ok=True)
source=args.source;raw=source.read_bytes();(OUT/'source.svg').write_bytes(raw)
r=E.fromstring(raw,E.XMLParser(resolve_entities=False,no_network=True));ns='http://www.w3.org/2000/svg';ids={x.get('id'):x for x in r.iter() if x.get('id')};refpat=re.compile(r'url\(#([^\)]+)\)|(?:href=[\"\'])#([^\"\']+)')
def refs(e):return {a or b for a,b in refpat.findall(E.tostring(e).decode())}
items=[];skipped=[]
for top_index,g in enumerate(r):
 if E.QName(g).localname!='g' or not g.get('clip-path'):continue
 clipid=g.get('clip-path')[5:-1];clip=ids.get(clipid);rects=[] if clip is None else list(clip)
 if len(rects)!=1 or E.QName(rects[0]).localname!='rect':skipped.append({'top_index':top_index,'reason':'nonrectangular clip'});continue
 rect=rects[0];t=rect.get('transform','');m=re.fullmatch(r'translate\(([-\d.]+)(?:[ ,]+([-\d.]+))?\)',t)
 if t and not m:skipped.append({'top_index':top_index,'reason':'unsupported clip transform','transform':t});continue
 x=float(rect.get('x',0))+(float(m[1]) if m else 0);y=float(rect.get('y',0))+(float(m[2] or 0) if m else 0);w=float(rect.get('width'));h=float(rect.get('height'))
 needed=refs(g);todo=list(needed);missing=[]
 while todo:
  key=todo.pop()
  if key not in ids:missing.append(key);continue
  for dep in refs(ids[key])-needed:needed.add(dep);todo.append(dep)
 svg=E.Element('{'+ns+'}svg',nsmap={None:ns,'xlink':'http://www.w3.org/1999/xlink'},width=str(w),height=str(h),viewBox=f'{x:g} {y:g} {w:g} {h:g}',fill=r.get('fill','none'))
 defs=E.SubElement(svg,'{'+ns+'}defs')
 # Include only dependency roots; nested IDs are already retained with their ancestor.
 for key in sorted(needed):
  if key in ids and not any(a.get('id') in needed for a in ids[key].iterancestors()):defs.append(copy.deepcopy(ids[key]))
 svg.append(copy.deepcopy(g));body=E.tostring(svg,xml_declaration=True,encoding='UTF-8');index=len(items)+1;name=f'item-{index:04d}';d=OUT/'items'/name;d.mkdir(parents=True,exist_ok=True);(d/'logo.svg').write_bytes(body)
 tags=Counter(E.QName(z).localname for z in svg.iter());external=[v for z in svg.iter() for k,v in z.attrib.items() if 'href' in k and not v.startswith('#')]
 items.append({'id':name,'top_index':top_index,'clip_id':clipid,'bounds':[x,y,w,h],'svg':str((d/'logo.svg').relative_to(ROOT)),'sha256':hashlib.sha256(body).hexdigest(),'dependencies':sorted(needed),'missing_refs':missing,'tags':dict(tags),'external_refs':external,'status':'anonymous-needs-brand-review','quality_flags':[flag for flag,yes in [('filter',tags['filter']),('raster',tags['image']),('external',[u for u in external if not u.startswith('data:image/')]),('missing-reference',missing)] if yes]})
report={'source_name':source.name,'source_sha256':hashlib.sha256(raw).hexdigest(),'source_bytes':len(raw),'source_viewBox':r.get('viewBox'),'top_level_tags':dict(Counter(E.QName(z).localname for z in r)),'extracted':len(items),'skipped':skipped,'items':items,'publication':'none; anonymous content not automatically registered'};(OUT/'analysis.json').write_text(json.dumps(report,ensure_ascii=False,indent=2));print('Extracted',len(items),'rect-clipped groups; skipped',len(skipped),flush=True)
