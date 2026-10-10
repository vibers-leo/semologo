#!/usr/bin/env python3
"""Resumable local-only SVG previews. No uploads, catalog writes, or pixel color keying."""
import argparse, concurrent.futures, hashlib, importlib.util, json, os, re, subprocess
from pathlib import Path
ROOT = Path(__file__).resolve().parents[1]
spec = importlib.util.spec_from_file_location('background_audit', ROOT/'scripts/audit-svg-backgrounds.py')
audit = importlib.util.module_from_spec(spec); spec.loader.exec_module(audit)

def prepare(job):
    row, source, dest, size, fetch = job
    ident = row['id']; folder = dest/'items'/ident
    try:
        if '/' in ident or ident in ('.', '..'): raise ValueError('Unsafe ID')
        path = source/ident/'logo.svg'
        if not path.is_file():
            if not fetch: return {'id':ident, 'status':'source-missing'}
            import urllib.request
            from urllib.parse import quote
            request=urllib.request.Request('https://kr.object.ncloudstorage.com/vibers-bucket/_clients/'+quote(ident,safe='')+'/logo.svg',headers={'User-Agent':'SemoLogo-asset-audit/1.0','Referer':'https://semologo.com/'})
            with urllib.request.urlopen(request,timeout=25) as response:
                raw=response.read(5_000_001)
            if len(raw)>5_000_000: raise ValueError('SVG exceeds 5 MB review limit')
            path.parent.mkdir(parents=True,exist_ok=True)
            path.write_bytes(raw)
        raw = path.read_bytes()
        if len(raw)>5_000_000: raise ValueError('SVG exceeds 5 MB review limit')
        if re.search(rb'<(?:[\w-]+:)?(?:image|script|foreignObject|filter)\b|<!ENTITY', raw, re.I):
            return {'id':ident,'status':'manual-review','reason':'Raster wrapper, active SVG or filter requiring renderer review'}
        tree, backgrounds = audit.candidates(raw)
        if tree is None: raise ValueError('Cannot safely parse SVG')
        if re.search(rb'(?:href\s*=\s*["\'](?:https?:|//|file:)|url\(\s*["\']?(?:https?:|//|file:))',raw,re.I):
            return {'id':ident,'status':'manual-review','reason':'External resource'}
        folder.mkdir(parents=True,exist_ok=True)
        original=folder/'original.svg'
        if not original.exists():
            try: os.link(path,original)
            except OSError: original.write_bytes(raw)
        # MuPDF preserves aspect ratio; a child process bounds pathological rendering time.
        subprocess.run([os.sys.executable,__file__,'--render',str(folder/'original.svg'),str(folder/'preview.png'),str(size)],check=True,timeout=30,capture_output=True)
        from PIL import Image
        im=Image.open(folder/'preview.png').convert('RGBA')
        if not im.getbbox(): raise ValueError('Empty rendering')
        result={'id':ident,'status':'native-alpha-rendered','source_sha256':hashlib.sha256(raw).hexdigest(),'preview_sha256':hashlib.sha256((folder/'preview.png').read_bytes()).hexdigest(),'width':im.width,'height':im.height,'has_transparency':im.getextrema()[3][0]<255,'background_elements':len(backgrounds),'file':str((folder/'preview.png').relative_to(ROOT))}
        if backgrounds:
            # Full-canvas white may be an intentional flag/badge; never auto approve.
            for el in backgrounds: el.getparent().remove(el)
            cleaned=audit.E.tostring(tree)
            (folder/'candidate-transparent.svg').write_bytes(cleaned)
            subprocess.run([os.sys.executable,__file__,'--render',str(folder/'candidate-transparent.svg'),str(folder/'candidate-transparent.png'),str(size)],check=True,timeout=30,capture_output=True)
            candidate=Image.open(folder/'candidate-transparent.png').convert('RGBA')
            if not candidate.getbbox(): raise ValueError('Background removal erased artwork')
            result.update(status='background-removal-awaiting-review', candidate_file=str((folder/'candidate-transparent.png').relative_to(ROOT)), candidate_sha256=hashlib.sha256((folder/'candidate-transparent.png').read_bytes()).hexdigest(), candidate_width=candidate.width, candidate_height=candidate.height, candidate_has_transparency=candidate.getextrema()[3][0]<255)
        elif not result['has_transparency']: result['status']='opaque-awaiting-review'
        return result
    except Exception as e:
        return {'id':ident,'status':'failed','error':str(e)[:180]}

