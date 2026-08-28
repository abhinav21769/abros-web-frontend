// L-1 FIX: reports used to be assembled into a `data:text/csv` URI passed
// through encodeURI, which leaves "#" untouched - the browser then reads
// everything after it as a URL fragment, so a medicine named "Vitamin #5"
// silently truncated the download at that row. A Blob is not parsed as a URL and
// has no practical size limit, so large reports survive too.

// Excel and Google Sheets evaluate a cell beginning with any of these as a
// formula, quoted or not. A leading apostrophe keeps it as text.
const FORMULA_LEAD = /^[=+\-@\t\r]/;

export function csvCell(value) {
  if (value == null) return "";
  if (typeof value === "number") {
    return Number.isFinite(value) ? String(value) : "";
  }

  const text = FORMULA_LEAD.test(String(value)) ? `'${value}` : String(value);
  return `"${text.replace(/"/g, '""')}"`;
}

export function buildCsv(headers, rows) {
  return [headers, ...rows]
    .map((row) => row.map(csvCell).join(","))
    .join("\r\n");
}

export function downloadCsv(filename, headers, rows) {
  // The BOM makes Excel read the file as UTF-8 rather than the local codepage.
  const blob = new Blob(["﻿", buildCsv(headers, rows)], {
    type: "text/csv;charset=utf-8;",
  });
  const url = URL.createObjectURL(blob);

  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();

  window.setTimeout(() => URL.revokeObjectURL(url), 1000);
}
