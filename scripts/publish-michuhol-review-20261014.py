#!/usr/bin/env python3
"""Publish reviewed Michuhol identity consolidation with catalog ETag guards."""
import hashlib
import io
import json
import runpy
from pathlib import Path

import boto3
from botocore.config import Config
from PIL import Image

ROOT = Path(__file__).resolve().parents[1]
WORK = ROOT / 'marketing/assets/michuhol-review-20261014'
SOURCE = ROOT / 'marketing/assets/supplied-identities-20261012'
BUCKET = 'vibers-bucket'
REMOVE = ('incheon-michuhol-gu', 'namgu')
IDS = ('gongu-ci-1368', 'namgu-mascot', 'gongu-ci-0604', *REMOVE)


def digest(data):
    return hashlib.sha256(data).hexdigest()


def object_range(raw, ident):
    marker = ('{"id":"' + ident + '"').encode()
    start = raw.find(marker)
    assert start >= 0 and raw.find(marker, start + 1) < 0, ident
    depth = 0
    quoted = escaped = False
    for i in range(start, len(raw)):
        c = raw[i]
        if quoted:
            if escaped:
                escaped = False
            elif c == 92:
                escaped = True
            elif c == 34:
                quoted = False
        elif c == 34:
            quoted = True
        elif c == 123:
            depth += 1
        elif c == 125:
            depth -= 1
            if not depth:
                return start, i + 1
    raise ValueError(ident)


def storage():
    loader = runpy.run_path(str(ROOT / 'scripts/publish-svg-background-audit-20261014.py'))
    secret = loader['secrets']()
    return boto3.client('s3', endpoint_url='https://kr.object.ncloudstorage.com', region_name='kr-standard',
        aws_access_key_id=secret['NCP_ACCESS_KEY'], aws_secret_access_key=secret['NCP_SECRET_KEY'],
        config=Config(signature_version='s3v4', request_checksum_calculation='when_required',
                      response_checksum_validation='when_required'))


def fetch(s3, key):
    obj = s3.get_object(Bucket=BUCKET, Key=key)
    return obj['Body'].read(), obj['ETag']


def put(s3, key, data, mime, etag=None):
    if etag is not None:
        assert s3.head_object(Bucket=BUCKET, Key=key)['ETag'] == etag, f'changed concurrently: {key}'
    s3.put_object(Bucket=BUCKET, Key=key, Body=data, ACL='public-read', ContentType=mime,
                  CacheControl='public,max-age=60')
    actual, _ = fetch(s3, key)
    assert digest(actual) == digest(data), key


def patch_catalog(raw, slim):
    replacements = []
    for ident in IDS:
        start, end = object_range(raw, ident)
        item = json.loads(raw[start:end])
        if ident in REMOVE:
            # Remove the item and its separator; leave already indexed detail URLs intact.
            if raw[start - 1:start] == b',':
                start -= 1
            else:
                assert raw[end:end + 1] == b','
                end += 1
            replacement = b''
        else:
            if ident == 'gongu-ci-1368':
                item.update(name_ko='미추홀구', name_en='Michuhol-gu',
                    aliases=['인천광역시 미추홀구', '미추홀구청', '인천 미추홀구', 'Michuhol District'])
            elif ident == 'namgu-mascot':
                item.update(name_ko='미추홀구 마스코트 미추', name_en='Michuhol-gu mascot Michu',
                    has_svg=True, has_png=True, aliases=['미추', '미추홀구 캐릭터'])
                if not slim:
                    item.update(logo_svg='logo.svg', logo_png='logo.png', variants_n=1,
                        website='https://www.michuhol.go.kr/main/')
            elif ident == 'gongu-ci-0604':
                item.update(name_ko='미추홀구시설관리공단',
                    aliases=['인천광역시미추홀구시설관리공단', '인천광역시 미추홀구시설관리공단'])
                if not slim:
                    item.update(name_en='Michuhol-gu Facilities Management Corporation',
                        website='https://www.imfm.or.kr/main/', domain='imfm.or.kr', variants_n=2)
            replacement = json.dumps(item, ensure_ascii=False, separators=(',', ':')).encode()
        replacements.append((start, end, replacement))
    for start, end, replacement in sorted(replacements, reverse=True):
        raw = raw[:start] + replacement + raw[end:]
    for ident in REMOVE:
        assert ('{"id":"' + ident + '"').encode() not in raw
    return raw


