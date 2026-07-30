/**
 * 네이버맵 URL 스킴 길안내 핸드오프 (FS-7, 00_SPEC §3).
 * slat/slng 생략 → 네이버가 현재 위치를 출발지로 사용.
 * /route/car + *ecoords(정확좌표) 사용 — iOS 실기기에서 경유지가 추가 안 되는 문제
 * 리포트(2026-07-30) 대응. 네이버 공식 예시가 경유지 케이스에서 /route/car +
 * decoords/v1ecoords를 쓰는 걸 확인해 전환 — 좌표 대신 이름으로 재검색하다 실패해
 * 경유지가 조용히 빠지는 시나리오를 막기 위함. 재배포 후 실기기 재검증 필요.
 */

export type NaverWaypoint = { lat: number; lng: number; name: string };

function buildNmapUrl(dest: NaverWaypoint, waypoint: NaverWaypoint, appName: string): string {
  const params = new URLSearchParams({
    dlat: String(dest.lat),
    dlng: String(dest.lng),
    dname: dest.name,
    decoords: `${dest.lat},${dest.lng}`,
    v1lat: String(waypoint.lat),
    v1lng: String(waypoint.lng),
    v1name: waypoint.name,
    v1ecoords: `${waypoint.lat},${waypoint.lng}`,
    appname: appName,
  });
  return `nmap://route/car?${params.toString()}`;
}

const ANDROID_PACKAGE = "com.nhn.android.nmap";
const IOS_STORE_URL = "http://itunes.apple.com/app/id311867728?mt=8";

function isAndroid(): boolean {
  return /android/i.test(navigator.userAgent);
}

function isIOS(): boolean {
  return /iphone|ipad|ipod/i.test(navigator.userAgent);
}

/**
 * 네이버맵 길안내 실행 + 설치 폴백.
 * onFallback: 앱이 안 열렸을 때(설치 안 됨) 호출 — 스토어로 이동하기 직전 알림 등에 사용.
 */
export function launchNaverNavigation(
  dest: NaverWaypoint,
  waypoint: NaverWaypoint,
  appName: string,
  onFallback?: () => void,
): void {
  const url = buildNmapUrl(dest, waypoint, appName);
  const afterScheme = url.slice("nmap://".length); // "route/car?..." — intent URL의 host+path+query 부분

  if (isAndroid()) {
    const intentUrl =
      `intent://${afterScheme}` +
      `#Intent;scheme=nmap;action=android.intent.action.VIEW;` +
      `category=android.intent.category.BROWSABLE;package=${ANDROID_PACKAGE};end`;
    window.location.href = intentUrl;
    return;
  }

  if (isIOS()) {
    const start = Date.now();
    window.location.href = url;
    setTimeout(() => {
      // 1.5초 내 앱 전환(페이지 focus 상실)이 없었으면 미설치로 간주
      if (Date.now() - start < 1600 && !document.hidden) {
        onFallback?.();
        window.location.href = IOS_STORE_URL;
      }
    }, 1500);
    return;
  }

  // 데스크톱/기타: 스킴만 시도
  window.location.href = url;
}
