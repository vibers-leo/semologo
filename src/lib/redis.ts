import Redis from "ioredis";

/**
 * 공용 redis-shared 연결 (DB 6 = semologo).
 *
 * 왜 Redis 인가 — 히트 카운터는 INCR 한 번이면 끝이고 원자적이다.
 * Firestore 로 하면 쓰기마다 과금되고, 같은 문서에 몰리면 경합이 난다.
 * CLAUDE.md 의 공용 인프라 원칙대로 개별 컨테이너를 새로 띄우지 않는다.
 *
 * ⚠️ 연결 실패가 페이지를 죽이면 안 된다. 순위는 부가 기능이지
 *    로고를 못 보게 만들 이유가 없다 — 호출부에서 항상 try/catch 한다.
 */

const URL_ = process.env.REDIS_URL || "redis://redis-shared:6379/6";

let client: Redis | null = null;

export function redis(): Redis | null {
  if (client) return client;
  try {
    client = new Redis(URL_, {
      // 재시도를 무한정 하면 요청이 매달린다. 몇 번 실패하면 포기하고
      // 순위 없이 동작한다(빈 결과와 실패를 구분해 로그로 남긴다).
      maxRetriesPerRequest: 2,
      connectTimeout: 2000,
      lazyConnect: false,
      retryStrategy: (times) => (times > 3 ? null : Math.min(times * 200, 1000)),
    });
    client.on("error", (e) => {
      console.error("[redis]", e.message.slice(0, 120));
    });
    return client;
  } catch (e) {
    console.error("[redis] 연결 생성 실패", (e as Error).message.slice(0, 120));
    return null;
  }
}
