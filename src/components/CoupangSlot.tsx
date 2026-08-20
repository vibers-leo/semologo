"use client";

import { useEffect, useState } from "react";

/**
 * 쿠팡 파트너스 상품 슬롯.
 *
 * 위젯(iframe) 방식에서 오픈 API 방식으로 바꿨다 —
 * 위젯은 대시보드에서 발급하는 **위젯 ID + 트래킹 코드**가 필요한데 그 값이
 * 없어서(서버 .env 에 키만 있고 값이 비어 있었다) 컴포넌트가 조용히 null 을
 * 반환했고, 배너가 아예 안 나왔다. 보유 중인 오픈 API 키로 상품을 직접
 * 받아 오면 그 값 없이 동작하고, 응답의 productUrl 에 제휴 태그(lptag=AF…)가
 * 이미 박혀 있어 수수료 집계도 그대로다.
 *
 * ⚠️ 키는 서버 라우트(/api/coupang)에서만 쓴다. 클라이언트로 내보내면 안 된다.
 */

interface Product {
  id: number; name: string; price: number;
  image: string; url: string; rocket?: boolean;
}

interface Props {
  /** 유입 지면 구분용 — 지금은 로깅에만 쓴다 */
  subId?: string;
  /** 보여줄 상품 수 */
  count?: number;
}

export default function CoupangSlot({ count = 3 }: Props) {
  const [items, setItems] = useState<Product[] | null>(null);

  useEffect(() => {
    let alive = true;
    fetch("/api/coupang")
      .then(r => r.json())
      .then(d => { if (alive) setItems((d.products ?? []).slice(0, count)); })
      .catch(() => { if (alive) setItems([]); });   // 실패해도 화면은 안 깨진다
    return () => { alive = false; };
  }, [count]);

  // 로딩 중이거나 받아온 게 없으면 아무것도 그리지 않는다 —
  // 빈 상자나 자리표시자가 실제 사용자에게 보이면 안 된다.
  if (!items || items.length === 0) return null;

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
      <div style={{ fontSize: 11, fontWeight: 600, color: "var(--text-secondary)", letterSpacing: ".04em" }}>
        오늘의 특가
      </div>
      {items.map(p => (
        <a
          key={p.id}
          href={p.url}
          target="_blank"
          rel="nofollow sponsored noopener noreferrer"
          style={{
            display: "flex", gap: 10, alignItems: "center", padding: 8,
            borderRadius: 10, border: "1px solid var(--border)",
            background: "var(--surface)", textDecoration: "none",
          }}
        >
          <img
            src={p.image} alt="" loading="lazy" width={48} height={48}
            style={{ width: 48, height: 48, objectFit: "cover", borderRadius: 6, flexShrink: 0 }}
          />
          <span style={{ minWidth: 0, display: "flex", flexDirection: "column", gap: 2 }}>
            <span style={{
              fontSize: 12, lineHeight: 1.35, color: "var(--text-primary)",
              display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical",
              overflow: "hidden", wordBreak: "keep-all",
            }}>
              {p.name}
            </span>
            <span style={{ fontSize: 12, fontWeight: 700, color: "var(--text-primary)" }}>
              {Number(p.price).toLocaleString()}원
              {p.rocket && <span style={{ marginLeft: 4, fontSize: 10, color: "#00a0e9" }}>로켓</span>}
            </span>
          </span>
        </a>
      ))}
      {/* 공정위 추천·보증 심사지침 + 쿠팡 파트너스 정책상 필수 고지.
          빼면 제재 사유가 된다. 눈에 보이는 위치여야 한다.
          (API 응답의 rMessage 도 이 문구 기재를 명시적으로 요구한다) */}
      <p style={{ fontSize: 10, lineHeight: 1.5, color: "#a1a1aa", margin: 0 }}>
        이 광고는 쿠팡 파트너스 활동의 일환으로, 이에 따른 일정액의 수수료를 제공받습니다.
      </p>
    </div>
  );
}
