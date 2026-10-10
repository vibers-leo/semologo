from pathlib import Path
from lxml import etree as E
from PIL import Image
import copy,hashlib,json,re
R=Path(__file__).resolve().parents[1];D=R/'marketing/assets/figma-better-batch5-20261010';S=R/'marketing/assets/figma-better-collection-20261010'
selected=json.loads((D/'selected-identities.json').read_text());decisions=json.loads((D/'identity-decisions.json').read_text());old={x['id']:x for x in json.loads((D/'cms-before.json').read_text())}
rows=[r for r in json.loads((D/'reviewed-candidates.json').read_text()) if r['name'] in selected]
for name in ['Capital One','Coca-Cola','Eventbrite','Fueler']:
    for f in sorted((D/'raster-source').glob(name+'*.png')):
        color='white' if '(white)' in f.name else 'black' if '(black)' in f.name else 'original'
        rows.append({'name':name,'file':f.name,'color':color,'png':str(f.relative_to(R))})
release={'patches':{},'variants':{},'source_kind':'user-provided-figma-community','official':False,'checked_at':'2026-10-10'}
uploads=[];proof=[];excluded=[];pixel_seen={};primary={}
light_original={'8VC','Allscripts','Higharc','Harvard Business School','Innovation Endeavors','Klue','Klaus'}
# These existing full-colour lockups are already available; only missing alternatives are added.
already_same={('Codecov','original'),('Corning Incorporated','original'),('Glossier','original'),('Goldman Sachs','original'),('J.P. Morgan','original')}
evidence={
'Atomic':{'id':'atomic-venture-studio','website':'https://www.atomic.vc/','evidence':'https://www.atomic.vc/team','note':'공식 공개 팀 소개에서 venture studio 실체 확인. 기존 atomic UI도구와 다른 기관.'},
'Fabric':{'id':'fabric-commerce','website':'https://fabric.inc/','evidence':'https://fabric.inc/about','note':'공식 공개 페이지에서 commerce 기업 실체 확인. 기존 fabric의 직물형 심볼과 분리.'},
'Homebrew':{'id':'homebrew-ventures','website':'https://www.homebrew.co/','evidence':'https://www.homebrew.co/blog-posts/hello-from-homebrew','note':'공식 공개 소개에서 투자사 실체 확인. 기존 Homebrew 패키지 관리자와 분리.'},
'AspireIQ':{'id':'aspireiq','website':'https://www.aspire.io/','evidence':'https://www.aspire.io/blog/aspire-new-branding','note':'공식 사이트의 AspireIQ→Aspire 개명 확인. 구명 워드마크로 표시.'},
'Canopy':{'id':'canopy-tax','website':'https://www.getcanopy.com/','evidence':'https://www.getcanopy.com/company/','note':'회계 업무 소프트웨어 회사. Canopy by Hilton 등 기존 동명기관과 분리.'},
'Carrot':{'id':'carrot-fertility','website':'https://www.get-carrot.com/','evidence':'https://www.get-carrot.com/press-and-media','note':'fertility 기업 실체 확인. 한국 캐롯보험/당근과 분리.'},
}
evidence.update({
 'Aven':{'id':'aven','website':'https://www.aven.com/','evidence':'https://www.aven.com/about/','note':'공식 회사 소개에서 금융회사 실체 확인.'},
 'Banza':{'id':'banza','website':'https://www.eatbanza.com/','evidence':'https://www.eatbanza.com/pages/faq','note':'공식 식품 브랜드 실체 확인.'},
 'Canaan':{'id':'canaan','website':'https://www.canaan.com/','evidence':'https://c.canaan.com/news/canaan-s-12th-fund-fresh-capital-to-continue-supporting-bold-ideas-and-the-incredible-people-who-make-them-happen','note':'투자사 실체 확인. 동명 하드웨어 업체 Canaan Creative와 분리.'},
 'Ceremonia':{'id':'ceremonia','website':'https://ceremonia.com/','evidence':'https://ceremonia.com/pages/about-us','note':'공식 헤어케어 회사 소개.'},
 'Hers':{'id':'hers','website':'https://www.forhers.com/','evidence':'https://www.forhers.com/privacy-policy','note':'Hims & Hers의 여성 건강 브랜드 실체 확인. 동명 hers.com과 분리.'},
 'Keeps':{'id':'keeps','website':'https://www.keeps.com/','evidence':'https://www.keeps.com/','note':'공식 헤어케어 브랜드.'},
 'Hippo':{'id':'hippo-insurance','website':'https://www.hippo.com/','evidence':'https://www.hippo.com/','note':'주택 보험 브랜드 실체 확인.'},
 'Klue':{'id':'klue','website':'https://klue.com/','evidence':'https://klue.com/competitive-intelligence-software','note':'경쟁정보 소프트웨어 실체 확인. 동명 한국어 벤치마크와 분리.'},
 'Kosas':{'id':'kosas','website':'https://kosas.com/','evidence':'https://kosas.com/pages/about','note':'공식 화장품 브랜드 회사 소개.'},
 'Aprio':{'id':'aprio','website':'https://www.aprio.com/','evidence':'https://www.aprio.com/','note':'공식 세무·회계·자문 회사 소개.'},
 'Deserve':{'id':'deserve','evidence':'https://website-static.deserve.com/wp-content/uploads/2021/03/220_050_21_Privacy-Policy-2021.pdf','note':'2021년 공식 과거 금융회사 문서로 신원 확인. deserve.com 현재는 일반 런칭 페이지이므로 현행 금융서비스/현재 웹사이트로 연결하지 않음.'},
})
category={}
for cat,names in {
'금융·결제':['8VC','Acrew','Atomic','Aven','BBG Ventures','Bitaccess','Breyer Capital','Canaan','Carbon Ventures','Deserve','Drip Capital','Earnest','Extra Card','GreenPoint Partners','Homebrew','Human Interest','Innovation Endeavors','Invest Detroit','Kleiner Perkins','Hippo'],
'항공·우주·방산':['AAC Clyde Space','Blue Canyon Technologies','Boom','EnduroSat'],
'교육':['Alfred University','Harvard Business School'],
'뷰티·생활':['Alleyoop','Ceremonia','Innbeauty Project','Kosas'],
'의료·바이오':['Allscripts','CareRev','Carrot','Color Health','Ginkgo Bioworks','Health Catalyst','Hers','Keeps'],
'건설·부동산':['Apartment List','Higharc','Industrious'],
'식품·음료':['Banza'],
'공공·기관':['CFPB'],
'미디어·엔터':['CAA','Cryptoys'],
'유통·쇼핑':['Foxtrot','Judy'],
'서비스·기업':['Aprio','Holtzman Partners','Jopwell'],
}.items():
    for name in names:category[name]=cat
