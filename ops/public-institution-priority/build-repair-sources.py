"""Publish the complete pixel-audited range to the existing priority feeder."""
import json,re,unicodedata,os
from pathlib import Path
ROOT=Path(os.environ.get('SEMOLOGO_AUDIT_ROOT',str(Path(__file__).resolve().parents[2])))
norm=lambda s:re.sub('[^가-힣a-z0-9]','',unicodedata.normalize('NFKC',s).lower().replace('주식회사','').replace('재단법인','').replace('(주)','').replace('(재)',''))
ci=json.loads((ROOT/'data/collection/public-ci-index.json').read_text())['candidates']
sites={norm(c['name_ko']):{'name':c['name_ko'],'homepage':c.get('website') or c.get('official_source_page'),'sourcePage':c.get('official_source_page')} for c in ci}
sites[norm('한국환경교육네트워크')]={'name':'한국환경교육네트워크','homepage':'https://www.keen.or.kr/',
 'sourcePage':'https://sjeec.or.kr/board/2023/04/18/1681798951_2f5bc6d72ad04b3bd9f9.pdf'}
audit=json.loads((ROOT/'ops/evidence/public-white-background-20261025/white-audit.json').read_text())
targets=[{k:r.get(k) for k in ['id','name','file','sha256','status']} for r in audit['items'] if r['status'] in ('white-background','fetch-failed')]
catalog_sites=ROOT/'ops/public-institution-priority/catalog-source-sites.json'
out={'checkedAt':audit['checkedAt'],'sitesById':json.loads(catalog_sites.read_text()) if catalog_sites.exists() else {},'scope':{'start':'한국국제보건의료재단','end':'한국환경교육네트워크',
 'category':'공공·기관','sort':'fame','rangeTotal':audit['rangeTotal'],'checked':audit['checked'],
 'pngOnly':audit['pngOnly'],'white':audit['white'],'unavailable':audit['failures']},'sites':sites,'targets':targets}
path=ROOT/'ops/public-institution-priority/repair-sources.json';path.write_text(json.dumps(out,ensure_ascii=False,indent=2)+'\n')
print(json.dumps({'targets':len(targets),'knownOfficialNames':sum(norm(t['name']) in sites for t in targets),'scope':out['scope']},ensure_ascii=False))
