import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Lightsail(도커) 배포용 — Vercel 빌드에는 켜지 않는다 (Dockerfile 이 STANDALONE=1 로 빌드)
  ...(process.env.STANDALONE === "1" ? { output: "standalone" as const } : {}),
  cacheComponents: true,
  partialPrefetching: true,
  // 영수증 사진(최대 10MB)을 Server Action 으로 올린다 (F6-03)
  experimental: { serverActions: { bodySizeLimit: "10mb" } },
  // 기본 언어(ko)는 접두사 없이 "/" 로 연다. 실제 페이지는 /ko 로 만들어진다.
  async rewrites() {
    return [{ source: "/", destination: "/ko" }];
  },
  async redirects() {
    return [{ source: "/ko", destination: "/", permanent: true }];
  },
};

export default nextConfig;