display={'Atomic':'Atomic · 벤처 스튜디오','Fabric':'Fabric · 커머스','Homebrew':'Homebrew · 벤처캐피털','AspireIQ':'AspireIQ · 구 워드마크','Boom':'Boom Supersonic','CAA':'Creative Artists Agency · CAA','Canopy':'Canopy · 회계 소프트웨어','Carrot':'Carrot Fertility','Foxtrot':'Foxtrot Market','Hippo':'Hippo · 보험','Judy':'JUDY · 비상용품','Klaus':'Klaus · 고객지원 소프트웨어','Autopilot':'Autopilot · 마케팅'}
def upload(id,path):
    f=R/path;raw=f.read_bytes();h=hashlib.sha256(raw).hexdigest();rel=f'sources/figma-better-batch5-20261010/{h[:20]}/{f.name}'
    item={'id':id,'file':path,'key':f'_clients/{id}/{rel}','sha256':h,'bytes':len(raw)}
    if not any(x['key']==item['key'] for x in uploads):uploads.append(item)
    return rel
def initial_manifest(id):
    if id not in old:return {'schema':1,'algo_v':1,'id':id,'primary':None,'variants':[]}
    b=old[id];assert b['status']=='published' and not b['payload'].get('hidden') and not b['payload'].get('merged_into')
    m=(b.get('asset_manifest') or {}).get('variants')
    if not m:
        f=D/'existing'/id/'variants.json'
        if f.exists():m=json.loads(f.read_text())
    if m:return copy.deepcopy(m)
    # Retain a selectable original where no structured manifest existed.
    files={};folder=D/'existing'/id
    if b['payload'].get('metadata',{}).get('has_png') and (folder/'logo.png').exists():files['png']='logo.png'
    if (folder/'logo.svg').exists():files['svg']='logo.svg'
    m={'schema':1,'algo_v':1,'id':id,'primary':None,'variants':[]}
    if files:
        m['primary']='existing-original';m['variants'].append({'key':'existing-original','label':'기존 수집 원본','form':'unknown','lang':'unknown','files':files,'provider':'legacy-preserved','origin':'collected','order':0})
    return m
