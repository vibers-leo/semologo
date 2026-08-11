#!/usr/bin/env node
/**
 * 세모로고 MCP 서버 — AI 가 대화 중에 브랜드 로고를 찾아 바로 코드에 넣게 한다.
 *
 * 설계 원칙: **서버를 두지 않는다.**
 * 로고와 인덱스는 이미 공개 CDN(logo.vibers.co.kr)에 있고, 이미지는 Cloudflare
 * 엣지에서 끝난다. 이 프로세스는 사용자 기기에서 돌면서 CDN 을 읽을 뿐이라
 * 운영 비용도 인증도 필요 없다.
 *
 * 도구 3개:
 *   search_brands  이름·초성으로 찾기 ("ㅅㅅ" → 삼성)
 *   get_logo       SVG 원문을 그대로 받기 → 에이전트가 코드에 바로 붙인다
 *   get_logo_url   파일을 받지 않고 URL 만 (img src 로 쓸 때)
 */

import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} from "@modelcontextprotocol/sdk/types.js";

const CDN = process.env.SEMOLOGO_CDN || "https://logo.vibers.co.kr/_clients";
const SITE = "https://semologo.com";

/* ────────────────────────── 초성 검색 ──────────────────────────
   한국어 서비스에서 "ㅅㅅ" 로 삼성을 못 찾으면 검색이 제 역할을 못 한다.
   사이트(src/lib/hangul.ts)와 같은 규칙을 쓴다 — 결과가 달라지면 안 된다. */
const CHO = ["ㄱ","ㄲ","ㄴ","ㄷ","ㄸ","ㄹ","ㅁ","ㅂ","ㅃ","ㅅ","ㅆ","ㅇ","ㅈ","ㅉ","ㅊ","ㅋ","ㅌ","ㅍ","ㅎ"];
const HANGUL_BASE = 0xac00, HANGUL_LAST = 0xd7a3, JUNG_JONG = 588;

const toChoseong = (t) =>
  [...t].map((c) => {
    const k = c.charCodeAt(0);
    return k >= HANGUL_BASE && k <= HANGUL_LAST ? CHO[Math.floor((k - HANGUL_BASE) / JUNG_JONG)] : c;
  }).join("");

const hasJamo = (q) => /[ㄱ-ㅎ]/.test(q.replace(/\s/g, ""));

/** 매치 위치를 돌려준다(-1 이면 없음). 앞글자 매치를 위로 올리는 데 쓴다 —
 *  안 그러면 "ㅅㅅ" 에 골드만'삭스'·키르기'스스'탄 이 삼성보다 먼저 나온다. */
function choseongIndex(query, target) {
  const q = query.replace(/\s/g, "");
  const t = (target || "").replace(/\s/g, "");
  if (!q || !t) return -1;
  const tc = toChoseong(t);
  for (let s = 0; s + q.length <= t.length; s++) {
    let ok = true;
    for (let i = 0; i < q.length; i++) {
      const c = q[i];
      const jamo = c >= "ㄱ" && c <= "ㅎ";
      if (!(jamo ? tc[s + i] === c : t[s + i] === c)) { ok = false; break; }
    }
    if (ok) return s;
  }
  return -1;
}

/* ────────────────────────── 인덱스 ────────────────────────── */
let indexCache = null;

async function loadIndex() {
  if (indexCache) return indexCache;
  const res = await fetch(`${CDN}/brands-slim.json`);
  if (!res.ok) throw new Error(`브랜드 목록을 받지 못했어요 (HTTP ${res.status})`);
  const data = await res.json();
  const list = Array.isArray(data) ? data : data.brands ?? [];
  // variant_of = 부모로 흡수된 중복 항목. 로고가 아예 없는 것도 뺀다.
  indexCache = list.filter(
    (b) => !b.variant_of && (b.logo_svg || b.has_svg || b.logo_png || b.has_png),
  );
  return indexCache;
}

const hasSvg = (b) => !!(b.logo_svg || b.has_svg);
const hasPng = (b) => !!(b.logo_png || b.has_png);

function searchBrands(list, query, limit) {
  const raw = query.trim();
  const q = raw.toLowerCase();
  if (!q) return [];
  const cho = hasJamo(raw);
  const scored = [];
  for (const b of list) {
    // 별칭(aliases)까지 검색 대상에 넣는다. LG·SK 처럼 로마자가 정식 이름인
    // 브랜드를 '엘지'·'에스케이'로 찾을 수 있어야 한다.
    const alias = b.aliases ?? [];
    const hay = `${b.name_ko ?? ""} ${b.name_en ?? ""} ${b.id} ${alias.join(" ")}`.toLowerCase();
    const textAt = hay.indexOf(q);
    const choAt = cho
      ? Math.max(choseongIndex(raw, b.name_ko ?? ""), ...alias.map((a) => choseongIndex(raw, a)))
      : -1;
    if (textAt < 0 && choAt < 0) continue;

    // 정확히 일치하면 무조건 1등. 이게 없으면 "samsung" 을 물었을 때
    // samsung-life · samsung-card 같은 파생 브랜드가 본체보다 위에 올 수 있고,
    // 에이전트가 엉뚱한 로고를 코드에 넣어버린다.
    const exact =
      b.id.toLowerCase() === q ||
      (b.name_en ?? "").toLowerCase() === q ||
      (b.name_ko ?? "").toLowerCase() === q ||
      alias.some((a) => a.toLowerCase() === q);

    // 앞글자 매치가 그다음. 이름이 짧을수록 더 정확한 매치로 본다.
    const at = choAt === 0 || textAt === 0 ? 0 : Math.min(...[choAt, textAt].filter((x) => x >= 0)) + 1;
    scored.push({ b, rank: (exact ? -1000 : 0) + at * 100 + (b.name_ko?.length ?? 99) });
  }
  scored.sort((x, y) => x.rank - y.rank);
  return scored.slice(0, limit).map((s) => s.b);
}

