"use client";
import { useEffect } from "react";

/**
 * Registers the PWA service worker and swaps in new versions without leaving the
 * user on a stale shell: when an updated worker finishes installing we tell it to
 * take over, then reload once.
 */
export default function ServiceWorkerRegistrar() {
  useEffect(() => {
    if (!("serviceWorker" in navigator)) return;

    let reloading = false;
    const onControllerChange = () => {
      if (reloading) return;
      reloading = true;
      window.location.reload();
    };
    navigator.serviceWorker.addEventListener("controllerchange", onControllerChange);

    navigator.serviceWorker
      .register("/sw.js", { scope: "/", updateViaCache: "none" })
      .then((registration) => {
        registration.addEventListener("updatefound", () => {
          const installing = registration.installing;
          if (!installing) return;
          installing.addEventListener("statechange", () => {
            // A controller already exists => this is an update, not a first install.
            if (installing.state === "installed" && navigator.serviceWorker.controller) {
              installing.postMessage("SKIP_WAITING");
            }
          });
        });
      })
      .catch((error) => {
        console.warn("[pwa] service worker registration failed", error);
      });

    return () => {
      navigator.serviceWorker.removeEventListener("controllerchange", onControllerChange);
    };
  }, []);

  return null;
}
