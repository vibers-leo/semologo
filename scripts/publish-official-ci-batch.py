#!/usr/bin/env python3
import json,shutil,datetime,re,importlib.util
from pathlib import Path
ROOT=Path(__file__).resolve().parents[1]; C=Path('/Volumes/Untitled/brand-logos/_clients'); SRC=ROOT/'data/collection/official-ci-review-candidates.json'; AS=ROOT/'artifacts/public-ci-assets'; date=datetime.date.today().isoformat()
def slug(s): return re.sub(r'[^0-9A-Za-z가-힣]+','-',s).strip('-').lower()
def main():
 cat=json.loads((C/'brands.json').read_text()); by={b['id']:b for b in cat['brands']}; added=[]
 for x in json.loads(SRC.read_text())['candidates']:
  bid=slug(x['id']);
  if bid in by: continue
  files=[Path(f) for f in x['candidates'] if Path(f).suffix.lower() in {'.png','.svg'}]
  zips=[Path(f) for f in x['candidates'] if Path(f).suffix.lower()=='.zip']
  if not files and not zips: continue
  if not files: continue
  src=ROOT/files[0]; d=C/bid; d.mkdir(parents=True,exist_ok=True); ext=src.suffix.lower(); shutil.copy2(src,d/('logo'+ext))
  if ext=='.png': shutil.copy2(src,d/'logo-800.png'); logo_svg=None; has_svg=False
  else: logo_svg='logo.svg'; has_svg=True
  b={'id':bid,'name_ko':x['name_ko'],'name_en':x['name_ko'],'category':'공공·기관','website':x.get('website',''),'domain':'','logo_svg':logo_svg,'logo_png':True,'has_svg':has_svg,'has_png':True,'origin':'KR','kr_kind':'공공기관','added_at':date,'official_source_page':x.get('official_source_page'),'sources':[{'provider':'official-ci-page','file':src.name,'source_url':x.get('official_source_page'),'label':'기관 공식 CI 페이지'}]}
  if zips:
   shutil.copy2(ROOT/zips[0], d/'source.zip'); b['source_zip']='source.zip'
  (d/'brand.json').write_text(json.dumps(b,ensure_ascii=False,indent=1)); variants=[{'key':'official','form':'horizontal','lang':'unknown','color':'color','label':'공식 CI','files':({'svg':'logo.svg'} if has_svg else {})|({'png':'logo.png'}),'provider':'official-ci-page','origin':'collected','order':10}]; (d/'variants.json').write_text(json.dumps({'schema':1,'algo_v':1,'id':bid,'primary':'official','variants':variants},ensure_ascii=False,indent=1)); cat['brands'].append(b); by[bid]=b; added.append(bid)
 cat['total']=len(cat['brands']); (C/'brands.json').write_text(json.dumps(cat,ensure_ascii=False,separators=(',',':')))
 spec=importlib.util.spec_from_file_location('slim',C.parent/'scripts/build-slim.py');m=importlib.util.module_from_spec(spec);spec.loader.exec_module(m);(C/'brands-slim.json').write_text(json.dumps(m.build(),ensure_ascii=False,separators=(',',':')))
 print('added',len(added),added)
if __name__=='__main__':main()
