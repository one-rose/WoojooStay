import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  cacheComponents: true,
  partialPrefetching: true,
  // 기본 언어(ko)는 접두사 없이 "/" 로 연다. 실제 페이지는 /ko 로 만들어진다.
  async rewrites() {
    return [{ source: "/", destination: "/ko" }];
  },
  async redirects() {
    return [{ source: "/ko", destination: "/", permanent: true }];
  },
};

export default nextConfig;
