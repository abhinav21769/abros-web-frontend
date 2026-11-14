import { useEffect, useRef, useState } from "react";
import { renderPdfPages } from "../utils/pdfCanvas";

/**
 * Renders a PDF blob page by page onto canvases. Android browsers have no
 * built-in PDF viewer, so an <object>/<iframe> pointing at a PDF stays blank
 * there; drawing the pages ourselves works everywhere. pdf.js is loaded on
 * demand so desktop and iOS never download it.
 */
export default function PdfCanvasViewer({ blob, label, onError }) {
  const containerRef = useRef(null);
  const [rendering, setRendering] = useState(true);

  useEffect(() => {
    const container = containerRef.current;
    if (!blob || !container) return undefined;

    let cancelled = false;
    let pdf = null;
    setRendering(true);
    container.replaceChildren();

    (async () => {
      try {
        pdf = await renderPdfPages(blob, container, {
          cssWidth: container.clientWidth || window.innerWidth,
          pixelRatio: Math.min(window.devicePixelRatio || 1, 3),
          className: "pdf-canvas-page",
          isCancelled: () => cancelled,
        });
      } catch (err) {
        if (!cancelled) onError?.(err);
      } finally {
        if (!cancelled) setRendering(false);
      }
    })();

    return () => {
      cancelled = true;
      pdf?.destroy();
    };
  }, [blob, onError]);

  return (
    <div className="pdf-canvas-viewer" aria-label={label} role="document">
      <div ref={containerRef} className="pdf-canvas-pages" />
      {rendering && <p className="pdf-canvas-status">Rendering pages...</p>}
    </div>
  );
}
