#!/usr/bin/env python3
"""Idempotent CMS publication for conservatively auto-screened official SVGs."""
import json
import io
from datetime import datetime,timezone
from urllib.request import Request,urlopen

from botocore.exceptions import ClientError
from PIL import Image

BUCKET='vibers-bucket'
CDN='https://logo.vibers.co.kr/_clients'


def light_artwork(png):
    with Image.open(io.BytesIO(png)) as opened:
        image=opened.convert('RGBA')
    image.thumbnail((400,400))
    visible=[(r,g,b) for r,g,b,a in image.get_flattened_data() if a>128]
    if not visible:return False
    bright=sum((.299*r+.587*g+.114*b)>205 for r,g,b in visible)/len(visible)
    dark=sum(max(r,g,b)<90 for r,g,b in visible)/len(visible)
    return bright>.65 and dark<.12


def get(s3,key):
    try:return s3.get_object(Bucket=BUCKET,Key=key)['Body'].read()
    except ClientError as error:
        if error.response.get('Error',{}).get('Code') in ('404','NoSuchKey','NotFound'):return None
        raise


def put(s3,key,raw,mime,sha,mutable=False):
    old=get(s3,key)
    if old is not None and old!=raw and not mutable:raise ValueError('immutable_bucket_conflict:'+key)
    if old!=raw:
        s3.put_object(Bucket=BUCKET,Key=key,Body=raw,ACL='public-read',ContentType=mime,
                      CacheControl='public,max-age=300' if mutable else 'public,max-age=31536000,immutable',
                      Metadata={'sha256':sha(raw)})
    if get(s3,key)!=raw:raise ValueError('bucket_readback_failed:'+key)


def cdn_check(ident,path,expected):
    url=f'{CDN}/{ident}/{path}?v=auto-fleet-{len(expected)}'
    req=Request(url,headers={'User-Agent':'Mozilla/5.0','Referer':'https://semologo.com/'})
    with urlopen(req,timeout=25) as response:
        if response.read()!=expected:raise ValueError('cdn_readback_failed:'+ident+'/'+path)


def current(node,ident):
    source='const id='+json.dumps(ident)+';' + r'''const{Pool}=require('pg');(async()=>{const p=new Pool({connectionString:process.env.DB_VIBERS_MAIN_URL,max:1});try{const q=await p.query("select p.id,v.id version_id,v.asset_manifest from semologo.logo_posts p join semologo.logo_versions v on v.brand_id=p.id and v.is_current where p.status='published' and p.id=$1",[id]);console.log(JSON.stringify(q.rows[0]||null))}finally{await p.end()}})().catch(e=>{console.error(e.message);process.exit(1)})'''
    return node('semologo',source)


def existing(node,s3,sha,ident,row,raw,png):
    old=current(node,ident)
    if not old:raise ValueError('existing_brand_disappeared')
    base=f'_clients/{ident}/'
    bucket=get(s3,base+'variants.json')
    bucket_manifest=json.loads(bucket) if bucket else None
    db_manifest=(old['asset_manifest'] or {}).get('variants')
    if bucket_manifest and (not isinstance(bucket_manifest.get('variants'),list) or bucket_manifest.get('id')!=ident):
        raise ValueError('malformed_existing_manifest')
    if db_manifest and bucket_manifest and db_manifest!=bucket_manifest:
        db_hashes={v.get('source_sha256') for v in db_manifest.get('variants',[])}
        bucket_hashes={v.get('source_sha256') for v in bucket_manifest.get('variants',[])}
        if sha(raw) in db_hashes and sha(raw) not in bucket_hashes:
            body=(json.dumps(db_manifest,ensure_ascii=False,separators=(',',':'))+'\n').encode()
            put(s3,base+'variants.json',body,'application/json',sha,True)
            return 'reconciled_bucket_manifest'
        raise ValueError('manifest_db_bucket_diverged')
    manifest=db_manifest or bucket_manifest
    if manifest is None:
        files={kind:'logo.'+kind for kind in ('svg','png') if get(s3,base+'logo.'+kind) is not None}
        if not files:raise ValueError('representative_missing')
        manifest={'schema':1,'algo_v':1,'id':ident,'primary':'legacy-original','variants':[
            {'key':'legacy-original','form':'unknown','label':'기존 대표 원본','files':files,'order':0,
             'review_status':'legacy-unreviewed'}]}
    if any(v.get('source_sha256')==sha(raw) for v in manifest['variants']):return 'already_present'
    if get(s3,base+'logo.svg')==raw:return 'same_as_representative'
    suffix=sha(raw)[:20]
    files={'svg':f'sources/auto-fleet/{suffix}.svg','png':f'sources/auto-fleet/{suffix}.png'}
    variant={'key':'auto-fleet-'+suffix[:12],'form':'unknown','lockup':'unknown',
             'label':'공식 사이트 로고 · 자동 검수','files':files,'preview_png':files['png'],
             'origin':'first-party-web','provider':row['domain'],'source_url':row['assetUrl'],
             'source_sha256':sha(raw),'visual_sha256':sha(png),'review_status':'auto-screened',
             'order':len(manifest['variants'])}
    updated=json.loads(json.dumps(manifest));updated['variants'].append(variant)
    for kind,body,mime in [('svg',raw,'image/svg+xml'),('png',png,'image/png')]:
        put(s3,base+files[kind],body,mime,sha)
        cdn_check(ident,files[kind],body)
    next_db={**(old['asset_manifest'] or {}),'variants':updated}
    patch={'id':ident,'version':old['version_id'],'before':old['asset_manifest'],'after':next_db}
    source='const x='+json.dumps(patch,ensure_ascii=False)+';' + r'''const{Pool}=require('pg');(async()=>{const p=new Pool({connectionString:process.env.DB_VIBERS_MAIN_URL,max:1});try{const q=await p.query("update semologo.logo_versions set asset_manifest=$2::jsonb where id=$1 and brand_id=$3 and is_current and asset_manifest is not distinct from $4::jsonb returning id",[x.version,JSON.stringify(x.after),x.id,x.before?JSON.stringify(x.before):null]);if(q.rowCount!==1)throw Error('concurrent_existing_edit');console.log(JSON.stringify({updated:x.id}))}finally{await p.end()}})().catch(e=>{console.error(e.message);process.exit(1)})'''
    node('semologo',source)
    put(s3,base+'variants.json',(json.dumps(updated,ensure_ascii=False,separators=(',',':'))+'\n').encode(),
        'application/json',sha,True)
    return 'updated_existing'


