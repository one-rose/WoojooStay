# 우주스테이 화면(Next.js) — 운영 이미지 (deploy/docker-compose.yml 에서 빌드)
# Vercel 배포에는 영향 없음: standalone 출력은 STANDALONE=1 로 빌드할 때만 켠다.
FROM node:22-slim AS build
WORKDIR /app
RUN corepack enable
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
RUN pnpm install --frozen-lockfile
COPY . .
ENV NEXT_TELEMETRY_DISABLED=1 STANDALONE=1
# 빌드 때 PMS_API_URL 이 있어야 /app 화면이 실서버 모드로 만들어진다
ARG PMS_API_URL=http://api:4000
ARG NEXT_PUBLIC_SITE_URL
ENV PMS_API_URL=$PMS_API_URL NEXT_PUBLIC_SITE_URL=$NEXT_PUBLIC_SITE_URL
RUN pnpm build

FROM node:22-slim
WORKDIR /app
ENV NODE_ENV=production NEXT_TELEMETRY_DISABLED=1 PORT=3000 HOSTNAME=0.0.0.0
COPY --chown=node:node --from=build /app/.next/standalone ./
COPY --chown=node:node --from=build /app/.next/static ./.next/static
COPY --chown=node:node --from=build /app/public ./public
USER node
EXPOSE 3000
CMD ["node", "server.js"]
