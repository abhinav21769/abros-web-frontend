export function isMobileBrowser() {
  if (typeof navigator === "undefined") return false;
  return /Android|iPhone|iPad|iPod|Mobile/i.test(navigator.userAgent);
}

export function isAndroidBrowser() {
  if (typeof navigator === "undefined") return false;
  return /Android/i.test(navigator.userAgent);
}

// Phones and tablets, including Android Chrome in "Desktop site" mode, whose
// user agent no longer says Android but which still has touch and a Linux
// platform and still cannot show a PDF inline.
function isAndroidLike() {
  if (isAndroidBrowser()) return true;
  if (navigator.userAgentData?.mobile) return true;
  return (
    navigator.maxTouchPoints > 1 && /Linux|Android/i.test(navigator.platform || "")
  );
}

// Whether <object>/<iframe> can show a PDF. Android browsers cannot (they
// leave a blank box or offer an "Open" button); iOS Safari can.
export function canEmbedPdf() {
  if (typeof navigator === "undefined") return true;
  if (/iPhone|iPad|iPod/i.test(navigator.userAgent)) return true;
  if (isAndroidLike()) return false;
  return navigator.pdfViewerEnabled !== false;
}

export function ensurePdfBlob(blob) {
  if (blob instanceof Blob && blob.type === "application/pdf") {
    return blob;
  }
  return new Blob([blob], { type: "application/pdf" });
}

export function createPdfObjectUrl(blob) {
  return URL.createObjectURL(ensurePdfBlob(blob));
}

export function revokePdfObjectUrl(url) {
  if (url) URL.revokeObjectURL(url);
}

export function openPdfBlobInNewTab(blob) {
  const url = createPdfObjectUrl(blob);
  const opened = window.open(url, "_blank", "noopener,noreferrer");

  if (!opened) {
    const link = document.createElement("a");
    link.href = url;
    link.target = "_blank";
    link.rel = "noopener noreferrer";
    document.body.appendChild(link);
    link.click();
    link.remove();
  }

  window.setTimeout(() => URL.revokeObjectURL(url), 120_000);
}

export function savePdfBlob(blob, filename) {
  const url = createPdfObjectUrl(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;

  if (isMobileBrowser()) {
    link.target = "_blank";
    link.rel = "noopener noreferrer";
  }

  document.body.appendChild(link);
  link.click();
  link.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 120_000);
}
