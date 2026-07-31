"use client";
import { useEffect, useState, useSyncExternalStore } from "react";

type BeforeInstallPromptEvent = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
};

const DISMISS_KEY = "otw:install-dismissed";

/** "hidden" = already installed, or the user closed the banner before. */
type Platform = "hidden" | "ios" | "other";

// Platform facts are read from the browser, not from state — an external store
// keeps them out of the render/effect loop and gives SSR a stable "hidden".
const subscribe = () => () => {};
const getServerPlatform = (): Platform => "hidden";

function getPlatform(): Platform {
  const standalone =
    window.matchMedia("(display-mode: standalone)").matches ||
    // iOS Safari reports installed apps here instead of via display-mode.
    (navigator as Navigator & { standalone?: boolean }).standalone === true;
  if (standalone || localStorage.getItem(DISMISS_KEY) === "1") return "hidden";
  return /iPad|iPhone|iPod/.test(navigator.userAgent) ? "ios" : "other";
}

/**
 * Home-screen install nudge. Android/Chromium gets the native prompt via
 * `beforeinstallprompt`; iOS Safari has no such API, so it gets the manual
 * "share -> add to home screen" instructions instead.
 */
export default function InstallPrompt() {
  const platform = useSyncExternalStore(subscribe, getPlatform, getServerPlatform);
  const [deferred, setDeferred] = useState<BeforeInstallPromptEvent | null>(null);
  const [closed, setClosed] = useState(false);

  useEffect(() => {
    const onBeforeInstall = (event: Event) => {
      event.preventDefault(); // suppress the mini-infobar; we prompt on tap
      setDeferred(event as BeforeInstallPromptEvent);
    };
    const onInstalled = () => setClosed(true);

    window.addEventListener("beforeinstallprompt", onBeforeInstall);
    window.addEventListener("appinstalled", onInstalled);
    return () => {
      window.removeEventListener("beforeinstallprompt", onBeforeInstall);
      window.removeEventListener("appinstalled", onInstalled);
    };
  }, []);

  const isIOS = platform === "ios";
  const visible = platform !== "hidden" && !closed && (isIOS || deferred !== null);
  if (!visible) return null;

  const dismiss = () => {
    localStorage.setItem(DISMISS_KEY, "1");
    setClosed(true);
  };

  const install = async () => {
    if (!deferred) return;
    await deferred.prompt();
    const { outcome } = await deferred.userChoice;
    setDeferred(null);
    if (outcome === "accepted") setClosed(true);
    else dismiss();
  };

  return (
    <div className="installPrompt" role="region" aria-label="앱 설치 안내">
      <div className="installPromptText">
        <strong>홈 화면에 추가</strong>
        <span>
          {isIOS
            ? "공유 버튼 → ‘홈 화면에 추가’를 누르면 앱처럼 쓸 수 있어요."
            : "설치하면 앱처럼 바로 열 수 있어요."}
        </span>
      </div>
      <div className="installPromptActions">
        {!isIOS && deferred && (
          <button type="button" className="installPromptCta" onClick={install}>
            설치
          </button>
        )}
        <button type="button" className="installPromptClose" onClick={dismiss} aria-label="닫기">
          ✕
        </button>
      </div>
    </div>
  );
}
