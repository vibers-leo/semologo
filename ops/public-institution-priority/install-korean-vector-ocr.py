"""Enable strict full Korean-name OCR for existing institution vector repairs."""
from pathlib import Path
import py_compile,runpy
root=Path('/root/projects/semologo-publisher/scripts')
core=root/'fleet-auto-core.py';pipeline=root/'run-auto-fleet-pipeline.py'
a=core.read_text();b=pipeline.read_text()
if 'def ocr(image, language=' not in a:
 assert a.count('def ocr(image):')==1
 a=a.replace('def ocr(image):',"def ocr(image, language='eng'):\n    assert language in ('eng','kor+eng')")
 assert a.count("str(path),'stdout','-l','eng','--psm','11'")==1
 a=a.replace("str(path),'stdout','-l','eng','--psm','11'","str(path),'stdout','-l',language,'--psm','11'")
 needle='def matched_ocr(texts,name,domain,is_new):\n'
 assert a.count(needle)==1
 extra='''    if any('가' <= ch <= '힣' for ch in name):
        if is_new:
            return ''
        def korean_fold(value):
            value=re.sub(r'주식회사|재단법인|\\(주\\)|\\(재\\)', '', value)
            return ''.join(ch for ch in value.casefold() if ch.isalnum())
        expected=korean_fold(name)
        if len(expected)<4:
            return ''
        for text in texts:
            if expected in korean_fold(text):
                return text[:160]
        return ''
'''
 a=a.replace(needle,needle+extra)
 needle="CORE['ocr'](image), name, domain, not bool(matches)"
 assert b.count(needle)==1
 b=b.replace(needle,"CORE['ocr'](image, language='kor+eng' if any('가' <= ch <= '힣' for ch in name) else 'eng'), name, domain, not bool(matches)")
 for path,old,new in [(core,core.read_text(),a),(pipeline,pipeline.read_text(),b)]:
  path.with_name(path.name+'.before-korean-ocr-20261025').write_text(old)
  tmp=path.with_suffix('.ko-install.py');tmp.write_text(new);py_compile.compile(str(tmp),doraise=True);tmp.replace(path)
c=runpy.run_path(str(core))
assert c['matched_ocr'](['한국국제보건의료재단'],'한국국제보건의료재단','kofih.org',False)
assert not c['matched_ocr'](['한국보건의료재단'],'한국국제보건의료재단','kofih.org',False)
assert not c['matched_ocr'](['한국국제보건의료재단'],'한국국제보건의료재단','kofih.org',True)
print('PASS existing full Korean-name identity matching; wrong/new identities rejected')
