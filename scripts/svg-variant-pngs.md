# SVG-only 구성의 PNG 준비

수집한 SVG 구성에는 대표 지정과 로고월에서 사용할 PNG를 함께 준비한다.

```
bash scripts/with-local-storage.sh python3 scripts/prepare-svg-variant-pngs.py \
  --manifest marketing/assets/<release>/original.json \
  --release-dir marketing/assets/<release>
```

기본값은 PNG가 없는 SVG만 렌더링한다. `--rerender-existing`은 기존 PNG의 배경이나 품질을 검수한 뒤 교체할 때 사용한다. 원본 SVG는 유지하고 1600px 너비 PNG를 해시 경로로 생성한다. 외부 리소스·래스터가 포함된 SVG는 수동 검수 대상으로 중단한다.

생성된 PNG를 흰색/어두운 배경에서 확인하고 release.json의 구성 이름·언어·방향을 검수한다. 흰색 픽셀을 일괄 삭제하지 않는다. 원본에 흰 배경이 있는 경우 원본 PNG는 별도 구성으로 보존하고, 배경 사각형만 확인해 제거한 벡터에서 투명 PNG를 만든다. 심볼 내부의 흰색은 유지한다.

검수한 release를 `src/lib/reviewed-<release>.json`으로 연결한 뒤 기존 `publish-reviewed-asset-release.py`로 업로드한다. 이 스크립트는 준비 단계이며 자동 배포나 대표 이미지 변경을 하지 않는다.
