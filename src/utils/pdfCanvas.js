// Draws a PDF onto canvases with pdf.js. Android browsers cannot display a PDF
// themselves (preview embeds stay blank, a blob tab opens empty, and there is
// nothing to print), so pages are rasterised here instead. pdf.js is loaded on
// demand so desktop and iOS never download it.

async function loadPdfJs() {
  const [pdfjs, worker] = await Promise.all([
    import("pdfjs-dist/legacy/build/pdf.min.mjs"),
    import("pdfjs-dist/legacy/build/pdf.worker.min.mjs?url"),
  ]);
  pdfjs.GlobalWorkerOptions.workerSrc = worker.default;
  return pdfjs;
}

/**
 * Appends one canvas per page to `container`, each `cssWidth` CSS pixels wide.
 * Stops early when `isCancelled()` turns true. Resolves to the pdf.js document
 * so the caller can destroy it.
 */
export async function renderPdfPages(
  blob,
  container,
  { cssWidth, pixelRatio = 1, className = "", isCancelled = () => false },
) {
  const pdfjs = await loadPdfJs();
  const data = new Uint8Array(await blob.arrayBuffer());
  const pdf = await pdfjs.getDocument({ data }).promise;

  for (let n = 1; n <= pdf.numPages; n += 1) {
    if (isCancelled()) return pdf;

    const page = await pdf.getPage(n);
    const base = page.getViewport({ scale: 1 });
    const scale = cssWidth / base.width;
    const viewport = page.getViewport({ scale: scale * pixelRatio });

    const canvas = document.createElement("canvas");
    canvas.width = Math.floor(viewport.width);
    canvas.height = Math.floor(viewport.height);
    canvas.style.width = `${cssWidth}px`;
    canvas.style.height = `${Math.floor(viewport.height / pixelRatio)}px`;
    if (className) canvas.className = className;
    container.appendChild(canvas);

    await page.render({
      canvasContext: canvas.getContext("2d"),
      viewport,
    }).promise;
  }

  return pdf;
}

/**
 * Prints a PDF blob without opening a tab: the pages are drawn into an
 * off-screen layer, the print stylesheet (see `.pdf-print-root` in index.css)
 * hides the rest of the app, and the system print dialog opens on the pages.
 */
export async function printPdfBlobAsCanvas(blob) {
  const root = document.createElement("div");
  root.className = "pdf-print-root";
  document.body.appendChild(root);

  let pdf = null;
  try {
    // ~150 dpi across an A4 page keeps text sharp on paper.
    pdf = await renderPdfPages(blob, root, {
      cssWidth: 1240,
      pixelRatio: 1,
      className: "pdf-print-page",
    });

    await new Promise((resolve) => {
      const finish = () => {
        window.removeEventListener("afterprint", finish);
        resolve();
      };
      window.addEventListener("afterprint", finish);
      // Some Android browsers never fire afterprint; do not leave the layer
      // behind forever.
      window.setTimeout(finish, 120_000);
      window.print();
    });
  } finally {
    pdf?.destroy();
    root.remove();
  }
}
