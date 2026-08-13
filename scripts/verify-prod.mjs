#!/usr/bin/env node
/**
 * 프로덕션 검증 — 배포 후 "정말 되는가"를 한 번에 확인한다.
 *
 * 왜 있는가:
 *   배포할 때마다 검색·PAGEERROR·라우트 상태를 확인하는데, 매번 임시 스크립트를
 *   새로 짜서 스크래치패드에 흩뿌리고 있었다(이번 세션에서만 6번 넘게).
 *   같은 걸 반복해서 짜면 매번 조금씩 다르고, 그래서 결과도 비교가 안 된다.
 *
 * 무엇을 보는가:
 *   1. 주요 라우트 HTTP 상태
 *   2. 검색 실동작 — 한글·영문·초성·별칭이 실제로 브랜드를 찾는가
 *   3. 콘솔 에러(PAGEERROR) — 하이드레이션 오류·광고 스크립트 사고를 잡는다
 *
 * 사용:
 *   node scripts/verify-prod.mjs                    # 기본 검사
 *   node scripts/verify-prod.mjs --brand atomy      # 특정 브랜드까지
 *   node scripts/verify-prod.mjs --q 애터미,ㅅㅅ      # 검색어 지정
 *
 * playwright-core 가 필요하다(브라우저는 이미 캐시에 있는 것을 쓴다):
 *   pnpm add -D playwright-core
 */
import { chromium } from "playwright-core";
import { existsSync, readdirSync } from "node:fs";
import { homedir } from "node:os";

const SITE = process.env.SEMOLOGO_SITE || "https://semologo.com";

/** 이미 받아둔 headless 크로미움을 찾는다. 없으면 안내하고 멈춘다. */
function findChromium() {
  if (process.env.CHROMIUM_PATH) return process.env.CHROMIUM_PATH;
  const base = `${homedir()}/Library/Caches/ms-playwright`;
  if (!existsSync(base)) return null;
  for (const dir of readdirSync(base).filter((d) => d.startsWith("chromium_headless_shell"))) {
    for (const sub of ["chrome-headless-shell-mac-arm64", "chrome-headless-shell-mac-x64"]) {
      const p = `${base}/${dir}/${sub}/chrome-headless-shell`;
      if (existsSync(p)) return p;
    }
  }
  return null;
}

const args = process.argv.slice(2);
const argOf = (name) => {
  const i = args.indexOf(name);
  return i >= 0 ? args[i + 1] : null;
};

const brand = argOf("--brand") || "samsung";
const queries = (argOf("--q") || "삼성,samsung,ㅅㅅ,엘지").split(",").map((s) => s.trim());

const ROUTES = ["/", `/brand/${brand}/`, "/request/", "/faq/", "/submit/"];

const exe = findChromium();
if (!exe) {
  console.error("headless 크로미움을 찾지 못했어요. CHROMIUM_PATH 를 지정하거나");
  console.error("`npx playwright install chromium` 으로 받아주세요.");
  process.exit(2);
}

let fail = 0;
const browser = await chromium.launch({ executablePath: exe });

// ── 1. 라우트 상태 ──
console.log("■ 라우트");
for (const r of ROUTES) {
  const page = await browser.newPage();
  const res = await page.goto(SITE + r, { waitUntil: "domcontentloaded", timeout: 60000 }).catch(() => null);
  const code = res?.status() ?? 0;
  const ok = code === 200;
  if (!ok) fail++;
  console.log(`  ${ok ? "✅" : "❌"} ${r.padEnd(22)} ${code || "실패"}`);
  await page.close();
}

// ── 2 · 3. 검색 + 콘솔 에러 ──
console.log("\n■ 검색 (한 페이지에서 연속 입력)");
const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
const errors = [];
page.on("pageerror", (e) => errors.push(String(e).split("\n")[0].slice(0, 90)));

await page.goto(SITE + "/", { waitUntil: "domcontentloaded", timeout: 60000 });
await page.waitForTimeout(6000);          // 목록 로드를 기다린다
const box = page.locator("input").first();

for (const q of queries) {
  await box.fill("");
  await page.waitForTimeout(250);
  await box.fill(q);
  await page.waitForTimeout(1800);        // useDeferredValue 가 반영될 시간
  // 헤더 로고를 결과로 오인하지 않도록 **메인 영역 안**에서만 찾는다.
  // 예전엔 alt 로 "세모로고" 를 걸러냈는데, 그러다 진짜 브랜드인 세모로고를
  // 검색했을 때 "결과 없음" 으로 잘못 판정했다.
  const hits = await page.evaluate(() => {
    const scope = document.querySelector("main") ?? document.body;
    return [...scope.querySelectorAll("img[alt]")]
      .map((i) => i.alt)
      .filter(Boolean)
      .slice(0, 3);
  });
  const ok = hits.length > 0;
  if (!ok) fail++;
  console.log(`  ${ok ? "✅" : "❌"} "${q}" → ${hits.join(" | ") || "(결과 없음)"}`);
}

console.log("\n■ 콘솔 에러");
if (errors.length) {
  fail++;
  console.log(`  ❌ PAGEERROR ${errors.length}건`);
  [...new Set(errors)].slice(0, 5).forEach((e) => console.log(`     ${e}`));
} else {
  console.log("  ✅ 없음");
}

await browser.close();
console.log(`\n${fail ? `❌ 실패 ${fail}건` : "✅ 전부 통과"}`);
process.exit(fail ? 1 : 0);