for row in rows:
    id=selected[row['name']];im=Image.open(R/row['png']).convert('RGBA');alpha=im.getchannel('A').getextrema();assert alpha[0]==0 and alpha[1]>0
    if row.get('svg'):
        root=E.parse(str(R/row['svg'])).getroot()
        assert not root.xpath('//*[local-name()="image" or local-name()="script" or local-name()="foreignObject"]')
        for element in root.iter():
            for attr,value in element.attrib.items():
                if E.QName(attr).localname in ['href','src']:assert value.startswith('#')
                assert not re.search(r'(?:https?://|@import|javascript:)',value,re.I) if E.QName(attr).localname not in ['xmlns'] else True
    pixel=hashlib.sha256(str(im.size).encode()+im.tobytes()).hexdigest()
    if (row['name'],row['color']) in already_same:
        excluded.append({'name':row['name'],'id':id,'color':row['color'],'reason':'기존 동일 색상·전체 워드마크 조합 유지. 새 색상만 추가.'});continue
    if (id,pixel) in pixel_seen:
        excluded.append({'name':row['name'],'id':id,'color':row['color'],'reason':'이번 원본 사이 정확한 RGBA 픽셀 중복','same_as':pixel_seen[id,pixel]});continue
    pixel_seen[id,pixel]=row['color']
    if id not in release['variants']:release['variants'][id]=initial_manifest(id)
    m=release['variants'][id];files={'png':upload(id,row['png'])}
    if row.get('svg'):files['svg']=upload(id,row['svg'])
    preview=im.copy();bbox=preview.getchannel('A').getbbox()
    if bbox:preview=preview.crop(bbox)
    preview.thumbnail((640,640),Image.Resampling.LANCZOS);folder=D/'previews'/id;folder.mkdir(parents=True,exist_ok=True);pf=folder/(row['color']+'.png');preview.save(pf,optimize=True);pre=upload(id,str(pf.relative_to(R)))
    key='figma-better-'+row['color'];assert not any(x['key']==key for x in m['variants'])
    light=row['color']=='white' or (row['name'] in light_original and row['color']=='original')
    label={'original':'원색','white':'흰색','black':'검정'}[row['color']]
    variant={'key':key,'label':'커뮤니티 수록 '+label+' · 시기 미확인'+(' · PNG 원본' if not row.get('svg') else ''),'form':'horizontal','lockup':'horizontal','lang':'en','color':row['color'],'light':light,'files':files,'preview_png':pre,'provider':'사용자 제공 Better Logos Figma Community 수집본','origin':'community','official':False,'order':len(m['variants']),'source_note':'원본 색·흰색 글자·내부 구멍·배경 도형을 그대로 보존. 공식 최신 CI로 표시하지 않습니다. PNG-only는 원본 해상도 그대로 제공합니다.','png_width':im.width,'png_height':im.height}
    if row['name']=='AspireIQ':variant['label']='구 AspireIQ 워드마크 · 커뮤니티 '+label;variant['source_note']+=' 공식 공개 개명 안내: https://www.aspire.io/blog/aspire-new-branding'
    m['variants'].append(variant)
    proof.append({'id':id,'name':row['name'],'key':key,'source_file':row['file'],'source_svg':row.get('svg'),'png':row['png'],'png_size':list(im.size),'alpha':list(alpha),'preview_bytes':pf.stat().st_size,'native_vector':bool(row.get('svg')),'source_unmodified':True,'visual_review':'approved'})
    if id not in old:
        score=0 if light else (2 if row['color']=='original' else 1)
        if id not in primary or score>primary[id]['score']:primary[id]={'variant':variant,'score':score,'name':row['name']}
