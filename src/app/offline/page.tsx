import type { Metadata } from "next";
import Header from "@/components/Header";
import OfflineRetryButton from "@/components/OfflineRetryButton";

export const metadata: Metadata = {
  title: "오프라인 — On The Way",
};

/** Shell the service worker serves when a navigation happens with no network. */
export default function OfflinePage() {
  return (
    <div className="page">
      <Header />
      <div className="screen">
        <p className="offlineTitle">인터넷에 연결되어 있지 않아요</p>
        <p className="offlineBody">
          경로와 주변 장소를 찾으려면 네트워크가 필요합니다. 연결을 확인한 뒤 다시 시도해 주세요.
        </p>
        <OfflineRetryButton />
      </div>
      <footer className="footer">네이버맵 연동 · 경로 기반 경유지 탐색</footer>
    </div>
  );
}
