/* Keep the 40k-brand search loop off the main thread. */
const CHO = ["ㄱ","ㄲ","ㄴ","ㄷ","ㄸ","ㄹ","ㅁ","ㅂ","ㅃ","ㅅ","ㅆ","ㅇ","ㅈ","ㅉ","ㅊ","ㅋ","ㅌ","ㅍ","ㅎ"];
const HANGUL_BASE = 0xac00, HANGUL_LAST = 0xd7a3, JUNG_JONG = 21 * 28;
let records = [];
function toChoseong(text) {
  let out = "";
  for (const ch of text || "") {
    const code = ch.charCodeAt(0);
    out += code >= HANGUL_BASE && code <= HANGUL_LAST ? CHO[Math.floor((code - HANGUL_BASE) / JUNG_JONG)] : ch;
  }
  return out;
}
function choseongIndex(query, target) {
  const q = (query || "").replace(/\s/g, ""), t = (target || "").replace(/\s/g, "");
  if (!q || !t) return -1;
  const tCho = toChoseong(t);
  for (let start = 0; start + q.length <= t.length; start++) {
    let ok = true;
    for (let i = 0; i < q.length; i++) {
      const isJamo = /[ㄱ-ㅎ]/.test(q[i]);
      if ((isJamo ? tCho[start + i] : t[start + i]) !== q[i]) { ok = false; break; }
    }
    if (ok) return start;
  }
  return -1;
}
function search(raw) {
  const q = (raw || "").trim().toLowerCase();
  if (!q) return records.map(r => r.id);
  const choseong = /[ㄱ-ㅎ]/.test(q.replace(/\s/g, "")), scored = [];
  for (const r of records) {
    const idx = choseong ? Math.max(choseongIndex(q, r.ko), ...r.aliases.map(a => choseongIndex(q, a))) : -1;
    const textAt = r.hay.indexOf(q);
    if (idx < 0 && textAt < 0) continue;
    const exact = r.idLower === q || r.enLower === q || r.koLower === q || r.aliasLower.includes(q);
    const positions = [idx, textAt].filter(x => x >= 0);
    const at = positions.includes(0) ? 0 : Math.min(...positions) + 1;
    scored.push({ id: r.id, rank: (exact ? -1000 : 0) + at * 100 + r.ko.length });
  }
  scored.sort((a, b) => a.rank - b.rank);
  return scored.map(x => x.id);
}
self.onmessage = event => {
  const m = event.data || {};
  if (m.type === "init") {
    records = (m.records || []).map(r => {
      const aliases = Array.isArray(r.aliases) ? r.aliases.filter(Boolean).map(String) : [];
      const ko = String(r.name_ko || ""), en = String(r.name_en || "");
      return { id: String(r.id), ko, aliases, hay: `${ko} ${en} ${r.id} ${aliases.join(" ")}`.toLowerCase(), idLower: String(r.id).toLowerCase(), enLower: en.toLowerCase(), koLower: ko.toLowerCase(), aliasLower: aliases.map(a => a.toLowerCase()) };
    });
    self.postMessage({ type: "ready" });
  } else if (m.type === "search") {
    self.postMessage({ type: "result", query: m.query || "", ids: search(m.query) });
  }
};
