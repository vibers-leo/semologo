"""Publish reviewed staged assets locally, producing an exact bucket upload manifest.
Run only after visual review and recording excluded candidates in publish-review.json.
"""
import json,shutil,datetime,importlib.util
from pathlib import Path
ROOT=Path(__file__).resolve().parents[1];W=ROOT/'artifacts/ai-svg-collection';C=Path('/Volumes/Untitled/brand-logos/_clients')
def main():
 report=json.loads((W/'publish-review.json').read_text());rows=report['approved'];date=datetime.date.today().isoformat()
 catalog=json.loads((C/'brands.json').read_text());bm={b['id']:b for b in catalog['brands']};idx=json.loads((C/'variants-index.json').read_text());files=set();back=W/'before';back.mkdir(exist_ok=True)
 def backup(p):
  if p.exists():
   t=back/p.relative_to(C);t.parent.mkdir(parents=True,exist_ok=True)
   if not t.exists():shutil.copy2(p,t)
 def save(p,obj,pretty=False):
  backup(p);p.parent.mkdir(parents=True,exist_ok=True);p.write_text(json.dumps(obj,ensure_ascii=False,indent=1 if pretty else None,separators=None if pretty else (',',':')));files.add(str(p.relative_to(C)))
 grouped={}
 for r in rows:grouped.setdefault(r['id'],[]).append(r)
 for bid,assets in grouped.items():
  d=C/bid;new=bid not in bm
  if new:
   first=assets[0];bm[bid]=dict(id=bid,name_ko=first['title'],name_en=first['title'],category='IT·테크',website=first['website'],domain='',logo_svg='logo.svg',logo_png=True,has_svg=True,has_png=True,added_at=date,svg_source=first['provider'],sources=[])
   catalog['brands'].append(bm[bid])
  b=bm[bid];vp=d/'variants.json'
  v=json.loads(vp.read_text()) if vp.exists() else dict(schema=1,algo_v=1,id=bid,primary='original' if not new else '',variants=[])
  if not v['variants'] and not new:v['variants']=[dict(key='original',form='unknown',lang='unknown',color='color',label='기존 로고',files={**({'svg':'logo.svg'} if b.get('logo_svg') or b.get('has_svg') else {}),**({'png':'logo.png'} if b.get('logo_png') or b.get('has_png') else {})},origin='collected',order=0)]
  for r in assets:
   rel=r['rel'];src=W/'stage'/bid/rel
   for p in [src,src.with_suffix('.png')]:
    target=d/p.relative_to(W/'stage'/bid);backup(target);target.parent.mkdir(parents=True,exist_ok=True);shutil.copy2(p,target);files.add(str(target.relative_to(C)))
   key=r['provider']+'-'+Path(rel).stem;label=('Lobe Icons' if r['provider']=='lobe' else 'SVGL')+' · '+('워드마크' if r['form']=='wordmark' else '심볼' if r['form']=='symbol' else '가로형')
   item=dict(key=key,form=r['form'],lang='unknown',color='color',label=label,files=dict(svg=rel,png=str(Path(rel).with_suffix('.png'))),aspect=r['aspect'],provider=r['provider'],origin='collected',order=100+len(v['variants']))
   v['variants']=[x for x in v['variants'] if x['key']!=key]+[item]
   if not v['primary']:v['primary']=key
   source=dict(provider=r['provider'],file=rel,label=label,source_url=r['website'],collected_at=date,upstream_commit=report['upstreams']['lobe-icons' if r['provider']=='lobe' else 'svgl'],current_status='upstream-current; brand redesign date not asserted')
   b['sources']=[x for x in b.get('sources',[]) if x.get('file')!=rel]+[source]
  if new:
   primary=next((r for r in assets if r['form'] in ['wordmark','horizontal']),assets[0]);src=W/'stage'/bid/primary['rel']
   for suffix,name in [('.svg','logo.svg'),('.png','logo.png'),('.png','logo-800.png')]:
    shutil.copy2(src.with_suffix(suffix),d/name);files.add(str((d/name).relative_to(C)))
   v['primary']=primary['provider']+'-'+Path(primary['rel']).stem
  save(d/'brand.json',b,True);save(vp,v,True)
  idx['brands'][bid]={'n':len(v['variants']),'forms':sorted({x['form'] for x in v['variants']})}
 idx['count']=len(idx['brands']);save(C/'variants-index.json',idx);save(C/'brands.json',catalog)
 spec=importlib.util.spec_from_file_location('slim',C.parent/'scripts/build-slim.py');mod=importlib.util.module_from_spec(spec);spec.loader.exec_module(mod);save(C/'brands-slim.json',mod.build())
 visible=[b for b in catalog['brands'] if not b.get('hidden') and not b.get('variant_of')]
 save(C/'stats.json',dict(total=len(catalog['brands']),visible=len(visible),svg=sum(bool(b.get('logo_svg') or b.get('has_svg')) for b in visible),kr=sum(b.get('origin')=='KR' for b in visible)))
 (W/'upload-files.json').write_text(json.dumps(sorted(files),indent=2));print('prepared',len(rows),'variants',len(grouped),'brands',len(files),'files')
if __name__=='__main__':main()