def main():
    WORK.mkdir(parents=True, exist_ok=True)
    assert not (WORK / 'published.json').exists(), 'already published'
    s3 = storage()
    originals = {}
    for name in ('brands.json', 'brands-slim.json'):
        raw, etag = fetch(s3, '_clients/' + name)
        (WORK / (name + '.before')).write_bytes(raw)
        changed = patch_catalog(raw, name == 'brands-slim.json')
        (WORK / (name + '.after')).write_bytes(changed)
        originals[name] = etag
        print(name, len(raw), '=>', len(changed), flush=True)

    brands = {}
    for ident in IDS:
        raw, etag = fetch(s3, f'_clients/{ident}/brand.json')
        (WORK / (ident + '-before.json')).write_bytes(raw)
        brands[ident] = (json.loads(raw), etag)

    mascot_svg = (SOURCE / 'gongu-ci-1368-mascot.svg').read_bytes()
    mascot_png = (SOURCE / 'gongu-ci-1368-mascot.png').read_bytes()
    with Image.open(io.BytesIO(mascot_png)) as image:
        assert image.size[1] >= 2000 and image.getchannel('A').getextrema()[0] == 0
    official_gif = (WORK / 'official-mark.gif').read_bytes()
    with Image.open(io.BytesIO(official_gif)) as image:
        assert image.size == (45, 31) and image.info.get('transparency') is not None
        output = io.BytesIO()
        image.convert('RGBA').save(output, format='PNG')
        official_png = output.getvalue()

    uploads = [
        ('_clients/namgu-mascot/logo.svg', mascot_svg, 'image/svg+xml'),
        ('_clients/namgu-mascot/logo.png', mascot_png, 'image/png'),
        ('_clients/gongu-ci-0604/sources/official-imfm-20261014/mark.gif', official_gif, 'image/gif'),
        ('_clients/gongu-ci-0604/sources/official-imfm-20261014/mark.png', official_png, 'image/png'),
    ]
    for key, data, mime in uploads:
        put(s3, key, data, mime)
        print('asset', key, len(data), flush=True)

    mascot_manifest = {'schema': 1, 'algo_v': 1, 'id': 'namgu-mascot', 'primary': 'official-ai-michu',
        'variants': [{'key': 'official-ai-michu', 'label': '마스코트 미추 · 공식 AI 추출',
            'form': 'mascot', 'lang': 'none', 'color': 'color',
            'files': {'svg': 'logo.svg', 'png': 'logo.png'}, 'preview_png': 'logo.png',
            'provider': '사용자 제공 미추홀구 AI 원본', 'origin': 'manual', 'order': 1}]}
    facility_manifest = {'schema': 1, 'algo_v': 1, 'id': 'gongu-ci-0604', 'primary': 'existing-wordmark',
        'variants': [
            {'key': 'existing-wordmark', 'label': '심볼 + 국문 가로조합', 'form': 'horizontal',
             'lang': 'ko', 'color': 'color', 'files': {'png': 'logo.png'},
             'provider': '공유마당 공공기관 CI 미리보기', 'origin': 'collected', 'order': 1},
            {'key': 'official-web-symbol', 'label': '공식 사이트 심볼 · 원본 45×31px',
             'form': 'symbol', 'lang': 'none', 'color': 'color',
             'files': {'png': 'sources/official-imfm-20261014/mark.png',
                       'gif': 'sources/official-imfm-20261014/mark.gif'},
             'provider': '미추홀구시설관리공단 공식 홈페이지', 'origin': 'official',
             'source_url': 'https://www.imfm.or.kr/main/', 'order': 2}]}
    for ident, manifest in [('namgu-mascot', mascot_manifest), ('gongu-ci-0604', facility_manifest)]:
        put(s3, f'_clients/{ident}/variants.json', json.dumps(manifest, ensure_ascii=False, separators=(',', ':')).encode(),
            'application/json; charset=utf-8')

    patches = {
        'gongu-ci-1368': {'name_ko': '미추홀구', 'name_en': 'Michuhol-gu',
            'aliases': ['인천광역시 미추홀구', '미추홀구청', '인천 미추홀구', 'Michuhol District']},
        'namgu-mascot': {'name_ko': '미추홀구 마스코트 미추', 'name_en': 'Michuhol-gu mascot Michu',
            'logo_svg': 'logo.svg', 'logo_png': 'logo.png', 'has_svg': True, 'has_png': True,
            'website': 'https://www.michuhol.go.kr/main/', 'variants_n': 1,
            'aliases': ['미추', '미추홀구 캐릭터'], 'presentation': {'file': 'logo.png', 'bg': 'light'},
            'preview_png': 'https://logo.vibers.co.kr/_clients/namgu-mascot/logo.png'},
        'gongu-ci-0604': {'name_ko': '미추홀구시설관리공단',
            'name_en': 'Michuhol-gu Facilities Management Corporation',
            'aliases': ['인천광역시미추홀구시설관리공단', '인천광역시 미추홀구시설관리공단'],
            'website': 'https://www.imfm.or.kr/main/', 'domain': 'imfm.or.kr', 'variants_n': 2,
            'official_source_page': 'https://www.imfm.or.kr/main/'},
        'incheon-michuhol-gu': {'hidden': True, 'merged_into': 'gongu-ci-1368',
            'variant_of': 'gongu-ci-1368', 'hidden_reason': '미추홀구 공식 AI 조합·심볼 콘텐츠로 통합'},
        'namgu': {'hidden': True, 'merged_into': 'gongu-ci-1368',
            'variant_of': 'gongu-ci-1368', 'hidden_reason': '미추홀구 공식 AI 조합·심볼 콘텐츠로 통합'},
    }
    for ident, patch in patches.items():
        brand, etag = brands[ident]
        brand.update(patch)
        put(s3, f'_clients/{ident}/brand.json', json.dumps(brand, ensure_ascii=False, separators=(',', ':')).encode(),
            'application/json; charset=utf-8', etag)

    # CMS has the same five published identities. Preserve each original and link the two duplicates.
    import subprocess
    js = "const patches=" + json.dumps(patches, ensure_ascii=False) + ";" + r'''
const {Pool}=require('pg');(async()=>{const p=new Pool({connectionString:process.env.DB_VIBERS_MAIN_URL,max:1});const c=await p.connect();try{await c.query('BEGIN');for(const [id,patch] of Object.entries(patches)){const row=await c.query('SELECT status FROM semologo.logo_posts WHERE id=$1 FOR UPDATE',[id]);if(row.rowCount!==1||row.rows[0].status!=='published')throw Error('CMS identity '+id);await c.query('UPDATE semologo.logo_posts SET payload=payload||$2::jsonb,updated_at=now() WHERE id=$1',[id,JSON.stringify(patch)]);if(patch.merged_into){await c.query(`INSERT INTO semologo.logo_content_merges(source_brand_id,target_brand_id,reason,evidence) VALUES($1,$2,'미추홀구 공식 AI 콘텐츠로 중복 통합',$3::jsonb) ON CONFLICT(source_brand_id) DO UPDATE SET target_brand_id=EXCLUDED.target_brand_id,reason=EXCLUDED.reason,evidence=EXCLUDED.evidence`,[id,patch.merged_into,JSON.stringify({checked_at:'2026-10-14',original_preserved:true})]);}}await c.query('COMMIT');console.log('CMS five identities updated')}catch(e){await c.query('ROLLBACK');throw e}finally{c.release();await p.end()}})().catch(e=>{console.error(e.message);process.exitCode=1});'''
    subprocess.run(['ssh', 'vibers', 'docker exec -i semologo node -'], input=js, text=True, check=True)

    # Check both ETags before changing either catalog.
    for name in originals:
        assert s3.head_object(Bucket=BUCKET, Key='_clients/' + name)['ETag'] == originals[name], name
    for name in ('brands.json', 'brands-slim.json'):
        changed = (WORK / (name + '.after')).read_bytes()
        put(s3, '_clients/' + name, changed, 'application/json; charset=utf-8', originals[name])
    (WORK / 'published.json').write_text(json.dumps({'updated': list(patches),
        'catalog_sha256': {name: digest((WORK / (name + '.after')).read_bytes())
                           for name in originals}}, ensure_ascii=False, indent=2) + '\n')
    print('PASS published five identities, two duplicate catalog entries removed', flush=True)


if __name__ == '__main__':
    main()
