"use client";

import {
  collection,
  addDoc,
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
  userId: string;
  userEmail: string;
  userDisplayName: string;
  brandName: string;
  brandNameEn: string;
  website: string;
  note: string;
  status: "pending" | "done";
  createdAt: Timestamp;
}

export async function submitLogoRequest(
  data: Omit<LogoRequest, "id" | "createdAt" | "status">
): Promise<string> {
  const db = getClientDb();
  const ref = await addDoc(collection(db, "logo_requests"), {
    ...data,
    status: "pending",
    createdAt: Timestamp.now(),
  });
  return ref.id;
}

export function listenLogoRequests(
  callback: (requests: LogoRequest[]) => void
): Unsubscribe {
  const db = getClientDb();
  const q = query(collection(db, "logo_requests"), orderBy("createdAt", "desc"));
  return onSnapshot(q, (snap) => {
    callback(snap.docs.map((d) => ({ id: d.id, ...d.data() } as LogoRequest)));
  });
}

export async function updateRequestStatus(
  id: string,
  status: "pending" | "done"
): Promise<void> {
  const db = getClientDb();
  await updateDoc(doc(db, "logo_requests", id), { status });
}