def render(src,dst,size):
    im=audit.render(Path(src).read_bytes(),int(size))
    # Keep tightly fitted artwork dimensions; never stretch to square.
    box=im.getbbox()
    if box: im=im.crop(box)
    im.save(dst,optimize=True)

def main():
    ap=argparse.ArgumentParser();ap.add_argument('--catalog',default=str(ROOT/'marketing/assets/collection-coverage/catalog.json'));ap.add_argument('--source',required=True,type=Path);ap.add_argument('--out',type=Path,default=ROOT/'marketing/assets/english-svg-preview-20261010');ap.add_argument('--limit',type=int,default=0);ap.add_argument('--workers',type=int,default=4);ap.add_argument('--size',type=int,default=640);ap.add_argument('--manifest-only',action='store_true');ap.add_argument('--retry',action='store_true');ap.add_argument('--fetch',action='store_true',help='Fetch missing originals to explicit HDD source cache');args=ap.parse_args()
    args.out.mkdir(parents=True,exist_ok=True)
    rows=[r for r in json.loads(Path(args.catalog).read_text()) if r.get('origin')=='GLOBAL' and r.get('has_svg') and r.get('added_at')=='2026-09-18']
    rows.sort(key=lambda r:r.get('seq',0),reverse=True)
    manifest={'scope':'Entire 2026-09-18 GLOBAL SVG import, reverse original sequence from ZZN through A; includes digit and non-Latin names.','total':len(rows),'missing_png_flags':sum(not r.get('has_png') for r in rows),'items':rows}
    (args.out/'scope.json').write_text(json.dumps(manifest,ensure_ascii=False)+'\n')
    if args.manifest_only: print(json.dumps({k:v for k,v in manifest.items() if k!='items'}));return
    progress=args.out/'progress.jsonl';done={}
    if progress.exists():
        for line in progress.read_text().splitlines():
            try: r=json.loads(line);done[r['id']]=r
            except json.JSONDecodeError: pass
    todo=[r for r in rows if r['id'] not in done or (args.retry and done[r['id']]['status'] in ('failed','source-missing'))]
    if args.limit: todo=todo[:args.limit]
    counts={}; print('Queued',len(todo),'previously recorded',len(done),flush=True)
    with progress.open('a') as log,concurrent.futures.ThreadPoolExecutor(max_workers=args.workers) as pool:
        index=0
        # Bound queued futures so the full 129k scope does not consume a second large heap.
        for start in range(0,len(todo),256):
            jobs=((r,args.source,args.out,args.size,args.fetch) for r in todo[start:start+256])
            for r in pool.map(prepare,jobs):
                index+=1
                log.write(json.dumps(r,ensure_ascii=False)+'\n');log.flush();done[r['id']]=r
                if index%100==0:
                    counts={}
                    for item in done.values(): counts[item['status']]=counts.get(item['status'],0)+1
                    summary={'total_scope':len(rows),'recorded':len(done),'counts':counts}
                    temp=args.out/'summary.tmp';temp.write_text(json.dumps(summary,indent=2)+'\n');temp.replace(args.out/'summary.json')
                    print('Processed',index,'/',len(todo),flush=True)
    for r in done.values(): counts[r['status']]=counts.get(r['status'],0)+1
    (args.out/'summary.json').write_text(json.dumps({'total_scope':len(rows),'recorded':len(done),'counts':counts},indent=2)+'\n');print(counts,flush=True)
if __name__=='__main__':
    import sys
    if len(sys.argv)>1 and sys.argv[1]=='--render': render(*sys.argv[2:])
    else: main()
