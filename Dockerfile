# Node 22 필수 — pnpm 11 은 Node 20 에서 ERR_UNKNOWN_BUILTIN_MODULE 로 죽는다
FROM node:22-alpine AS base
RUN corepack enable
WORKDIR /app

FROM base AS deps
# pnpm-workspace.yaml 을 빠뜨리면 allowBuilds 가 안 먹어 postinstall 이 차단된다
COPY package.json pnpm-lock.yaml pnpm-workspace.yam[l] ./
RUN pnpm install --frozen-lockfile

FROM base AS builder
COPY --from=deps /app/node_modules ./node_modules
COPY . .
# Next.js 빌드 메모리 (조직 표준)
ENV NODE_OPTIONS="--max-old-space-size=4096"
ENV NEXT_TELEMETRY_DISABLED=1
ARG NEXT_PUBLIC_CDN_URL
ARG NEXT_PUBLIC_APP_URL
ARG NEXT_PUBLIC_FIREBASE_API_KEY
ARG NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN
ARG NEXT_PUBLIC_FIREBASE_PROJECT_ID
ARG NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET
ARG NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID
ARG NEXT_PUBLIC_FIREBASE_APP_ID
ARG NEXT_PUBLIC_COUPANG_WIDGET_ID
ARG NEXT_PUBLIC_COUPANG_TRACKING_CODE
ENV NEXT_PUBLIC_CDN_URL=$NEXT_PUBLIC_CDN_URL \
    NEXT_PUBLIC_APP_URL=$NEXT_PUBLIC_APP_URL \
    NEXT_PUBLIC_FIREBASE_API_KEY=$NEXT_PUBLIC_FIREBASE_API_KEY \
    NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=$NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN \
    NEXT_PUBLIC_FIREBASE_PROJECT_ID=$NEXT_PUBLIC_FIREBASE_PROJECT_ID \
    NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET=$NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET \
    NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=$NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID \
    NEXT_PUBLIC_FIREBASE_APP_ID=$NEXT_PUBLIC_FIREBASE_APP_ID \
    NEXT_PUBLIC_COUPANG_WIDGET_ID=$NEXT_PUBLIC_COUPANG_WIDGET_ID \
    NEXT_PUBLIC_COUPANG_TRACKING_CODE=$NEXT_PUBLIC_COUPANG_TRACKING_CODE
RUN pnpm run build

FROM base AS runner
ENV NODE_ENV=production NEXT_TELEMETRY_DISABLED=1 PORT=3000 HOSTNAME=0.0.0.0
RUN addgroup -g 1001 -S nodejs && adduser -S nextjs -u 1001
COPY --from=builder /app/public ./public
# standalone 은 server.js 와 최소 node_modules 만 담는다
COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static
# ISR 로 새로 만든 페이지가 여기 쌓인다. 쓰기 권한이 없으면 매 요청마다 다시 만든다.
RUN mkdir -p .next/cache && chown -R nextjs:nodejs .next/cache
USER nextjs
EXPOSE 3000
CMD ["node", "server.js"]
