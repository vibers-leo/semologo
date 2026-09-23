#!/usr/bin/env python3
"""공유마당 공공기관 CI 목록을 공식 원본 수집 큐로 변환한다.

목록 페이지는 기관 홈페이지와 CI 바로가기를 함께 제공한다. 이 단계에서는
이미지 캡처를 자산으로 저장하지 않고, 공식 CI 페이지 URL만 구조화한다.
실제 파일 다운로드·검수는 기관별 페이지에서 별도 실행한다.
"""
from __future__ import annotations

import json
import re
import sys
import time
from html.parser import HTMLParser
from pathlib import Path
from urllib.parse import parse_qs, urlencode, urljoin, urlparse, urlunparse
from urllib.request import Request, urlopen

ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / "data/collection/public-ci-index.json"
BASE = "https://gongu.copyright.or.kr/gongu/bbs/B0000022/list.do"
PAGES = 148  # 공식 목록의 마지막 페이지가 148번


class PageParser(HTMLParser):
    def __init__(self) -> None:
        super().__init__()
        self.current: dict[str, str] | None = None
        self.items: list[dict[str, str]] = []
        self.anchor: dict[str, str] | None = None

    def handle_starttag(self, tag: str, attrs: list[tuple[str, str | None]]) -> None:
        a = dict(attrs)
        href = a.get("href") or ""
        if tag == "a" and href:
            self.anchor = {"href": urljoin(BASE, href), "text": ""}
        if tag in {"h3", "h4"}:
            self.current = {"name": "", "homepage": "", "ci_page": ""}

    def handle_data(self, data: str) -> None:
        text = " ".join(data.split())
        if not text:
            return
        if self.anchor:
            self.anchor["text"] += (" " if self.anchor["text"] else "") + text
        if self.current is not None and not self.current["name"]:
            self.current["name"] = text

    def handle_endtag(self, tag: str) -> None:
        if tag == "a" and self.anchor:
            label = self.anchor["text"]
            if self.current is not None:
                if "CI" in label or "ci" in label.lower():
                    self.current["ci_page"] = self.anchor["href"]
                elif "홈페이지" in label:
                    self.current["homepage"] = self.anchor["href"]
            self.anchor = None
        if tag in {"h3", "h4"} and self.current:
            if self.current["name"] and (self.current["homepage"] or self.current["ci_page"]):
                self.items.append(self.current)
            self.current = None


def fetch(page: int) -> list[dict[str, str]]:
    query = urlencode({"menuNo": "200197", "optn1": "", "optn2": "", "pageIndex": page})
    req = Request(f"{BASE}?{query}", headers={"User-Agent": "SemoLogo-public-ci-collector/1.0"})
    with urlopen(req, timeout=30) as res:
        html = res.read().decode("utf-8", "replace")
    # 기관 카드는 h3 뒤에 홈페이지/CI 링크가 배치된다. 링크가 h3의
    # 형제 노드라 HTMLParser의 단순 상태 전이보다 카드 단위 정규식이
    # 페이지 구조 변화에 안전하다.
    items: list[dict[str, str]] = []
    for block in re.findall(r"<li>\s*<div class=\"bg_box\">(.*?)</div>\s*</li>", html, re.S):
        name_m = re.search(r"<h3>\s*(.*?)\s*</h3>", block, re.S)
        if not name_m:
            continue
        links = re.findall(r'<a\s+href=["\']([^"\']+)["\'][^>]*>\s*(.*?)</a>', block, re.S)
        name = re.sub(r"<[^>]+>", "", name_m.group(1)).strip()
        homepage = ci_page = ""
        for href, label in links:
            label = re.sub(r"<[^>]+>", " ", label)
            label = " ".join(label.split())
            if "CI" in label:
                ci_page = urljoin(BASE, href)
            elif "홈페이지" in label:
                homepage = urljoin(BASE, href)
        if name and (homepage or ci_page):
            items.append({"name": name, "homepage": homepage, "ci_page": ci_page})
    return items


def slug(name: str) -> str:
    value = re.sub(r"[^0-9A-Za-z가-힣]+", "-", name).strip("-").lower()
    return value or "public-institution"


def main() -> int:
    all_items: list[dict[str, str]] = []
    for page in range(1, PAGES + 1):
        try:
            all_items.extend(fetch(page))
        except Exception as exc:
            print(f"page {page}: {exc}", file=sys.stderr)
        if page % 10 == 0:
            print(f"scanned {page}/{PAGES}, raw {len(all_items)}")
        # 목록 서버 응답이 느린 편이라 별도 지연 없이 순차 요청한다.

    unique: dict[str, dict[str, str]] = {}
    for item in all_items:
        key = item["ci_page"] or item["homepage"]
        if key and key not in unique:
            unique[key] = {
                "id": slug(item["name"]),
                "name_ko": item["name"],
                "category": "공공·기관",
                "official_source_page": item["ci_page"] or item["homepage"],
                "website": item["homepage"] or item["ci_page"],
                "discovery_source": BASE,
                "status": "official-page-found",
            }
    result = {
        "schema": 1,
        "source": BASE,
        "source_total": 1769,
        "count": len(unique),
        "candidates": sorted(unique.values(), key=lambda x: x["name_ko"]),
    }
    OUT.write_text(json.dumps(result, ensure_ascii=False, indent=2) + "\n")
    print(f"wrote {len(unique)} candidates to {OUT}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
