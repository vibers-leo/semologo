import runpy,json,copy,urllib.parse
from pathlib import Path
h=runpy.run_path('/root/ops/kbo-complete-20261027/publish-helpers.py');globals().update({k:v for k,v in h.items()if not k.startswith('__')});B=Path('/root/ops/sports-expansion-20261027');receipts=[]
for x in json.loads((B/'official-sites-verified.json').read_text()):
 assert x['verified']and x['status']=='200';ident=x['id'];old=p['current'](c['node'],ident);assert old;payload=old['payload'];meta=payload.get('metadata')or{}
 if payload.get('website')or payload.get('domain')or meta.get('website')or meta.get('domain'):receipts.append({'id':ident,'existing_site_preserved':True});continue
 mf=copy.deepcopy((old['asset_manifest']or{}).get('variants')or json.loads(p['get'](s,'_clients/'+ident+'/variants.json')or b'{"schema":1,"variants":[]}'));r=commit(ident,old,mf,{'website':x['url'],'domain':urllib.parse.urlparse(x['url']).hostname,'official_website_verified_at':now});after=p['current'](c['node'],ident);assert after['payload'].get('presentation')==payload.get('presentation');assert after['payload'].get('metadata',{}).get('hidden')==meta.get('hidden');receipts.append(r)
(B/'official-sites-link-receipt.json').write_text(json.dumps(receipts,ensure_ascii=False,indent=2));print('sites added',sum(x.get('published',False)for x in receipts),'existing preserved',sum(x.get('existing_site_preserved',False)for x in receipts))
