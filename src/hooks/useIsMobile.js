import { useSyncExternalStore } from "react";

// The width at which the app swaps its sidebar for the mobile header (see the
// `@media (max-width: 1024px)` shell rules in index.css). Dialogs turn into
// full pages at the same point so the two never disagree.
export const MOBILE_BREAKPOINT_PX = 1024;
export const MOBILE_QUERY = `(max-width: ${MOBILE_BREAKPOINT_PX}px)`;

function getMediaQueryList() {
  if (typeof window === "undefined" || typeof window.matchMedia !== "function") {
    return null;
  }
  return window.matchMedia(MOBILE_QUERY);
}

function subscribe(callback) {
  const mql = getMediaQueryList();
  if (!mql?.addEventListener) return () => {};
  mql.addEventListener("change", callback);
  return () => mql.removeEventListener("change", callback);
}

const getSnapshot = () => Boolean(getMediaQueryList()?.matches);

export default function useIsMobile() {
  return useSyncExternalStore(subscribe, getSnapshot, () => false);
}