def new(node,s3,sha,ident,name,row,raw,png):
    base=f'_clients/{ident}/'
    if get(s3,base+'logo.svg') not in (None,raw):raise ValueError('new_id_bucket_conflict')
    now=datetime.now(timezone.utc).isoformat();domain=row['domain']
    category='공공·기관' if domain.endswith('.go.kr') else '교육' if domain.endswith('.ac.kr') else '브랜드'
    brand={'id':ident,'name_ko':name,'name_en':name,'category':category,
           'origin':'KR' if domain.endswith('.kr') else 'GLOBAL','has_svg':True,'has_png':True,
           'logo_svg':'logo.svg','logo_png':'logo.png','preview_png':f'{CDN}/{ident}/logo.png',
           'website':row['pageUrl'],'domain':domain,'official_source_page':row['pageUrl'],
           'source_url':row['assetUrl'],'asset_origin':'official site SVG; automated OCR screen',
           'asset_review_status':'auto-screened-first-party-vector',
           'added_at':now[:10],'logo_published_at':now}
    prior_brand=get(s3,base+'brand.json')
    if prior_brand is not None:
        stored=json.loads(prior_brand)
        if (stored.get('id'),stored.get('domain'),stored.get('source_url'))!=(ident,domain,row['assetUrl']):
            raise ValueError('new_brand_metadata_conflict')
        brand=stored
    if light_artwork(png):
        brand.update(light=True,light_logo=True,dark_variant='white')
    manifest={'schema':1,'algo_v':1,'id':ident,'primary':'auto-fleet','variants':[
        {'key':'auto-fleet','form':'unknown','lockup':'unknown','label':'공식 사이트 로고 · 자동 검수',
         'files':{'svg':'logo.svg','png':'logo.png'},'preview_png':'logo.png',
         'origin':'first-party-web','provider':domain,'source_url':row['assetUrl'],
         'source_sha256':sha(raw),'visual_sha256':sha(png),'review_status':'auto-screened','order':0}]}
    objects=[('logo.svg',raw,'image/svg+xml'),('logo.png',png,'image/png'),
             ('brand.json',(json.dumps(brand,ensure_ascii=False,separators=(',',':'))+'\n').encode(),'application/json'),
             ('variants.json',(json.dumps(manifest,ensure_ascii=False,separators=(',',':'))+'\n').encode(),'application/json')]
    for filename,body,mime in objects:
        put(s3,base+filename,body,mime,sha,filename=='brand.json')
        cdn_check(ident,filename,body)
    payload={'brand':brand,'manifest':manifest,'name':name}
    source='const x='+json.dumps(payload,ensure_ascii=False)+';' + r'''const{Pool}=require('pg');(async()=>{const p=new Pool({connectionString:process.env.DB_VIBERS_MAIN_URL,max:1});const c=await p.connect();try{await c.query('BEGIN');const d=await c.query("select id from semologo.logo_posts where status='published' and (id=$1 or lower(payload->>'domain')=lower($2) or lower(payload->>'name_en')=lower($3) or lower(payload->>'name_ko')=lower($3)) limit 3 for update",[x.brand.id,x.brand.domain,x.name]);if(d.rowCount)throw Error('live_identity_collision:'+d.rows.map(y=>y.id));const q=await c.query("insert into semologo.logo_posts(id,payload,status) values($1,$2::jsonb,'published') returning id",[x.brand.id,JSON.stringify(x.brand)]);if(q.rowCount!==1)throw Error('insert_failed');const v=await c.query("select id from semologo.logo_versions where brand_id=$1 and is_current for update",[x.brand.id]);if(v.rowCount!==1)throw Error('version_trigger_missing');await c.query("update semologo.logo_versions set asset_manifest=$2::jsonb,review_status='pending' where id=$1",[v.rows[0].id,JSON.stringify({variants:x.manifest})]);await c.query('COMMIT');console.log(JSON.stringify({published:x.brand.id}))}catch(e){await c.query('ROLLBACK');throw e}finally{c.release();await p.end()}})().catch(e=>{console.error(e.message);process.exit(1)})'''
    node('semologo',source)
    return 'published_new'
