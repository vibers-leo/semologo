/**
 * 로고 품질 투표 — Firestore `logo_quality/{brandId}`
 *
 * 스키마:
 *   up:      number   👍 좋아요
 *   down:    number   🚩 교체 필요
 *   flagged: boolean  down >= FLAG_THRESHOLD 시 true
 */

import { getClientDb } from "./firebase";
import {
  collection, doc, getDoc, getDocs, setDoc, updateDoc,
  increment, orderBy, query, limit, where, type DocumentData,
} from "firebase/firestore";

export const FLAG_THRESHOLD = 1;

const ALERT_URL = "https://ai.vibers.co.kr/api/semo-flag";

async function notifyFlag(brandId: string, brandName: string, down: number) {
  try {
    await fetch(ALERT_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ brandId, brandName, down }),
    });
  } catch {
    // 알림 실패는 조용히 무시
  }
}

export interface QualityData {
  up: number;
  down: number;
  flagged: boolean;
}

export interface QualityEntry extends QualityData {
  brandId: string;
  resolvedAt?: string;
}

const COLL = "logo_quality";
const LS_KEY = (id: string) => `qv_${id}`;

export async function loadQuality(brandId: string): Promise<QualityData> {
  try {
    const db = getClientDb();
    const snap = await getDoc(doc(db, COLL, brandId));
    if (!snap.exists()) return { up: 0, down: 0, flagged: false };
    const d = snap.data() as DocumentData;
    return { up: d.up || 0, down: d.down || 0, flagged: d.flagged || false };
  } catch {
    return { up: 0, down: 0, flagged: false };
  }
}

export function getMyVote(brandId: string): "up" | "down" | null {
  if (typeof window === "undefined") return null;
  return (localStorage.getItem(LS_KEY(brandId)) as "up" | "down") || null;
}

export async function voteQuality(
  brandId: string,
  vote: "up" | "down",
  brandName?: string,
): Promise<QualityData> {
  const db = getClientDb();
  const ref = doc(db, COLL, brandId);
  const snap = await getDoc(ref);

  let newUp = 0, newDown = 0;

  if (snap.exists()) {
    const d = snap.data();
    newUp   = (d.up   || 0) + (vote === "up"   ? 1 : 0);
    newDown = (d.down || 0) + (vote === "down"  ? 1 : 0);
    const update: Record<string, unknown> = { [vote]: increment(1) };
    if (vote === "down" && newDown >= FLAG_THRESHOLD) update.flagged = true;
    await updateDoc(ref, update);
  } else {
    newUp   = vote === "up"   ? 1 : 0;
    newDown = vote === "down" ? 1 : 0;
    await setDoc(ref, {
      up: newUp, down: newDown,
      flagged: vote === "down" && newDown >= FLAG_THRESHOLD,
    });
  }

  const flagged = newDown >= FLAG_THRESHOLD;

  if (vote === "down" && flagged) {
    notifyFlag(brandId, brandName || brandId, newDown);
  }

  if (typeof window !== "undefined") {
    localStorage.setItem(LS_KEY(brandId), vote);
  }
  return { up: newUp, down: newDown, flagged };
}

/**
 * 내 투표 취소 — 같은 버튼을 한 번 더 누르면 되돌린다.
 *
 * 예전엔 한 번 누르면 잠겨서 실수를 못 되돌렸다("이미 투표했어요").
 * 카운트를 1 내린다. 규칙은 로그인 사용자에게만 -1 을 허용한다(익명 조작 방지).
 * flagged 는 건드리지 않는다 — 신고 해제는 관리자의 일이다.
 */
export async function cancelQualityVote(
  brandId: string,
  vote: "up" | "down",
): Promise<QualityData> {
  const db = getClientDb();
  const ref = doc(db, COLL, brandId);
  await updateDoc(ref, { [vote]: increment(-1) });
  if (typeof window !== "undefined") localStorage.removeItem(LS_KEY(brandId));
  const snap = await getDoc(ref);
  const d = (snap.data() || {}) as DocumentData;
  return { up: Math.max(0, d.up || 0), down: Math.max(0, d.down || 0), flagged: d.flagged || false };
}

/**
 * 관리자용: 신고를 처리 완료로 표시한다.
 *
 * 예전에는 목록만 있고 이 동작이 없어서, 로고를 실제로 교체해도 🚩 가
 * 영원히 남았다. 투표수는 지우지 않는다 — 어떤 로고가 반복해서 신고되는지가
 * 다음 수집 우선순위를 정하는 데 쓰이기 때문이다.
 */
export async function resolveQuality(brandId: string): Promise<void> {
  const db = getClientDb();
  await updateDoc(doc(db, COLL, brandId), {
    flagged: false,
    resolvedAt: new Date().toISOString(),
  });
}


/**
 * 교체 필요로 신고된 브랜드 id 집합.
 *
 * 인기순 정렬에서 빼는 데 쓴다 — 품질이 나쁘다고 신고된 로고가 첫 화면
 * 상위를 차지하면 서비스 인상이 나빠진다(uefa-europa-league 는 fame=101 로
 * 실제 상위권이었다). 목록·검색에서는 계속 보인다: 사용자가 더 나은 버전을
 * 제보할 통로를 막지 않기 위해서다.
 *
 * 실패하면 빈 집합을 준다 — 신고 조회가 안 된다고 정렬이 멈추면 안 된다.
 */
export async function loadFlaggedIds(): Promise<Set<string>> {
  try {
    const db = getClientDb();
    const snap = await getDocs(query(collection(db, COLL), where("flagged", "==", true), limit(500)));
    return new Set(snap.docs.map(d => d.id));
  } catch {
    return new Set();
  }
}

/** 관리자용: 교체 필요 투표 많은 순으로 최대 100개 */
export async function loadQualityRanking(maxItems = 100): Promise<QualityEntry[]> {
  try {
    const db = getClientDb();
    const q = query(collection(db, COLL), orderBy("down", "desc"), limit(maxItems));
    const snap = await getDocs(q);
    return snap.docs.map(d => ({
      brandId: d.id,
      up: d.data().up || 0,
      down: d.data().down || 0,
      flagged: d.data().flagged || false,
      resolvedAt: d.data().resolvedAt || undefined,
    }));
  } catch {
    return [];
  }
}
