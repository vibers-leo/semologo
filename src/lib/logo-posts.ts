import { collection, deleteDoc, doc, getDocs, orderBy, query, setDoc } from "firebase/firestore";
import { getClientDb } from "./firebase";
import type { Brand } from "./brands";

/**
 * CMS형 로고 게시물. 파일은 Object Storage/CDN에 두고, 이 문서는 게시 상태와
 * 검색·분류·연관 로고만 관리한다. 기존 정적 카탈로그와 병행할 수 있게 Brand를
 * 확장하는 형태로 저장한다.
 */
export interface LogoPost extends Brand {
  post_type: "logo";
  status: "draft" | "published" | "archived";
  created_at: string;
  updated_at: string;
  published_at?: string;
  author_uid?: string;
  related_ids?: string[];
  tags?: string[];
  source_urls?: string[];
}

export const LOGO_POSTS_COLLECTION = "logo_posts";

export function toLogoPost(brand: Brand, extra: Partial<LogoPost> = {}): LogoPost {
  const now = new Date().toISOString();
  return {
    ...brand,
    post_type: "logo",
    status: "published",
    created_at: now,
    updated_at: now,
    ...extra,
  };
}

export async function listPublishedLogoPosts(): Promise<LogoPost[]> {
  const snap = await getDocs(query(collection(getClientDb(), LOGO_POSTS_COLLECTION), orderBy("published_at", "desc")));
  return snap.docs
    .map(d => d.data() as LogoPost)
    .filter(post => post.status === "published");
}

export async function listLogoPosts(): Promise<LogoPost[]> {
  const snap = await getDocs(query(collection(getClientDb(), LOGO_POSTS_COLLECTION), orderBy("updated_at", "desc")));
  return snap.docs.map(d => d.data() as LogoPost);
}

export async function saveLogoPost(post: LogoPost): Promise<void> {
  await setDoc(doc(getClientDb(), LOGO_POSTS_COLLECTION, post.id), {
    ...post,
    updated_at: new Date().toISOString(),
  }, { merge: true });
}

export async function deleteLogoPost(id: string): Promise<void> {
  await deleteDoc(doc(getClientDb(), LOGO_POSTS_COLLECTION, id));
}
