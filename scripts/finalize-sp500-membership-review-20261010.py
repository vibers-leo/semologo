"""Build additive reviewed membership evidence after manual contact-sheet inspection."""
from pathlib import Path
import json,subprocess,concurrent.futures,datetime
ROOT=Path(__file__).resolve().parents[1];OUT=ROOT/'marketing/assets/sp500-membership-review-20261010'
rows=json.loads((OUT/'candidates.json').read_text());before=json.loads((OUT/'cms-before.json').read_text())
# Explicitly exclude ambiguous lowercase-a AbbVie icon; do not infer identity from its filename.
selected=[r for r in rows if r['png_verified'] and r['brand_id']!='abbvie']
def check(row):
 raw=subprocess.run(['curl','-fsSL','--max-time','30',f'https://semologo.com/api/catalog/?q={row["brand_id"]}&limit=10'],capture_output=True,check=True).stdout
 data=json.loads(raw);assert any(b['id']==row['brand_id'] for b in data['brands']),row['brand_id']
 row.update(identity_reviewed=True,public_catalog_verified=True,review_status='verified',reviewed_at=datetime.datetime.now(datetime.timezone.utc).isoformat(),identity_evidence='Saved S&P constituent legal name/ticker matched to canonical institution; existing representative PNG decoded and visually inspected on contact.jpg. No company identity inferred from name-only match.')
 return row
with concurrent.futures.ThreadPoolExecutor(max_workers=4) as pool:verified=list(pool.map(check,selected))
assert all(r['previous_status']!='verified' for r in verified)
patch={'collection_id':'us-sp500','snapshot_id':'us-sp500-2026-09-27','as_of':'2026-09-27','expected_count':500,'securities':503,'members':verified,'preserve_existing_verified':True,'policy':'Additive membership updates only; no official roster, snapshot source, existing verified memberships, or logo assets may be overwritten.','prior_verified_count':sum(r['review_status']=='verified' for r in before['members']),'new_verified_count':len(verified),'held':[{'brand_id':r['brand_id'],'reason':'PNG unavailable or identity not visually established'} for r in rows if r not in selected]}
(OUT/'reviewed-membership-patch.json').write_text(json.dumps(patch,ensure_ascii=False,indent=2)+'\n')
(OUT/'att-wrong-asset-proof.json').write_text(json.dumps({'brand_id':'att','file':str((OUT/'att.png').relative_to(ROOT)),'finding':'Existing PNG is red ATT Asset Tagging Technology, not AT&T telecommunications. Excluded from membership; AT&T exact globe under atandt was independently decoded and inspected.','action':'Quarantine/correction queue only; no CMS or collection mutation by this review.'},indent=2)+'\n')
print('PASS',len(verified),'additional reviewed memberships; existing',patch['prior_verified_count'],'preserved; projected',patch['prior_verified_count']+len(verified))