const brief = (b) => ({
  id: b.id,
  name_ko: b.name_ko,
  name_en: b.name_en,
  category: b.category,
  formats: [hasSvg(b) && "svg", hasPng(b) && "png"].filter(Boolean),
  page: `${SITE}/brand/${b.id}/`,
});

/** CDN 이 404 일 때 GitHub Pages 는 200 에 HTML 을 준다.
 *  그대로 저장하면 "SVG 인데 열리지 않는 파일"이 된다 — 실제로 겪은 함정이라 막는다. */
function looksLikeSvg(text) {
  const head = text.slice(0, 400).toLowerCase();
  return head.includes("<svg") && !head.includes("<!doctype html");
}

/* ────────────────────────── 서버 ────────────────────────── */
const server = new Server(
  { name: "semologo", version: "0.1.0" },
  { capabilities: { tools: {} } },
);

const TOOLS = [
  {
    name: "search_brands",
    description:
      "세모로고에서 브랜드를 찾습니다. 한글·영문·초성 모두 됩니다 (예: '삼성', 'samsung', 'ㅅㅅ'). " +
      "로고를 코드에 넣어달라는 요청을 받으면 먼저 이걸로 브랜드 id 를 찾으세요.",
    inputSchema: {
      type: "object",
      properties: {
        query: { type: "string", description: "브랜드명 또는 초성" },
        limit: { type: "number", description: "최대 결과 수 (기본 10)" },
      },
      required: ["query"],
    },
  },
  {
    name: "get_logo",
    description:
      "브랜드 로고의 SVG 원문을 가져옵니다. 받은 내용을 그대로 코드나 파일에 넣으면 됩니다. " +
      "브랜드 id 는 search_brands 로 먼저 확인하세요.",
    inputSchema: {
      type: "object",
      properties: {
        id: { type: "string", description: "브랜드 id (예: samsung)" },
      },
      required: ["id"],
    },
  },
  {
    name: "get_logo_url",
    description:
      "로고 파일을 내려받지 않고 CDN URL 만 얻습니다. <img src> 나 CSS 에 바로 쓸 때 사용하세요.",
    inputSchema: {
      type: "object",
      properties: {
        id: { type: "string", description: "브랜드 id" },
        format: { type: "string", enum: ["svg", "png"], description: "기본 svg" },
      },
      required: ["id"],
    },
  },
];

server.setRequestHandler(ListToolsRequestSchema, async () => ({ tools: TOOLS }));

const text = (s) => ({ content: [{ type: "text", text: s }] });
const fail = (s) => ({ content: [{ type: "text", text: s }], isError: true });

server.setRequestHandler(CallToolRequestSchema, async (req) => {
  const { name, arguments: args = {} } = req.params;

  try {
    if (name === "search_brands") {
      const list = await loadIndex();
      const hits = searchBrands(list, String(args.query ?? ""), Number(args.limit) || 10);
      if (!hits.length) {
        return text(
          `"${args.query}" 로는 찾지 못했어요.\n` +
          `세모로고에 없는 브랜드일 수 있어요 — ${SITE}/request/ 에서 요청할 수 있습니다.`,
        );
      }
      return text(JSON.stringify({ count: hits.length, brands: hits.map(brief) }, null, 2));
    }

    if (name === "get_logo") {
      const id = String(args.id ?? "").trim();
      if (!id) return fail("브랜드 id 가 필요해요.");
      const res = await fetch(`${CDN}/${id}/logo.svg`);
      if (!res.ok) {
        return fail(`'${id}' 의 SVG 를 찾지 못했어요 (HTTP ${res.status}). search_brands 로 id 를 확인해 주세요.`);
      }
      const body = await res.text();
      if (!looksLikeSvg(body)) {
        return fail(`'${id}' 는 SVG 가 없는 브랜드예요. get_logo_url 로 PNG 주소를 받아 쓰세요.`);
      }
      return text(body);
    }

    if (name === "get_logo_url") {
      const id = String(args.id ?? "").trim();
      const format = args.format === "png" ? "png" : "svg";
      if (!id) return fail("브랜드 id 가 필요해요.");
      const url = `${CDN}/${id}/logo.${format}`;
      const res = await fetch(url, { method: "HEAD" });
      if (!res.ok) return fail(`'${id}' 의 ${format.toUpperCase()} 이 없어요 (HTTP ${res.status}).`);
      return text(url);
    }

    return fail(`알 수 없는 도구: ${name}`);
  } catch (e) {
    return fail(`요청을 처리하지 못했어요: ${e?.message ?? e}`);
  }
});

await server.connect(new StdioServerTransport());
