#!/usr/bin/env python3
"""Bulk domain candidate pass for the Russell 2000 queue.

This is a discovery pass only: reachable guessed domains are marked as
domain-candidate and still require official-site review before publication.
"""
import concurrent.futures, json, re
from pathlib import Path
from urllib.parse import quote
from urllib.request import Request, urlopen

P=Path('data/collection/us-equity-index-logo-queue.json')
def slug(s):
    s=re.sub(r'[^a-z0-9]+','',s.lower())
    for suffix in ('classa','classb','inc','corp','corporation','holdings','company','plc','reit','limited'):
        if s.endswith(suffix): s=s[:-len(suffix)]
    return s
def candidates(x):
    t=x['ticker'].replace(' ','').lower(); s=slug(x['company_name'])
    return list(dict.fromkeys([f'{s}.com',f'{t}.com',f'{s}inc.com']))
def check(dom):
    try:
        r=urlopen(Request('https://'+dom+'/',headers={'User-Agent':'SemoLogo-domain-discovery/1.0'}),timeout=5)
        return dom, getattr(r,'status',200)
    except Exception: return dom,None
d=json.loads(P.read_text()); q=next(x for x in d['queues'] if x['id']=='us-russell-2000')
todo=[x for x in q['items'] if not x.get('official_domain')]
domains=[]
for x in todo:
    for dom in candidates(x): domains.append((x,dom))
with concurrent.futures.ThreadPoolExecutor(max_workers=32) as ex:
    res=dict(ex.map(check,[dom for _,dom in domains]))
found=0
for x in todo:
    hit=next((dom for dom in candidates(x) if res.get(dom)),None)
    if hit:
        x['domain_candidate']=hit; x['status']='domain-candidate'; found+=1
q['domain_candidate_count']=sum(1 for x in q['items'] if x.get('domain_candidate'))
P.write_text(json.dumps(d,ensure_ascii=False,indent=2)+'\n')
print('checked',len(domains),'candidate_hits',found,'total_candidates',q['domain_candidate_count'])
