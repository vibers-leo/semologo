#!/usr/bin/env python3
"""Audit local submission assets that are served directly by the catalog."""
import json,re
from pathlib import Path
ROOT=Path(__file__).resolve().parents[1]
rows=[]
for p in (ROOT/'public/submissions').rglob('*'):
 if not p.is_file() or p.suffix.lower() not in {'.svg','.png','.jpg','.jpeg','.webp'}: continue
 row={'file':str(p.relative_to(ROOT)),'format':p.suffix.lower()[1:],'bytes':p.stat().st_size,'exists':True,'status':'ok'}
 if p.suffix.lower()=='.svg':
  s=p.read_text(errors='ignore'); low=s.lower(); row['svg_valid']=('<svg' in low[:4096] and '<script' not in low and '<foreignobject' not in low)
  row['white_paints']=len(re.findall(r'(?:fill|stroke)=["\'](?:#fff(?:fff)?|white)["\']',low))
  row['suggested_background']='dark' if row['white_paints'] else 'light'
  if not row['svg_valid']: row['status']='review'
 else: row['suggested_background']='light'
 rows.append(row)
out={'schema':1,'generated_at':'2026-09-29','scope':'public/submissions served assets','count':len(rows),'ok':sum(x['status']=='ok' for x in rows),'review':sum(x['status']=='review' for x in rows),'assets':rows}
(ROOT/'data/collection/served-logo-asset-audit.json').write_text(json.dumps(out,ensure_ascii=False,indent=2)+'\n')
print('audited',len(rows),'ok',out['ok'],'review',out['review'])
