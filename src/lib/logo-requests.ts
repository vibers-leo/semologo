"use client";

import {
  collection,
  query,
  orderBy,
  onSnapshot,
  Timestamp,
  doc,
  updateDoc,
  type Unsubscribe,
} from "firebase/firestore";
import { getClientDb } from "./firebase";

export interface LogoRequest {
  id?: string;
  brandName: string;
  brandNameEn?: string;
  website: string;
  note: string;
  status: "pending" | "done";
  createdAt: Timestamp;
}

export function listenLogoRequests(
  callback: (requests: LogoRequest[]) => void
): Unsubscribe {
  const db = getClientDb();
  const q = query(collection(db, "logo_requests_public"), orderBy("created_at", "desc"));
  return onSnapshot(q, (snap) => {
    callback(snap.docs.map((d) => {
      const data = d.data();
      const [brandName, brandNameEn] = String(data.brand_name ?? "").split(" / ", 2);
      return {
        id: d.id,
        brandName,
        brandNameEn,
        website: String(data.website ?? ""),
        note: String(data.note ?? ""),
        status: data.status === "done" ? "done" : "pending",
        createdAt: data.created_at as Timestamp,
      };
    }));
  });
}

export async function updateRequestStatus(
  id: string,
  status: "pending" | "done"
): Promise<void> {
  const db = getClientDb();
  await updateDoc(doc(db, "logo_requests_public", id), { status });
}
