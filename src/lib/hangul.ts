/**
 * 한글 초성 검색.
 *
 * 한국어 서비스에서 "ㅅㅅ" 으로 "삼성" 을 못 찾는 건 큰 마찰이다.
 * `name_ko` 가 이미 있으므로 서버 변경 없이 클라이언트에서 해결한다.
 *
 * 동작:
 *   "ㅅㅅ"   → 초성 검색 → 삼성 · 신세계 · ses …
 *   "삼성"   → 일반 부분일치 (기존 동작 그대로)
 *   "삼ㅅ"   → 완성 글자 + 초성 혼용도 지원
 */

const CHO = [
  "ㄱ", "ㄲ", "ㄴ", "ㄷ", "ㄸ", "ㄹ", "ㅁ", "ㅂ", "ㅃ", "ㅅ",
  "ㅆ", "ㅇ", "ㅈ", "ㅉ", "ㅊ", "ㅋ", "ㅌ", "ㅍ", "ㅎ",
];

const HANGUL_BASE = 0xac00;   // '가'
const HANGUL_LAST = 0xd7a3;   // '힣'
const JUNG_JONG = 21 * 28;    // 중성 21 × 종성 28

/** 완성형 한글 문자열 → 초성 문자열. 한글이 아닌 문자는 그대로 둔다. */
export function toChoseong(text: string): string {
  let out = "";
  for (const ch of text) {
    const code = ch.charCodeAt(0);
    if (code >= HANGUL_BASE && code <= HANGUL_LAST) {
      out += CHO[Math.floor((code - HANGUL_BASE) / JUNG_JONG)];
    } else {
      out += ch;
    }
  }
  return out;
}

/** 입력이 초성만으로 이뤄졌는지 (자음 낱자 + 공백/영숫자 허용) */
export function isChoseongQuery(q: string): boolean {
  const trimmed = q.replace(/\s/g, "");
  if (!trimmed) return false;
  // 자음 낱자가 하나라도 있어야 초성 검색으로 본다
  return /[ㄱ-ㅎ]/.test(trimmed);
}

/**
 * 초성 질의가 대상의 몇 번째 글자에서 매치되는지. 없으면 -1.
 *
 * 질의의 자음 낱자는 대상의 초성과, 그 외 문자는 대상 원문과 맞춘다.
 * "삼ㅅ" 같은 혼용을 지원하려고 원문·초성 두 벌을 만들어 자리별로 비교한다.
 *
 * 위치를 돌려주는 이유: 단어 중간 매치가 앞자리를 차지하면 검색이 쓸모없어진다.
 * "ㅅㅅ" 을 치면 골드만'삭스'·아'수스'·키르기'스스'탄 이 전부 걸리는데,
 * 사용자가 찾는 건 '삼성' 이다. 호출부에서 이 값으로 앞글자 매치를 올린다.
 */
export function choseongIndex(query: string, target: string): number {
  const q = query.replace(/\s/g, "");
  const t = target.replace(/\s/g, "");
  if (!q || !t) return -1;

  const tCho = toChoseong(t);
  const len = q.length;

  for (let start = 0; start + len <= t.length; start++) {
    let ok = true;
    for (let i = 0; i < len; i++) {
      const qc = q[i];
      const isJamo = qc >= "ㄱ" && qc <= "ㅎ";
      // 자음 낱자면 초성끼리, 아니면 원문끼리 비교
      const hit = isJamo ? tCho[start + i] === qc : t[start + i] === qc;
      if (!hit) { ok = false; break; }
    }
    if (ok) return start;
  }
  return -1;
}

/** 초성 질의가 대상에 매치되는지 */
export function matchChoseong(query: string, target: string): boolean {
  return choseongIndex(query, target) >= 0;
}
