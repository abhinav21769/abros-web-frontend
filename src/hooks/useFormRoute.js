import { useCallback, useEffect, useRef } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import useIsMobile from "./useIsMobile";

/**
 * Route-backed dialogs.
 *
 * A list page (Customers, Inventory, ...) is mounted at `${basePath}/*`, so it
 * stays mounted - keeping its filters, search, page and scroll position - while
 * the part of the URL after `basePath` says which form is open:
 *
 *   /customers/new          -> segments ["new"]
 *   /customers/abc123/edit  -> segments ["abc123", "edit"]
 *
 * On mobile the page opens its forms by navigating to those URLs and renders
 * them full-screen (see ui/Modal). On desktop it keeps using local state and
 * the same dialog content. `onEnter(segments, { close })` runs when the URL points at a
 * form the page did not open itself (a reload, a deep link, browser forward) so
 * the page can load whatever that form needs.
 */
export default function useFormRoute(basePath, onEnter) {
  const location = useLocation();
  const navigate = useNavigate();
  const isMobile = useIsMobile();

  const base = basePath.replace(/\/$/, "");
  const { pathname, search, state } = location;
  const rest = pathname.startsWith(`${base}/`) ? pathname.slice(base.length + 1) : "";
  const key = rest.split("/").filter(Boolean).join("/");
  const segments = key ? key.split("/") : [];

  // Back to wherever the form was opened from. A form reached by pasting the
  // URL has no list entry behind it, so it goes to the list instead.
  const close = useCallback(() => {
    if (state?.fromList) navigate(-1);
    else navigate({ pathname: base, search }, { replace: true });
  }, [navigate, base, search, state]);

  const skipRef = useRef(null);
  const onEnterRef = useRef(onEnter);
  const closeRef = useRef(close);
  useEffect(() => {
    onEnterRef.current = onEnter;
    closeRef.current = close;
  });

  useEffect(() => {
    if (!key) {
      skipRef.current = null;
      return;
    }
    if (skipRef.current === key) {
      skipRef.current = null;
      return;
    }
    skipRef.current = null;
    onEnterRef.current?.(key.split("/"), { close: closeRef.current });
  }, [key]);

  const target = useCallback(
    (sub) => ({ pathname: `${base}/${sub}`, search }),
    [base, search],
  );

  // Push a form onto the history stack so browser/OS back returns to the list.
  const open = useCallback(
    (sub) => {
      skipRef.current = sub;
      navigate(target(sub), { state: { fromList: true } });
    },
    [navigate, target],
  );

  // Swap one form for another without leaving an extra history entry.
  const replace = useCallback(
    (sub) => {
      skipRef.current = sub;
      navigate(target(sub), { replace: true, state });
    },
    [navigate, target, state],
  );

  return { isMobile, segments, key, open, replace, close };
}
