#!/usr/bin/env python3
"""Replace a captured '+' with BSCF's official CI and merge its duplicate entry.

Dry-run by default. Official source bytes are pinned to the reviewed local copies.
"""
import argparse
import hashlib
import importlib.util
import io
import json
import re
from pathlib import Path

import boto3
import cairosvg
from botocore.config import Config
from PIL import Image

ROOT = Path(__file__).resolve().parents[1]
ASSETS = ROOT / 'data/collection/busan-cultural-foundation-20261017-assets'
BUCKET = 'vibers-bucket'
IDENT = 'busan-bscf'
DUPLICATE = 'gongu-ci-1160'
SOURCE = 'https://www.bscf.or.kr/view.do?no=1039'
PREFIX = 'sources/official-bscf-20261017/'
CDN = 'https://logo.vibers.co.kr/_clients/' + IDENT + '/'
EXPECTED = {
    'horizontal.svg': 'ac5a00db8fd33195946977083d9d6034aefa417b708000f40aa3ccc74de44faa',
    'vertical.svg': '17cfb677e72149b176632f607d8e7fefc94cd31734f7a69b486dc6a6a8864f2b',
}


def digest(raw):
    return hashlib.sha256(raw).hexdigest()


def encoded(data):
    return (json.dumps(data, ensure_ascii=False, separators=(',', ':')) + '\n').encode()


def png(image):
    out = io.BytesIO()
    image.save(out, format='PNG')
    return out.getvalue()


def remote(source):
    import subprocess
    done = subprocess.run(['ssh', 'vibers', 'docker exec -i semologo node -'],
                          input=source, text=True, capture_output=True)
    if done.returncode:
        raise RuntimeError('CMS operation failed: ' + done.stderr.strip()[:600])
    return json.loads(done.stdout)


def storage():
    spec = importlib.util.spec_from_file_location('publisher', ROOT / 'scripts/publish-commons-taiwan-new-20261017.py')
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    keys = module.credentials()
    return boto3.client('s3', endpoint_url='https://kr.object.ncloudstorage.com',
        region_name='kr-standard', aws_access_key_id=keys['NCP_ACCESS_KEY'],
        aws_secret_access_key=keys['NCP_SECRET_KEY'],
        config=Config(signature_version='s3v4', request_checksum_calculation='when_required',
                      response_checksum_validation='when_required'))


def fetch(s3, key):
    obj = s3.get_object(Bucket=BUCKET, Key=key)
    return obj['Body'].read(), obj['ETag']


def put(s3, key, raw, mime, etag=None):
    if etag is not None and s3.head_object(Bucket=BUCKET, Key=key)['ETag'] != etag:
        raise RuntimeError('Concurrent bucket edit: ' + key)
    s3.put_object(Bucket=BUCKET, Key=key, Body=raw, ContentType=mime,
                  CacheControl='public,max-age=60', ACL='public-read', Metadata={'sha256': digest(raw)})
    assert fetch(s3, key)[0] == raw, key


def object_range(raw, ident):
    marker = ('{"id":"' + ident + '"').encode()
    start = raw.find(marker)
    assert start >= 0 and raw.find(marker, start + 1) < 0, ident
    quoted = escaped = False
    depth = 0
    for i in range(start, len(raw)):
        c = raw[i]
        if quoted:
            if escaped: escaped = False
            elif c == 92: escaped = True
            elif c == 34: quoted = False
        elif c == 34: quoted = True
        elif c == 123: depth += 1
        elif c == 125:
            depth -= 1
            if depth == 0: return start, i + 1
    raise ValueError(ident)


def patch_catalog(raw, slim):
    changes = []
    for ident in (IDENT, DUPLICATE):
        start, end = object_range(raw, ident)
        if ident == DUPLICATE:
            if raw[start - 1:start] == b',': start -= 1
            else:
                assert raw[end:end + 1] == b','
                end += 1
            replacement = b''
        else:
            item = json.loads(raw[start:end])
            item.update(name_ko='부산문화재단', name_en='Busan Cultural Foundation',
                has_svg=True, has_png=True, website='https://www.bscf.or.kr/',
                official_source_page=SOURCE, logo_svg=PREFIX+'horizontal.svg',
                logo_png=PREFIX+'horizontal.png', preview_png=CDN+PREFIX+'horizontal.png',
                icon_png=PREFIX+'mark-icon.png', variants_n=3)
            replacement = json.dumps(item, ensure_ascii=False, separators=(',', ':')).encode()
        changes.append((start, end, replacement))
    for start, end, replacement in sorted(changes, reverse=True):
        raw = raw[:start] + replacement + raw[end:]
    assert ('{"id":"' + DUPLICATE + '"').encode() not in raw
    return raw


