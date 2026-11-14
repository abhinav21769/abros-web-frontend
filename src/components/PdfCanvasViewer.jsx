import { useEffect, useRef, useState } from "react";

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
        const [pdfjs, worker] = await Promise.all([
          import("pdfjs-dist/legacy/build/pdf.min.mjs"),
          import("pdfjs-dist/legacy/build/pdf.worker.min.mjs?url"),
        ]);
        pdfjs.GlobalWorkerOptions.workerSrc = worker.default;

        const data = new Uint8Array(await blob.arrayBuffer());
        pdf = await pdfjs.getDocument({ data }).promise;

        const cssWidth = container.clientWidth || window.innerWidth;
        const pixelRatio = Math.min(window.devicePixelRatio || 1, 3);

        for (let n = 1; n <= pdf.numPages; n += 1) {
          if (cancelled) return;
          const page = await pdf.getPage(n);
          const base = page.getViewport({ scale: 1 });
          const scale = cssWidth / base.width;
          const viewport = page.getViewport({ scale: scale * pixelRatio });

          const canvas = document.createElement("canvas");
          canvas.width = Math.floor(viewport.width);
          canvas.height = Math.floor(viewport.height);
          canvas.style.width = `${cssWidth}px`;
          canvas.style.height = `${Math.floor(viewport.height / pixelRatio)}px`;
          canvas.className = "pdf-canvas-page";
          container.appendChild(canvas);

          await page.render({
            canvasContext: canvas.getContext("2d"),
            viewport,
          }).promise;
        }
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
