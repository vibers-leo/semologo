#!/usr/bin/env python3
"""Convert an existing brands JSON into PostgreSQL COPY-ready NDJSON without connecting to a DB."""
import json,sys
from pathlib import Path
src=Path(sys.argv[1]) if len(sys.argv)>1 else Path('data/collection/brands-slim.json')
out=Path(sys.argv[2]) if len(sys.argv)>2 else Path('data/collection/logo-posts-migration.ndjson')
data=json.loads(src.read_text())
if isinstance(data,dict): data=data.get('brands',[])
with out.open('w') as f:
 for b in data:
  row={k:b.get(k) for k in ('id','name_ko','name_en','category','origin','logo_svg','logo_png','website','official_source_page','asset_origin','tags','related_ids','sources')}
  row.update(status='published', created_at=b.get('added_at'), updated_at=b.get('added_at'), asset_review_status='legacy-unreviewed', legacy_source=str(src))
  row['metadata']={k:v for k,v in b.items() if k not in row}
  f.write(json.dumps(row,ensure_ascii=False)+'\n')
print(f'exported {len(data)} rows to {out}')
