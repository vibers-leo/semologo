/**
 * out/ 에서 Next 의 세그먼트 프리페치 .txt 를 지운다.
 *
 * 왜 — Next 16 은 브랜드 1개당 파일을 5개 만든다:
 *   index.html · index.txt · __next._tree.txt · __next._full.txt
 *   · __next.brand.$d$id.__PAGE__.txt
 * 4.1만 브랜드면 20.5만 파일이라 Cloudflare Pages 의 배포당 파일 한도
 * (Free 2만 / Paid 10만)를 넘는다. .txt 를 지우면 브랜드당 1개로 줄어
 * 4.1만 파일이 된다(실측: 36,809 → 7,437, 604MB → 316MB).
 *
 * 잃는 것 — 페이지 간 클라이언트 네비게이션 프리페치. 링크를 누르면
 * 일반 페이지 로드로 떨어진다. 검색엔진 유입이 대부분이라 체감은 작다.
 *
 * `experimental.cachedNavigations: false` 는 **효과가 없었다**(무시됨).
 */
import { readdir, unlink, stat } from "node:fs/promises";
import { join } from "node:path";

const ROOT = "out";
let removed = 0;
let bytes = 0;

async function walk(dir) {
  for (const e of await readdir(dir, { withFileTypes: true })) {
    const p = join(dir, e.name);
    if (e.isDirectory()) await walk(p);
    else if (e.name.endsWith(".txt")) {
      bytes += (await stat(p)).size;
      await unlink(p);
      removed++;
    }
  }
}

await walk(join(ROOT, "brand"));
console.log(`프리페치 .txt ${removed.toLocaleString()}개 제거 (${(bytes / 1024 / 1024).toFixed(0)}MB)`);