for id,m in release['variants'].items():
    if id in old:
        before=(old[id].get('asset_manifest') or {}).get('variants') or {}
        if before:
            assert m['primary']==before['primary']
            for v in before.get('variants',[]):assert any(n==v for n in m['variants'])
        release['patches'][id]={'variants_n':len(m['variants'])}
    else:
        choice=primary[id];v=choice['variant'];name=choice['name'];m['primary']=v['key'];base='https://logo.vibers.co.kr/_clients/'+id+'/'
        patch={'id':id,'name_ko':display.get(name,name),'name_en':display.get(name,name),'aliases':[name],'category':category.get(name,'IT·테크'),'origin':'GLOBAL','has_png':True,'has_svg':True,'logo_png':base+v['files']['png'],'preview_png':base+v['preview_png'],'logo_svg':v['files']['svg'],'svg_transparent':v['files']['svg'],'presentation':{'file':v['preview_png'],'bg':'dark' if v['light'] else 'light'},'variants_n':len(m['variants']),'asset_origin':'사용자 제공 Better Logos Figma Community 수집본','asset_review_status':'verified','official_asset_reviewed':False,'added_at':'2026-10-10'}
        if name in evidence and evidence[name].get('website'):patch['website']=evidence[name]['website']
        release['patches'][id]=patch
all_names=json.loads((D/'ownership.json').read_text())['batch5_front'];svg_names={r['name'] for r in json.loads((D/'reviewed-candidates.json').read_text())}
holds=[]
for row in all_names:
    if row['name'] in selected:continue
    reason='PNG/PDF-only 신규: 벡터 확보 전 보류' if row['name'] not in svg_names else '동일 일반명 다기관 또는 실체·도메인 추가확인 필요. 기존 동명 콘텐츠에 자동 연결하지 않음.'
    if row['name']=='BitClout':reason='과거 서비스/브랜드의 현재 상태 미확인. 아카이브 시기 검수 후 제공.'
    holds.append({**row,'reason':reason})
for item in uploads:assert hashlib.sha256((R/item['file']).read_bytes()).hexdigest()==item['sha256']
for name,value in [('release',release),('uploads',uploads),('review-proof',proof),('excluded-candidates',excluded),('hold-identities',holds),('identity-web-evidence',evidence)]:
    (D/(name+'.json')).write_text(json.dumps(value,ensure_ascii=False,indent=2))
stats={'brands':len(release['variants']),'new_seeds':len(primary),'existing':len(release['variants'])-len(primary),'new_variants':len(proof),'objects':len(uploads),'holds':len(holds),'exact_or_existing_duplicates':len(excluded),'vector_variants':sum(x['native_vector'] for x in proof),'raster_variants':sum(not x['native_vector'] for x in proof)}
(D/'REPORT.md').write_text('# Better Logos 5차\n\n'+json.dumps(stats,ensure_ascii=False,indent=2)+'\n\n전반120 이름 전수대조. 기존 대표와 기존 manifest 변형 보존. 순수 SVG만 신규 seed하며 PNG-only 신규는 보류. 원본 SVG 수정/화이트 도형 제거/PNG 업스케일 없음. 기존 같은 색/조합 5개와 원본 사이 정확 픽셀 중복만 제외. 색상별 연락시트 5개, 신원 시트 3개, 기존53건 대조 시트 및 별칭5건 시트 실제 검수. 일반명 충돌은 별도 실체확인 또는 보류. 공식 최신 CI라고 주장하지 않습니다. 신규 publication 시각은 root 게시 마감에서 기록합니다.\n')
print(json.dumps(stats))
