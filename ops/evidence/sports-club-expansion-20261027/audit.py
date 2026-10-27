import runpy,json
from pathlib import Path
c=runpy.run_path('/root/projects/semologo-publisher/scripts/fleet-auto-core.py')
q="""WITH latest AS (SELECT DISTINCT ON (collection_id) * FROM semologo.collection_snapshots ORDER BY collection_id,as_of DESC,id DESC) SELECT c.id,c.name,s.id snapshot_id,s.source_url,m.member_key,m.name member_name,m.brand_id,m.metadata FROM semologo.collections c JOIN latest s ON s.collection_id=c.id JOIN semologo.collection_members m ON m.snapshot_id=s.id WHERE c.id LIKE 'sports-kr-%' ORDER BY c.id,m.name"""
def query(q):
 code='const{Pool}=require("pg");const p=new Pool({connectionString:process.env.DB_VIBERS_MAIN_URL,max:1});(async()=>{console.log(JSON.stringify((await p.query('+json.dumps(q)+')).rows));await p.end()})().catch(e=>{console.error(e.message);process.exit(1)})';return c['node']('semologo',code)
a=query(q);b=query("SELECT p.id,p.payload,v.asset_manifest FROM semologo.logo_posts p LEFT JOIN semologo.logo_versions v ON v.brand_id=p.id AND v.is_current WHERE p.status='published' AND (p.payload->>'category'='스포츠' OR p.payload->>'name_ko' ~ '(현대 모터스|스틸러스|블루윙즈|서울 이랜드|썬더스|소닉붐|프로미|레드부스터스|스카이워커스|핑크스파이더스)')")
B=Path('/root/ops/sports-expansion-20261027');B.mkdir(exist_ok=True);(B/'rosters.json').write_text(json.dumps(a,ensure_ascii=False,indent=2));(B/'catalog.json').write_text(json.dumps(b,ensure_ascii=False,indent=2));print(json.dumps({'roster_collections':sorted(set(x['id']for x in a)),'members':len(a),'catalog_sports':len(b)},ensure_ascii=False))
