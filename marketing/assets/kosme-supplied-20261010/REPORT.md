# KOSME 추가 변형 및 제공 원본

Downloads new_ci_ai.zip의 21개 AI를 모두 개요 렌더로 검토했습니다. 기존 gongu-ci-1460 공식 가로형 대표1개를 유지하고 서로 다른 28개 변형을 추가합니다. 총29종입니다. 워드마크1, 국문/영문/국영문 로고타입3, 세로로고타입3, 상하조합3, 영문/국영문 좌우조합2, 국문 세로시그니처1, 워드마크 색상6, 슬로건3, 슬로건 시그니처2, 엠블럼4입니다.

격자/공간규정 전용 페이지, 색상 견본표, 지정서체, 같은 아트 반복은 변형으로 세지 않았습니다. 워드마크 안의 회전형 심볼은 제공 엠블럼에 포함되며 임의 심볼 조합은 만들지 않았습니다. 전체 AI21개와 PDF 매뉴얼이 있는 원본 ZIP은 바이트 그대로 제공하도록 준비했습니다.

SVG28+투명 PNG28+원본 ZIP1=57객체입니다. PNG 긴 변2000px. AI PDF path를 명시영역으로 추출했고 엠블럼의 곡선 영문 텍스트는 폰트 glyph를 path로 변환해 포함했습니다. 원본 영문 원형 글자가 빠진 초기 엠블럼은 최종 추출본으로 교정했습니다. 가이드/설명 문구/흰 바탕 제외, 최종 contact.jpg 및 emblem-contact.jpg 육안검수 완료. SVG는 image 요소가 없는 벡터입니다.

release.json patches는 variants_n/source_zip/source_original_label만 포함하며 기존 대표/공식출처를 덮어쓰지 않습니다. 원본링크 patch는 root가 별도 반영합니다. 청년창업사관학교는 별도 콘텐츠로 유지합니다. CMS/업로드는 하지 않았습니다.

재현순서: extract-kosme-supplied-20261010.py → extract-kosme-emblem-text-paths-20261010.py → prepare-kosme-supplied-release-20261010.py. 엠블럼은 두번째 단계가 영어 glyph 포함 최종본입니다.
