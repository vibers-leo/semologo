#!/usr/bin/env python3
"""First-party SVG intake and conservative OCR screening for unattended batches."""
import concurrent.futures
import hashlib
import html
import io
import json
import re
import runpy
import subprocess
import shutil
import sys
import tempfile
import math
import xml.etree.ElementTree as ET
from pathlib import Path
from urllib.parse import unquote, urlsplit

import boto3
import cairosvg
from botocore.config import Config
from PIL import Image

ROOT = Path(__file__).resolve().parents[1]
STAGE = runpy.run_path(str(ROOT / 'scripts/stage-fleet-domain-assets.py'))
BUCKET = 'vibers-bucket'
UNSAFE = re.compile(br'<!DOCTYPE|<!ENTITY|<(?:image|script|foreignObject)\b|data:image/|javascript:|\bon[a-z]+\s*=|\b(?:xlink:)?href\s*=|@import|url\s*\(', re.I)
BAD_PATH = re.compile(r'(?i)(?:^|[/_-])(partner|sponsor|client|customer|provider|payment|social|badge|seal|portfolio|press|media|award|favicon|apple-touch|co-brand)(?:[/_.-]|$)')


def sha(raw):
    return hashlib.sha256(raw).hexdigest()


def node(container, source):
    command = (['docker','exec','-i',container,'node','-'] if sys.platform == 'linux' else ['ssh','vibers',f'docker exec -i {container} node -'])
    result = subprocess.run(command, input=source,
                            capture_output=True,text=True,timeout=120)
    if result.returncode:
        raise RuntimeError(container+':'+result.stderr.strip()[-350:])
    return json.loads(result.stdout)


def s3_client():
    credentials = runpy.run_path(str(ROOT / 'scripts/publish-commons-taiwan-new-20261017.py'))['credentials']()
    return boto3.client('s3',endpoint_url='https://kr.object.ncloudstorage.com',
        region_name='kr-standard',aws_access_key_id=credentials['NCP_ACCESS_KEY'],
        aws_secret_access_key=credentials['NCP_SECRET_KEY'],
        config=Config(signature_version='s3v4',max_pool_connections=24,
                      request_checksum_calculation='when_required'))


def jobs_after(cursor, limit):
    source = 'const c='+json.dumps(cursor)+';const n='+str(limit)+';' + r'''const{Pool}=require('pg');(async()=>{const p=new Pool({connectionString:process.env.FLEET_DATABASE_URL,max:1});try{const q=await p.query("select id,result,to_char(created_at AT TIME ZONE 'UTC','YYYY-MM-DD\"T\"HH24:MI:SS.US\"Z\"') created_at from fleet.job where project='semologo' and kind='semologo-domain-discover' and status='succeeded' and (created_at,id)>($1::timestamptz,$2::uuid) order by created_at,id limit $3",[c.createdAt,c.id,n]);console.log(JSON.stringify(q.rows))}finally{await p.end()}})().catch(e=>{console.error(e.message);process.exit(1)})'''
    return node('vibers-fleet',source)


def host(value):
    if not value:return ''
    return (urlsplit(value if '://' in value else 'https://'+value).hostname or '').lower().removeprefix('www.')


def fold(value):
    return ''.join(ch for ch in html.unescape(value or '').casefold() if ch.isascii() and ch.isalnum())


def title(value):
    text=html.unescape(value or '').strip()
    text=re.sub(r'(?i)^(?:home|homepage|welcome|startseite)\s*[/›»]\s*','',text)
    return re.split(r'\s+[|—–:]\s+|\s+-\s+',text,maxsplit=1)[0].strip()


def stem(domain):
    bits=domain.split('.')
    return fold(bits[-3] if len(bits)>=3 and bits[-2:] in (['co','kr'],['or','kr'],['go','kr'],['ac','kr']) else bits[-2] if len(bits)>=2 else '')


def cms_catalog():
    source = r'''const{Pool}=require('pg');(async()=>{const p=new Pool({connectionString:process.env.DB_VIBERS_MAIN_URL,max:1});try{const q=await p.query("select p.id,p.payload->>'name_ko' name_ko,p.payload->>'name_en' name_en,p.payload->>'domain' domain,p.payload->>'website' website from semologo.logo_posts p where p.status='published'");console.log(JSON.stringify(q.rows))}finally{await p.end()}})().catch(e=>{console.error(e.message);process.exit(1)})'''
    by_domain,by_name,ids={}, {}, set()
    for row in node('semologo',source):
        ids.add(row['id'])
        for field in ('domain','website'):
            domain=host(row.get(field))
            if domain:by_domain.setdefault(domain,{})[row['id']]=row
        for field in ('name_ko','name_en'):
            name=fold(row.get(field))
            if name:by_name.setdefault(name,set()).add(row['id'])
    return {k:list(v.values()) for k,v in by_domain.items()},by_name,ids