def prepare():
    source = {name: (ASSETS / name).read_bytes() for name in EXPECTED}
    for name, expected in EXPECTED.items():
        assert digest(source[name]) == expected, name
    for name in ('horizontal.svg', 'vertical.svg'):
        raw = source[name]
        assert re.search(br'<svg(?:\s|>)', raw[:1000], re.I)
        assert not re.search(br'<!DOCTYPE|<!ENTITY|<script|<image|<foreignObject|\bon\w+\s*=|javascript:|url\(', raw, re.I)
    horizontal = cairosvg.svg2png(bytestring=source['horizontal.svg'], output_width=1600)
    vertical = cairosvg.svg2png(bytestring=source['vertical.svg'], output_width=800)
    with Image.open(io.BytesIO(horizontal)) as image:
        image = image.convert('RGBA')
        assert image.getchannel('A').getextrema() == (0, 255)
        red = []
        for y in range(image.height):
            for x in range(image.width):
                r, g, b, a = image.getpixel((x, y))
                if a > 100 and r > 100 and r > g * 1.5 and r > b * 1.4:
                    red.append((x, y))
        bbox = (min(x for x, _ in red), min(y for _, y in red),
                max(x for x, _ in red) + 1, max(y for _, y in red) + 1)
        assert bbox[2] < image.width * 0.5 and bbox[3] > image.height * 0.6
        mark = image.crop((max(0, bbox[0]-8), max(0, bbox[1]-8),
                           bbox[2]+8, min(image.height, bbox[3]+8)))
        mark.thumbnail((900, 900), Image.Resampling.LANCZOS)
        icon = Image.new('RGBA', (1024, 1024), (0, 0, 0, 0))
        icon.alpha_composite(mark, ((1024-mark.width)//2, (1024-mark.height)//2))
        dark = Image.new('RGBA', (image.width+80, image.height+80), 'white')
        dark.alpha_composite(image, (40, 40))
        small = image.copy()
        small.thumbnail((800, 800), Image.Resampling.LANCZOS)
    with Image.open(io.BytesIO(vertical)) as check:
        assert check.getchannel('A').getextrema() == (0, 255)
    assets = {
        PREFIX+'horizontal.svg': (source['horizontal.svg'], 'image/svg+xml'),
        PREFIX+'vertical.svg': (source['vertical.svg'], 'image/svg+xml'),
        PREFIX+'horizontal.png': (horizontal, 'image/png'),
        PREFIX+'vertical.png': (vertical, 'image/png'),
        PREFIX+'mark-icon.png': (png(icon), 'image/png'),
        PREFIX+'dark-panel.png': (png(dark), 'image/png'),
    }
    manifest = {'schema': 1, 'algo_v': 1, 'id': IDENT, 'primary': 'official-horizontal', 'variants': [
        {'key':'official-horizontal','form':'horizontal','lockup':'horizontal','lang':'mixed',
         'color':'original','label':'공식 CI · 가로형','files':{'svg':PREFIX+'horizontal.svg','png':PREFIX+'horizontal.png'},
         'preview_png':PREFIX+'horizontal.png','origin':'official','provider':'부산문화재단',
         'source_url':SOURCE,'source_sha256':digest(source['horizontal.svg']),'review_status':'verified','order':0},
        {'key':'official-vertical','form':'vertical','lockup':'vertical','lang':'mixed',
         'color':'original','label':'공식 CI · 세로형','files':{'svg':PREFIX+'vertical.svg','png':PREFIX+'vertical.png'},
         'preview_png':PREFIX+'vertical.png','origin':'official','provider':'부산문화재단',
         'source_url':SOURCE,'source_sha256':digest(source['vertical.svg']),'review_status':'verified','order':1},
        {'key':'derived-mark-icon','form':'symbol','lockup':'symbol','lang':'ko','color':'original',
         'label':'공식 가로형의 빨간 부분 크롭 · 아이콘용','files':{'png':PREFIX+'mark-icon.png'},
         'preview_png':PREFIX+'mark-icon.png','origin':'derived','provider':'공식 CI에서 부분 크롭',
         'source_url':SOURCE,'review_status':'verified','order':2},
    ]}
    patch = {'name_ko':'부산문화재단','name_en':'Busan Cultural Foundation',
        'aliases':['Busan Cultural Foundation','BSCF'], 'origin':'KR',
        'has_svg':True,'has_png':True,'logo_svg':PREFIX+'horizontal.svg',
        'svg_transparent':PREFIX+'horizontal.svg','logo_png':PREFIX+'horizontal.png',
        'preview_png':CDN+PREFIX+'horizontal.png','icon_png':PREFIX+'mark-icon.png',
        'dark_png':PREFIX+'dark-panel.png','dark_variant':'panel',
        'website':'https://www.bscf.or.kr/','official_source_page':SOURCE,
        'source_url':SOURCE,'asset_origin':'부산문화재단 공식 2026 CI SVG',
        'asset_review_status':'reviewed-first-party-vector','variants_n':3,
        'presentation':{'file':PREFIX+'horizontal.png','bg':'light','svgFile':PREFIX+'horizontal.svg'},
        'catalog_override':True,'rejected_asset_files':['sources/ci/resize_plus.svg']}
    root = {
        'logo.svg':(source['horizontal.svg'],'image/svg+xml'),
        'logo.png':(horizontal,'image/png'),
        'logo-800.png':(png(small),'image/png'),
        'logo-transparent.png':(horizontal,'image/png'),
        'logo-icon.png':(png(icon),'image/png'),
        'logo-white.png':(png(dark),'image/png'),
    }
    return assets, root, manifest, patch


def publish_db(patch, duplicate, manifest, current):
    js = 'const patch='+json.dumps(patch,ensure_ascii=False)+';const duplicate='+json.dumps(duplicate,ensure_ascii=False)+';const manifest='+json.dumps(manifest,ensure_ascii=False)+';const current='+json.dumps(current)+';'+r'''
const{Pool}=require('pg');(async()=>{const p=new Pool({connectionString:process.env.DB_VIBERS_MAIN_URL,max:1});const d=await p.connect();try{await d.query('BEGIN');
for(const id of ['busan-bscf','gongu-ci-1160']){const q=await d.query('SELECT status FROM semologo.logo_posts WHERE id=$1 FOR UPDATE',[id]);if(q.rowCount!==1||q.rows[0].status!=='published')throw Error('Identity changed '+id)}
for(const [id,data] of [['busan-bscf',patch],['gongu-ci-1160',duplicate]])await d.query('UPDATE semologo.logo_posts SET payload=payload||$2::jsonb,updated_at=now() WHERE id=$1',[id,JSON.stringify(data)]);
const v=await d.query("UPDATE semologo.logo_versions SET asset_manifest=$2::jsonb,review_status='verified',verified_at=now(),source_url=$3,source_note='부산문화재단 공식 2026 CI SVG 가로·세로형 확인. 기존 + SVG는 사이트 UI 버튼이므로 교체.',label='공식 CI · 가로형·세로형' WHERE brand_id=$1 AND is_current RETURNING id",['busan-bscf',JSON.stringify({variants:manifest}),patch.official_source_page]);if(v.rowCount!==1)throw Error('Version changed');
await d.query(`INSERT INTO semologo.logo_content_merges(source_brand_id,target_brand_id,reason,evidence) VALUES('gongu-ci-1160','busan-bscf','부산문화재단 동일 공식 CI 중복 통합',$1::jsonb) ON CONFLICT(source_brand_id) DO UPDATE SET target_brand_id=EXCLUDED.target_brand_id,reason=EXCLUDED.reason,evidence=EXCLUDED.evidence`,[JSON.stringify({checked_at:'2026-10-17',official_source:patch.official_source_page,original_preserved:true})]);
const m=await d.query("UPDATE semologo.collection_members SET brand_id='busan-bscf',review_status='verified',metadata=metadata||$3::jsonb WHERE snapshot_id=$1 AND member_key=$2 AND (brand_id IS NULL OR brand_id IN ('busan-bscf','gongu-ci-1160')) RETURNING member_key",[current.snapshot_id,current.member_key,JSON.stringify({brand_id:'busan-bscf',png_verified:true,identity_reviewed:true,source_url:patch.official_source_page,source_sha256:manifest.variants[0].source_sha256,reviewed_at:'2026-10-17'})]);if(m.rowCount!==1)throw Error('Collection member changed');
await d.query('COMMIT');console.log(JSON.stringify({canonical:'busan-bscf',merged:'gongu-ci-1160',version:v.rows[0].id,member:m.rows[0].member_key}));
}catch(e){await d.query('ROLLBACK');throw e}finally{d.release();await p.end()}})().catch(e=>{console.error(e.message);process.exitCode=1})'''
    return remote(js)


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--apply', action='store_true')
    args = parser.parse_args()
    assets, root, manifest, patch = prepare()
    state = remote(r'''const{Pool}=require('pg');(async()=>{const p=new Pool({connectionString:process.env.DB_VIBERS_MAIN_URL,max:1});const posts=await p.query("SELECT id,status FROM semologo.logo_posts WHERE id IN ('busan-bscf','gongu-ci-1160')");const m=await p.query("SELECT s.id snapshot_id,m.member_key,m.brand_id,m.review_status FROM semologo.collection_snapshots s JOIN semologo.collection_members m ON m.snapshot_id=s.id WHERE s.collection_id='kr-local-invested-institutions' AND m.member_key='cleaneye-출연-69' ORDER BY s.as_of DESC,s.id DESC LIMIT 1");console.log(JSON.stringify({posts:posts.rows,members:m.rows}));await p.end()})().catch(e=>{console.error(e.message);process.exitCode=1})''')
    assert len(state['posts']) == 2 and all(x['status']=='published' for x in state['posts'])
    assert len(state['members']) == 1
    s3 = storage()
    catalogs = {}
    for name in ('brands.json','brands-slim.json'):
        raw, etag = fetch(s3,'_clients/'+name)
        catalogs[name] = (patch_catalog(raw,name=='brands-slim.json'),etag)
    originals = {}
    for ident in (IDENT,DUPLICATE):
        raw,etag = fetch(s3,f'_clients/{ident}/brand.json')
        originals[ident] = (json.loads(raw),etag)
    old_svg,_ = fetch(s3,f'_clients/{IDENT}/logo.svg')
    assert digest(old_svg) == '36c733b60205ef769a27a65ad5cf5f6cf5f3c8aef4903602d6c240674bf18b38' or old_svg == assets[PREFIX+'horizontal.svg'][0], 'Unexpected existing root SVG'
    print(json.dumps({'status':'ready','canonical':IDENT,'merge':DUPLICATE,
        'officialVariants':len(manifest['variants']),'replaceRootFiles':list(root),
        'collectionMember':state['members'][0]['member_key']},ensure_ascii=False),flush=True)
    if not args.apply: return
    # Immutable originals first; final CMS/catalog changes only after readback.
    for name,(raw,mime) in assets.items():
        key=f'_clients/{IDENT}/{name}'
        try: prior,_=fetch(s3,key)
        except s3.exceptions.NoSuchKey: prior=None
        if prior is None: put(s3,key,raw,mime)
        elif prior != raw: raise RuntimeError('Immutable source conflict: '+key)
    for name,(raw,mime) in root.items():
        key=f'_clients/{IDENT}/{name}'
        _,etag=fetch(s3,key)
        put(s3,key,raw,mime,etag)
    put(s3,f'_clients/{IDENT}/variants.json',encoded(manifest),'application/json; charset=utf-8')
    original,etag=originals[IDENT]
    original.update(patch)
    put(s3,f'_clients/{IDENT}/brand.json',encoded(original),'application/json; charset=utf-8',etag)
    duplicate={'hidden':True,'merged_into':IDENT,'variant_of':IDENT,
        'hidden_reason':'부산문화재단 공식 CI 가로·세로형 콘텐츠로 통합',
        'catalog_override':True,'logo_png':'logo.png'}
    original,etag=originals[DUPLICATE]
    original.update(duplicate)
    put(s3,f'_clients/{DUPLICATE}/brand.json',encoded(original),'application/json; charset=utf-8',etag)
    published=publish_db(patch,duplicate,manifest,state['members'][0])
    for name,(changed,etag) in catalogs.items():
        put(s3,'_clients/'+name,changed,'application/json; charset=utf-8',etag)
    print(json.dumps({'status':'published',**published,'catalogs':list(catalogs)},ensure_ascii=False))


if __name__ == '__main__': main()
