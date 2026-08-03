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
  increment, orderBy, query, limit, type DocumentData,
} from "firebase/firestore";

export const FLAG_THRESHOLD = 3;

export interface QualityData {
  up: number;
  down: number;
  flagged: boolean;
}

export interface QualityEntry extends QualityData {
  brandId: string;
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
  vote: "up" | "down"
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
  if (typeof window !== "undefined") {
    localStorage.setItem(LS_KEY(brandId), vote);
  }
  return { up: newUp, down: newDown, flagged };
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
    }));
  } catch {
    return [];
  }
}
