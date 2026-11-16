# 우주스테이 API — 운영 이미지 (deploy/docker-compose.yml 에서 빌드)
FROM node:22-slim AS build
WORKDIR /app
# Prisma 가 설치 때 openssl 버전에 맞는 엔진을 받도록 (없으면 실행할 때마다 다시 내려받음)
RUN apt-get update && apt-get install -y --no-install-recommends openssl ca-certificates && rm -rf /var/lib/apt/lists/*
RUN corepack enable
# 의존성 먼저 (소스만 바뀌면 이 층은 캐시)
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml prisma.config.ts ./
COPY prisma ./prisma
RUN pnpm install --frozen-lockfile
COPY tsconfig.json tsconfig.build.json nest-cli.json ./
COPY src ./src
RUN pnpm build

FROM node:22-slim
WORKDIR /app
ENV NODE_ENV=production
# Prisma 엔진이 쓰는 openssl
RUN apt-get update && apt-get install -y --no-install-recommends openssl ca-certificates && rm -rf /var/lib/apt/lists/*
COPY --chown=node:node --from=build /app/node_modules ./node_modules
COPY --chown=node:node --from=build /app/dist ./dist
COPY --chown=node:node --from=build /app/prisma ./prisma
COPY --chown=node:node package.json prisma.config.ts ./
RUN mkdir -p /app/uploads && chown node:node /app/uploads
USER node
EXPOSE 4000
# 시작할 때 마이그레이션을 먼저 적용 (이미 적용된 것은 건너뜀)
CMD ["sh", "-c", "npx prisma migrate deploy && node dist/main.js"]