def stage_jobs(s3,jobs,output):
    signals=[]
    for job in jobs:
        for result in STAGE['read_job'](s3,job):
            if result.get('status')!='candidate_review_required':continue
            for url in result.get('logoCandidates',[])[:3]:
                if isinstance(url,str):
                    signals.append((result.get('domain',''),result.get('pageUrl',''),
                                    result.get('name',''),'first-party-logo',url))
    signals=list(dict.fromkeys(signals))
    with concurrent.futures.ThreadPoolExecutor(max_workers=16) as pool:
        rows=list(pool.map(lambda item:STAGE['fetch'](item,output),signals))
    return signals,rows


def source_reason(row):
    domain=host(row.get('domain'))
    page,asset=urlsplit(row.get('pageUrl','')),urlsplit(row.get('assetUrl',''))
    path=unquote(asset.path)
    if page.scheme!='https' or asset.scheme!='https' or host(page.hostname)!=domain or host(asset.hostname)!=domain:
        return 'not_first_party_https'
    if page.path not in ('','/') or page.query:return 'not_homepage'
    if Path(path).suffix.lower()!='.svg' or 'logo' not in Path(path).name.lower() or BAD_PATH.search(path):
        return 'not_canonical_svg'
    return ''


def review_svg(raw):
    if len(raw)>150000 or b'<svg' not in raw[:1000].lower() or UNSAFE.search(raw):
        raise ValueError('unsafe_svg')
    # Bound the raster before Cairo allocates it. Checking aspect ratio only
    # after rendering lets a malformed tall SVG exhaust the publisher cgroup.
    root=ET.fromstring(raw)
    box=re.split(r'[\s,]+',root.get('viewBox','').strip())
    if len(box)==4:
        _,_,width,height=map(float,box)
    else:
        lengths=[]
        units={'':1,'px':1,'pt':96/72,'pc':16,'in':96,'cm':96/2.54,'mm':96/25.4}
        for key in ('width','height'):
            match=re.fullmatch(r'\s*([\d.+eE-]+)(px|pt|pc|in|cm|mm)?\s*',root.get(key,''))
            if not match:raise ValueError('unknown_canvas')
            lengths.append(float(match[1])*units[match[2] or ''])
        width,height=lengths
    if not all(math.isfinite(n) and n>0 for n in (width,height)):
        raise ValueError('invalid_canvas')
    output_height=round(1200*height/width)
    if output_height<80 or max(width,height)/min(width,height)>12 or 1200*output_height>4_000_000:
        raise ValueError('small_or_extreme_canvas')
    png=cairosvg.svg2png(bytestring=raw,output_width=1200,output_height=output_height)
    with Image.open(io.BytesIO(png)) as opened:image=opened.convert('RGBA')
    if image.width<300 or image.height<80 or max(image.size)/min(image.size)>12:
        raise ValueError('small_or_extreme_canvas')
    alpha=image.getchannel('A');box=alpha.getbbox()
    if not box or alpha.getextrema()[0]>=245:raise ValueError('empty_or_opaque_canvas')
    if (box[2]-box[0])*(box[3]-box[1])/(image.width*image.height)<.06:raise ValueError('tiny_artwork')
    sample=image.copy();sample.thumbnail((400,400));pixels=list(sample.getdata())
    if sum(a>245 and min(r,g,b)>245 for r,g,b,a in pixels)/len(pixels)>.45:
        raise ValueError('embedded_white_backdrop')
    return png,image.crop(box)


def ocr(image):
    texts=[]
    with tempfile.TemporaryDirectory() as directory:
        for color in ((255,255,255),(16,16,20)):
            canvas=Image.new('RGB',image.size,color);canvas.paste(image,mask=image.getchannel('A'))
            if canvas.width<1000:canvas=canvas.resize((1000,max(80,round(canvas.height*1000/canvas.width))))
            path=Path(directory)/('light.png' if color[0]>100 else 'dark.png');canvas.save(path)
            result=subprocess.run([shutil.which('tesseract') or '/opt/homebrew/bin/tesseract',str(path),'stdout','-l','eng','--psm','11'],
                                  capture_output=True,text=True,timeout=15)
            if result.returncode==0:texts.append(result.stdout.strip())
    return texts


def matched_ocr(texts,name,domain,is_new):
    token,root=fold(title(name)),stem(domain)
    if len(token)<5 or len(root)<5 or token in {'home','homepage','welcome','logo','index'}:return ''
    if is_new and not (token in root or root in token):return ''
    for text in texts:
        seen=fold(text)
        if token in seen or (len(root)>=7 and root in seen and (token in root or root in token)):
            return text[:160]
    return ''
