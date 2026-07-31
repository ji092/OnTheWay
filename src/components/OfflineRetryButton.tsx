"use client";

/**
 * Full page reload rather than a client-side navigation: the offline shell is
 * served by the service worker, so recovering means re-fetching from the network.
 */
export default function OfflineRetryButton() {
  return (
    <button type="button" className="primaryBtn" onClick={() => window.location.assign("/")}>
      다시 시도
    </button>
  );
}
