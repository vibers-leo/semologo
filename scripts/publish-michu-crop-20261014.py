#!/usr/bin/env python3
"""Publish the tightly cropped official Michu art at cache-safe asset paths."""
import hashlib
import json
import runpy
import subprocess
from pathlib import Path

from PIL import Image

ROOT = Path(__file__).resolve().parents[1]
WORK = ROOT / 'marketing/assets/michu-crop-20261014'
IDENT = 'namgu-mascot'
CDN = 'https://logo.vibers.co.kr/_clients'
ASSETS = {
    'svg': ('michu-character.svg', 'sources/michu-crop-20261014/michu-character-2a308dbbf8bd.svg', 'image/svg+xml'),
    'png': ('michu-character.png', 'sources/michu-crop-20261014/michu-character-33334d4ce4fa.png', 'image/png'),
    'icon': ('michu-icon-1024.png', 'sources/michu-crop-20261014/michu-icon-6a18e03ec7f9.png', 'image/png'),
}


def digest(data):
    return hashlib.sha256(data).hexdigest()


def main():
    assert not (WORK / 'published.json').exists(), 'already published; keep the before snapshots intact'
    helper = runpy.run_path(str(ROOT / 'scripts/publish-michuhol-review-20261014.py'))
    s3 = helper['storage']()
    fetch, put, object_range = helper['fetch'], helper['put'], helper['object_range']
    paths = {kind: key for kind, (_, key, _) in ASSETS.items()}
    for kind, (filename, key, mime) in ASSETS.items():
        raw = (WORK / filename).read_bytes()
        assert digest(raw).startswith(key.rsplit('-', 1)[1].split('.')[0]), key
        if kind != 'svg':
            with Image.open(WORK / filename) as image:
                assert image.mode in ('RGBA', 'LA') and image.getchannel('A').getextrema()[0] == 0
                if kind == 'icon':
                    assert image.size == (1024, 1024)
                else:
                    assert image.size == (1563, 2400)

    original = {}
    for name in ('brand.json', 'variants.json'):
        raw, etag = fetch(s3, f'_clients/{IDENT}/{name}')
        (WORK / (name + '.before')).write_bytes(raw)
        original[name] = (raw, etag)
    for name in ('brands.json', 'brands-slim.json'):
        raw, etag = fetch(s3, '_clients/' + name)
        (WORK / (name + '.before')).write_bytes(raw)
        original[name] = (raw, etag)

    patch = {
        'logo_svg': paths['svg'], 'svg_transparent': paths['svg'],
        'logo_png': paths['png'], 'icon_png': paths['icon'],
        'preview_png': f'{CDN}/{IDENT}/{paths["png"]}',
        'presentation': {'file': paths['png'], 'bg': 'light'},
        'has_svg': True, 'has_png': True,
    }
    brand = json.loads(original['brand.json'][0])
    assert brand['id'] == IDENT
    rejected = set(brand.get('rejected_asset_files') or [])
    # The legacy horizontal preview remains in the archive, but must not
    # appear again as a transparent or high-resolution character derivative.
    rejected.update(('logo-transparent.png', 'logo-800.png'))
    patch['rejected_asset_files'] = sorted(rejected)
    brand.update(patch)
    brand_bytes = json.dumps(brand, ensure_ascii=False, separators=(',', ':')).encode()
    (WORK / 'brand.json.after').write_bytes(brand_bytes)

    manifest = json.loads(original['variants.json'][0])
    assert manifest['id'] == IDENT and len(manifest['variants']) == 1
    variant = manifest['variants'][0]
    assert variant['key'] == 'official-ai-michu'
    variant['files'] = {'svg': paths['svg'], 'png': paths['png']}
    variant['preview_png'] = paths['png']
    manifest_bytes = json.dumps(manifest, ensure_ascii=False, separators=(',', ':')).encode()
    (WORK / 'variants.json.after').write_bytes(manifest_bytes)

    catalogs = {}
    for name in ('brands.json', 'brands-slim.json'):
        raw = original[name][0]
        start, end = object_range(raw, IDENT)
        item = json.loads(raw[start:end])
        item.update(patch)
        replacement = json.dumps(item, ensure_ascii=False, separators=(',', ':')).encode()
        updated = raw[:start] + replacement + raw[end:]
        (WORK / (name + '.after')).write_bytes(updated)
        catalogs[name] = updated

    for filename, key, mime in ASSETS.values():
        put(s3, f'_clients/{IDENT}/{key}', (WORK / filename).read_bytes(), mime)
        print('asset', key, flush=True)
    put(s3, f'_clients/{IDENT}/variants.json', manifest_bytes,
        'application/json; charset=utf-8', original['variants.json'][1])
    put(s3, f'_clients/{IDENT}/brand.json', brand_bytes,
        'application/json; charset=utf-8', original['brand.json'][1])

    js = ('const patch=' + json.dumps(patch, ensure_ascii=False) + ';const manifest=' +
          json.dumps(manifest, ensure_ascii=False) + ';') + r'''
const {Pool}=require('pg');(async()=>{const p=new Pool({connectionString:process.env.DB_VIBERS_MAIN_URL,max:1});const c=await p.connect();try{await c.query('BEGIN');const row=await c.query('SELECT payload,status FROM semologo.logo_posts WHERE id=$1 FOR UPDATE',['namgu-mascot']);if(row.rowCount!==1||row.rows[0].status!=='published')throw Error('missing published mascot');const old=row.rows[0].payload.presentation?.file;if(!['logo-transparent.png','logo.png',patch.presentation.file].includes(old))throw Error('presentation changed: '+old);const rejected=new Set([...(row.rows[0].payload.rejected_asset_files||[]),...patch.rejected_asset_files]);patch.rejected_asset_files=[...rejected].sort();await c.query('UPDATE semologo.logo_posts SET payload=payload||$2::jsonb,updated_at=now() WHERE id=$1',['namgu-mascot',JSON.stringify(patch)]);const versions=await c.query("UPDATE semologo.logo_versions SET asset_manifest=jsonb_set(COALESCE(asset_manifest,'{}'::jsonb),'{variants}',$2::jsonb,true) WHERE brand_id=$1 AND is_current RETURNING id",['namgu-mascot',JSON.stringify(manifest)]);if(versions.rowCount!==1)throw Error('current mascot version missing');await c.query('COMMIT');console.log('CMS mascot presentation and variant manifest updated')}catch(e){await c.query('ROLLBACK');throw e}finally{c.release();await p.end()}})().catch(e=>{console.error(e.message);process.exitCode=1});'''
    subprocess.run(['ssh', 'vibers', 'docker exec -i semologo node -'],
                   input=js, text=True, check=True)

    for name in catalogs:
        assert s3.head_object(Bucket='vibers-bucket', Key='_clients/' + name)['ETag'] == original[name][1], name
    for name, updated in catalogs.items():
        put(s3, '_clients/' + name, updated, 'application/json; charset=utf-8', original[name][1])
    (WORK / 'published.json').write_text(json.dumps({
        'id': IDENT, 'paths': paths,
        'catalog_sha256': {name: digest(data) for name, data in catalogs.items()},
    }, ensure_ascii=False, indent=2) + '\n')
    print('PASS mascot cropped asset paths and presentation published', flush=True)


if __name__ == '__main__':
    main()
