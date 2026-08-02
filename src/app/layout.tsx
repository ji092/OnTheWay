import type { Metadata, Viewport } from "next";
import "./globals.css";
import InstallPrompt from "@/components/InstallPrompt";
import ServiceWorkerRegistrar from "@/components/ServiceWorkerRegistrar";

/**
 * Pretendard 동적 서브셋 — unicode-range로 91개로 쪼개져 있어 실제로 쓰는 글자만 받는다.
 * 통짜 variable woff2는 2MB라 모바일에서 부담스러워 이 방식을 택했다.
 * next/font를 못 쓰는 대신 preconnect로 연결 비용을 줄인다.
 */
const PRETENDARD_CSS =
  "https://cdn.jsdelivr.net/gh/orioncactus/pretendard/dist/web/variable/pretendardvariable-dynamic-subset.min.css";

export const metadata: Metadata = {
  title: "On The Way",
  description: "가는 길에 — 경로 기반 경유지 추천",
  applicationName: "가는 길에",
  appleWebApp: {
    capable: true,
    title: "가는 길에",
    statusBarStyle: "default",
  },
  formatDetection: { telephone: false },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  // Fills the iPhone notch / Dynamic Island area; the safe-area insets in
  // globals.css keep content clear of it.
  viewportFit: "cover",
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#4f8ef7" },
    { media: "(prefers-color-scheme: dark)", color: "#0a0a0a" },
  ],
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="ko">
      <head>
        <link rel="preconnect" href="https://cdn.jsdelivr.net" crossOrigin="" />
        <link rel="stylesheet" href={PRETENDARD_CSS} />
      </head>
      <body>
        {children}
        <InstallPrompt />
        <ServiceWorkerRegistrar />
      </body>
    </html>
  );
}
