"""Standardize supplied snapshot rosters; CDN proof is required for PNG completion."""
from pathlib import Path
import json,re,hashlib
R=Path(__file__).resolve().parents[1];A=R/'marketing/assets';out={'checked_at':'2026-10-10','collections':[]}
def collection(id,name,directory,source_name,raw_members,release,revision,scope):
 d=A/directory;proof={}
 for filename in ['cdn-verification.json','cdn-verified.json']:
  if (d/filename).exists():
   p=json.loads((d/filename).read_text());p=p if isinstance(p,list) else p.get('objects',p.get('results',[]))
   if isinstance(p,list):
    for x in p:
     if isinstance(x,dict) and (x.get('cdn_verified') or x.get('status')=='verified'):proof[x.get('key')]=x.get('sha256')
 uploads=json.loads((d/'uploads.json').read_text());members=[]
 for key,n,bid,details in raw_members:
  pngs=[x for x in uploads if x['id']==bid and x['file'].endswith('.png')];verified=bool(bid and pngs and all(proof.get(x['key'])==x['sha256'] for x in pngs))
  members.append({'member_key':key,'name':n,'brand_id':bid,'candidates':[],'identity_reviewed':bool(bid),'png_verified':verified,**details})
 out['collections'].append({'id':id,'name':name,'sector':'community','source_kind':'community_export_snapshot','source_url':'','as_of':'2026-10-10','count_unit':'entity','total':len(members),'verified':sum(m['png_verified'] for m in members),'candidates':sum(bool(m['brand_id']) and not m['png_verified'] for m in members),'roster_status':'community_snapshot_reviewed_scope','source_file':source_name,'source_revision':revision,'scope_note':scope,'members':members})
d=A/'figma-vietnam-collection-20261010';raw=json.loads((d/'community-roster.json').read_text());rel=json.loads((d/'release.json').read_text());names={x['name'].casefold():x['id'] for x in json.loads((d/'extracted.json').read_text()) if x['id'] in rel['variants']};members=[]
for m in raw['members']:
 name=m['name'] or f"이름 미확인 ({m['section']} {m['row']}행)";members.append((f"vietnam-{m['section']}-{m['row']:02}",name,names.get(name.casefold()),{'snapshot_section':m['section'],'snapshot_row':m['row'],'name_status':'unidentified' if not m['name'] else 'visual-label-read','current_operating_status_verified':False}))
collection('community-vietnam-bank-wallet-20261010','베트남 은행·월렛 커뮤니티 수록 모음','figma-vietnam-collection-20261010','Vietnam Bank & Mobile Wallet Logos (Community).svg',members,rel,raw['source_svg_sha256'],'사용자 제공 SVG의 은행·결제망 64행과 월렛·결제서비스 20행이에요. 82개 이름을 읽었고 2개 행은 이름 미확인이에요. 해외 본점 은행·과거 브랜드를 포함하며 베트남 공식 현재 영업기관 명부가 아니에요. 변형 3열을 별도 기관으로 세지 않았어요.')
d=A/'figma-car-collection-20261010';raw=json.loads((d/'collection-roster.json').read_text());rel=json.loads((d/'release.json').read_text());ids=set(rel['variants']);normalize=lambda s:re.sub('[^a-z0-9]','',s.lower());mapping={normalize(x):x for x in ids};members=[(f'car-{i+1:03}',name,mapping.get(normalize(name)),{'name_status':'source-filename','current_operating_status_verified':False}) for i,name in enumerate(raw['names'])];assert len(members)==326 and sum(bool(x[2]) for x in members)==16
collection('community-car-brands-20261010','자동차 브랜드 커뮤니티 수록 모음','figma-car-collection-20261010','Car Brands Logos (Community).zip',members,rel,json.loads((d/'intake.json').read_text())['sha256'],'사용자 제공 ZIP의 고유 브랜드 파일명 326개를 기준으로 한 스냅샷이에요. 제조사·튜너·과거 브랜드를 포함하며 현재 자동차 제조사 전수 명부가 아니에요. 초기 검수 16개만 콘텐츠에 연결하고 나머지는 이름 후보로 유지해요. 같은 브랜드의 변형 파일은 별도 기관으로 세지 않았어요.')
p=R/'data/collection/figma-community-rosters-20261010.json';p.write_text(json.dumps(out,ensure_ascii=False,indent=2)+'\n');print([(x['id'],x['total'],x['verified'],x['candidates']) for x in out['collections']])
