"use client";

// 카카오맵 JS SDK 타입은 공식 @types 패키지가 없어 최소한만 선언 (필요한 만큼만).
type KakaoMaps = {
  maps: {
    load: (cb: () => void) => void;
    LatLng: new (lat: number, lng: number) => unknown;
    Map: new (container: HTMLElement, opts: { center: unknown; level: number }) => {
      setCenter: (latlng: unknown) => void;
      setBounds: (bounds: unknown) => void;
    };
    Marker: new (opts: { position: unknown; map?: unknown }) => { setMap: (map: unknown | null) => void };
    Polyline: new (opts: {
      path: unknown[];
      strokeWeight: number;
      strokeColor: string;
      strokeOpacity: number;
      map?: unknown;
    }) => { setMap: (map: unknown | null) => void };
    LatLngBounds: new () => { extend: (latlng: unknown) => void };
  };
};

declare global {
  interface Window {
    kakao?: KakaoMaps;
  }
}

let loadPromise: Promise<KakaoMaps> | null = null;

/** 카카오맵 JS SDK를 1회만 로드(중복 호출 안전). NEXT_PUBLIC_KAKAO_JS_KEY 필요. */
export function loadKakaoMaps(): Promise<KakaoMaps> {
  if (loadPromise) return loadPromise;

  loadPromise = new Promise((resolve, reject) => {
    if (window.kakao?.maps) {
      resolve(window.kakao);
      return;
    }
    const key = process.env.NEXT_PUBLIC_KAKAO_JS_KEY;
    if (!key) {
      reject(new Error("NEXT_PUBLIC_KAKAO_JS_KEY not set"));
      return;
    }
    const script = document.createElement("script");
    script.src = `https://dapi.kakao.com/v2/maps/sdk.js?appkey=${key}&autoload=false`;
    script.async = true;
    script.onload = () => {
      window.kakao!.maps.load(() => resolve(window.kakao!));
    };
    script.onerror = () => reject(new Error("카카오맵 SDK 로드 실패"));
    document.head.appendChild(script);
  });

  return loadPromise;
}
