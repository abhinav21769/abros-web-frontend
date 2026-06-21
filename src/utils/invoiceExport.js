import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import {
  ensurePdfBlob,
  isMobileBrowser,
  openPdfBlobInNewTab,
  savePdfBlob,
} from "./pdfMobile";
import {
  calculateInvoiceTax,
  formatGstRate,
  getLineItemGstRate,
  getLineTotalWithGst,
} from "./invoiceTax";
import { isPaymentConfigured } from "../config/payment";
import { generateUpiQrDataUrl, getInvoicePaymentNote } from "./upiPayment";

const SELLER = {
  name: "ABROS HEALTHCARE",
  addressLine: "Shop-2, Shivpuri Colony, Sultanpur, Ambala City.",
  pincode: "134003",
  phone: "8295566445",
  phoneDisplay: "82955-66445",
  gstin: "06AFUPJ3372H1Z5",
  dlNumbers: ["WLF20B2026HR000446", "WLF21B2026HR000442"],
  bankName: "Punjab National Bank, Prem Nagar",
  ifsc: "PUNB0120310",
  account: "10401132000162",
  forLabel: "For ABROS HEALTHCARE",
};

function getPaymentTypeLabel(invoice) {
  return invoice?.paymentType === "cash" ? "CASH" : "CREDIT";
}

function formatAmount(value) {
  return Number(value || 0).toFixed(2);
}

function sanitizeFilename(invoiceNumber) {
  return String(invoiceNumber).replace(/[^a-zA-Z0-9-_]/g, "_");
}

function displayOrDash(value) {
  const text = value == null ? "" : String(value).trim();
  return text || "-";
}

function twoDigitWords(num) {
  const ones = [
    "",
    "ONE",
    "TWO",
    "THREE",
    "FOUR",
    "FIVE",
    "SIX",
    "SEVEN",
    "EIGHT",
    "NINE",
    "TEN",
    "ELEVEN",
    "TWELVE",
    "THIRTEEN",
    "FOURTEEN",
    "FIFTEEN",
    "SIXTEEN",
    "SEVENTEEN",
    "EIGHTEEN",
    "NINETEEN",
  ];
  const tens = [
    "",
    "",
    "TWENTY",
    "THIRTY",
    "FORTY",
    "FIFTY",
    "SIXTY",
    "SEVENTY",
    "EIGHTY",
    "NINETY",
  ];

  if (num < 20) return ones[num];
  const remainder = num % 10;
  return `${tens[Math.floor(num / 10)]}${remainder ? ` ${ones[remainder]}` : ""}`;
}

function convertNumberToWords(num) {
  if (!num) return "ZERO";
  if (num < 0) return `MINUS ${convertNumberToWords(Math.abs(num))}`;

  let words = "";

  const crore = Math.floor(num / 10000000);
  if (crore) {
    words += `${convertNumberToWords(crore)} CRORE `;
    num %= 10000000;
  }

  const lakh = Math.floor(num / 100000);
  if (lakh) {
    words += `${convertNumberToWords(lakh)} LAKH `;
    num %= 100000;
  }

  const thousand = Math.floor(num / 1000);
  if (thousand) {
    words += `${convertNumberToWords(thousand)} THOUSAND `;
    num %= 1000;
  }

  const hundred = Math.floor(num / 100);
  if (hundred) {
    words += `${convertNumberToWords(hundred)} HUNDRED `;
    num %= 100;
  }

  if (num) {
    words += twoDigitWords(num);
  }

  return words.trim();
}

function amountInWords(amount) {
  const rupees = Math.floor(Number(amount) || 0);
  const paise = Math.round((Number(amount) - rupees) * 100);
  let words = convertNumberToWords(rupees);
  if (paise) {
    words += ` AND ${convertNumberToWords(paise)} PAISE`;
  }
  return `${words} ONLY.`;
}

function getMedicine(item) {
  return item.medicine && typeof item.medicine === "object"
    ? item.medicine
    : null;
}

function getLineItemHsn(item) {
  const med = getMedicine(item);
  return item.hsn || med?.hsn || "";
}

function formatLineItemQuantity(quantity, free) {
  const qty = Number(quantity) || 0;
  const freeQty = Number(free) || 0;
  if (freeQty > 0) {
    return `${qty}+${freeQty}`;
  }
  return String(qty);
}

const PDF_ITEM_HEADERS = [
  "S. No.",
  "Name of Product",
  "Packing",
  "HSN",
  "MFG",
  "BATCH",
  "EXP.",
  "QTY.",
  "RATE",
  "GST Rate",
  "MRP",
  "Amount",
];

function formatShortInvoiceDate(value) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  const day = String(date.getDate()).padStart(2, "0");
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const year = String(date.getFullYear()).slice(-2);
  return `${day}-${month}-${year}`;
}

function formatExpiryShort(value) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const year = String(date.getFullYear()).slice(-2);
  return `${month}-${year}`;
}

function calculateTaxSummary(invoice) {
  return calculateInvoiceTax(invoice.items || []);
}

function buildPdfTableRows(invoice) {
  return invoice.items.map((item, index) => {
    const med = getMedicine(item);

    return [
      String(index + 1),
      item.medicineName || med?.name || "",
      med?.packagingType || "",
      getLineItemHsn(item),
      med?.manufacturer || "",
      med?.batchNumber || "",
      med?.expiryDate ? formatExpiryShort(med.expiryDate) : "",
      formatLineItemQuantity(item.quantity, item.free),
      formatAmount(item.rate),
      formatGstRate(getLineItemGstRate(item)),
      formatAmount(med?.mrp ?? item.rate),
      formatAmount(getLineTotalWithGst(item)),
    ];
  });
}

function drawPdfLabelValue(doc, label, value, x, y, labelWidth = 24) {
  doc.setFont("helvetica", "bold");
  doc.setFontSize(8);
  doc.text(label, x, y);
  doc.setFont("helvetica", "normal");
  doc.text(String(value || ""), x + labelWidth, y, {
    maxWidth: 120,
  });
}

function getScaledColumnStyles(contentWidth) {
  const pdfColumnWidths = [10, 36, 14, 11, 14, 14, 11, 11, 12, 10, 12, 18];
  const widthScale =
    contentWidth / pdfColumnWidths.reduce((sum, width) => sum + width, 0);

  return pdfColumnWidths.reduce((styles, width, index) => {
    styles[index] = {
      cellWidth: width * widthScale,
      ...(index === 0 || [2, 3, 4, 5, 6, 7, 9].includes(index)
        ? { halign: "center" }
        : {}),
      ...([8, 10, 11].includes(index) ? { halign: "right" } : {}),
    };
    return styles;
  }, {});
}

function buildPaddedTableRows(invoice, tax) {
  const tableRows = buildPdfTableRows(invoice);
  const minRows = Math.max(tableRows.length, 2);
  const paddedRows = [
    ...tableRows,
    ...Array.from({ length: minRows - tableRows.length }, () =>
      Array(PDF_ITEM_HEADERS.length).fill(""),
    ),
  ];

  paddedRows.push([
    "",
    "TOTAL",
    "",
    "",
    "",
    "",
    "",
    "",
    "",
    "",
    "",
    formatAmount(tax.grandTotal),
  ]);

  return paddedRows;
}

function drawCutLine(doc, pageWidth, y, margin) {
  const centerX = pageWidth / 2;
  const gap = 6;

  doc.setDrawColor(110, 110, 110);
  doc.setLineWidth(0.25);
  doc.setLineDashPattern([1.5, 1.5], 0);
  doc.line(margin, y, centerX - gap, y);
  doc.line(centerX + gap, y, pageWidth - margin, y);
  doc.setLineDashPattern([], 0);

  doc.setFont("helvetica", "normal");
  doc.setFontSize(10);
  doc.text("\u2702", centerX, y + 1, { align: "center" });
}

function drawInvoiceCopy(doc, invoice, options) {
  const {
    startY,
    margin,
    contentWidth,
    pageWidth,
    copyLabel,
    maxEndY,
    qrDataUrl,
  } = options;
  const customer = invoice.customer || {};
  const tax = calculateTaxSummary(invoice);
  let y = startY;

  doc.setFont("helvetica", "bold");
  doc.setFontSize(7);
  doc.text(copyLabel, pageWidth - margin, y + 2.5, { align: "right" });
  y += 5;

  const metaWidth = 48;
  const metaX = margin + contentWidth - metaWidth;

  doc.setFont("helvetica", "bold");
  doc.setFontSize(7);
  doc.text(`GSTIN: ${SELLER.gstin}`, margin, y + 3);
  const dlLabel = "D.L NO: - ";
  doc.text(`${dlLabel}${SELLER.dlNumbers[0] || ""}`, margin, y + 7);
  if (SELLER.dlNumbers[1]) {
    doc.text(SELLER.dlNumbers[1], margin + doc.getTextWidth(dlLabel), y + 11);
  }

  doc.setFont("helvetica", "normal");
  doc.setFontSize(7);
  doc.text("Invoice No.", metaX, y + 2);
  doc.setFont("helvetica", "bold");
  doc.text(String(invoice.invoiceNumber || ""), metaX + 18, y + 2);
  doc.setFont("helvetica", "normal");
  doc.text("Date", metaX, y + 6);
  doc.setFont("helvetica", "bold");
  doc.text(formatShortInvoiceDate(invoice.invoiceDate), metaX + 18, y + 6);
  doc.setFont("helvetica", "normal");
  doc.text("Type", metaX, y + 10);
  doc.setFont("helvetica", "bold");
  doc.text(getPaymentTypeLabel(invoice), metaX + 18, y + 10);

  y += SELLER.dlNumbers[1] ? 22 : 18;
  doc.setFont("helvetica", "bold");
  doc.setFontSize(13);
  doc.text(SELLER.name, pageWidth / 2, y, { align: "center" });

  y += 5;
  doc.setFont("helvetica", "normal");
  doc.setFontSize(8);
  doc.text(
    `${SELLER.addressLine} Phone No.: ${SELLER.phoneDisplay}`,
    pageWidth / 2,
    y,
    { align: "center" },
  );

  y += 5;
  const receiverHeaderHeight = 5;
  const rowGap = 4.5;
  const labelWidth = 24;
  const valueX = margin + 26;
  const valueMaxWidth = contentWidth - 30;
  const receiverTop = y;

  doc.setFont("helvetica", "normal");
  doc.setFontSize(7);
  const addressLines = doc.splitTextToSize(
    displayOrDash(customer.address),
    valueMaxWidth,
  );
  const addressBlockHeight = Math.max(addressLines.length * 3.2, 3.2);
  const receiverContentHeight = rowGap + addressBlockHeight + rowGap * 3 + 2;
  const receiverHeight = receiverHeaderHeight + receiverContentHeight;

  doc.rect(margin, receiverTop, contentWidth, receiverHeight);
  doc.setFillColor(220, 220, 220);
  doc.rect(margin, receiverTop, contentWidth, receiverHeaderHeight, "FD");
  doc.setFont("helvetica", "bold");
  doc.setFontSize(7);
  doc.text(
    "DETAILS OF RECEIVER / BILLED TO",
    pageWidth / 2,
    receiverTop + 3.5,
    {
      align: "center",
    },
  );

  let textY = receiverTop + receiverHeaderHeight + 3.5;
  drawPdfLabelValue(
    doc,
    "Name & Address:",
    displayOrDash(customer.name),
    margin + 2,
    textY,
    labelWidth,
  );
  textY += rowGap;
  addressLines.forEach((line, index) => {
    doc.setFont("helvetica", "normal");
    doc.setFontSize(7);
    doc.text(line, valueX, textY + index * 3.2);
  });
  textY += addressBlockHeight;

  drawPdfLabelValue(
    doc,
    "Phone No.:",
    displayOrDash(customer.contact),
    margin + 2,
    textY,
    labelWidth,
  );
  textY += rowGap;
  drawPdfLabelValue(
    doc,
    "D.L. No.:",
    displayOrDash(customer.dlNo),
    margin + 2,
    textY,
    labelWidth,
  );
  textY += rowGap;
  drawPdfLabelValue(
    doc,
    "GSTIN:",
    displayOrDash(customer.gstin),
    margin + 2,
    textY,
    labelWidth,
  );

  y = receiverTop + receiverHeight;

  const paddedRows = buildPaddedTableRows(invoice, tax);
  const scaledColumnStyles = getScaledColumnStyles(contentWidth);

  autoTable(doc, {
    startY: y,
    head: [PDF_ITEM_HEADERS],
    body: paddedRows,
    tableWidth: contentWidth,
    theme: "grid",
    styles: {
      fontSize: 6.8,
      cellPadding: 0.9,
      lineColor: [0, 0, 0],
      lineWidth: 0.15,
      textColor: [0, 0, 0],
      valign: "middle",
    },
    headStyles: {
      fillColor: [235, 235, 235],
      textColor: [0, 0, 0],
      fontStyle: "bold",
      fontSize: 6.5,
      halign: "center",
    },
    columnStyles: scaledColumnStyles,
    margin: { left: margin, right: margin, top: 0, bottom: 0 },
    pageBreak: "avoid",
    rowPageBreak: "avoid",
    didParseCell(data) {
      if (
        data.section === "body" &&
        data.row.index === paddedRows.length - 1 &&
        data.column.index === 1
      ) {
        data.cell.styles.fontStyle = "bold";
        data.cell.styles.halign = "right";
      }
      if (
        data.section === "body" &&
        data.row.index === paddedRows.length - 1 &&
        data.column.index === 11
      ) {
        data.cell.styles.fontStyle = "bold";
      }
    },
  });

  let blockY = doc.lastAutoTable.finalY;
  const qrSize = 14;
  const bankTextHeight = 12;
  const bankSectionHeight = qrDataUrl
    ? Math.max(bankTextHeight, qrSize + 3)
    : bankTextHeight;
  const wordsHeight = 7;
  const bankTopGap = 2;
  const signatureTop = maxEndY - 9;

  if (blockY + wordsHeight <= signatureTop - bankSectionHeight - bankTopGap) {
    doc.rect(margin, blockY, contentWidth, wordsHeight);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(7);
    doc.text("Amount in words:", margin + 2, blockY + 4.5);
    doc.setFont("helvetica", "normal");
    doc.text(amountInWords(tax.grandTotal), margin + 28, blockY + 4.5, {
      maxWidth: contentWidth - 52,
    });
    blockY += wordsHeight;
  }

  if (blockY + bankTopGap + bankSectionHeight <= signatureTop) {
    blockY += bankTopGap;
    doc.setFont("helvetica", "bold");
    doc.setFontSize(7);
    doc.text("Bank Details:", margin + 2, blockY + 3);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(6.8);
    doc.text(SELLER.bankName, margin + 2, blockY + 6.5);
    doc.text(`ACCOUNT : ${SELLER.account}`, margin + 2, blockY + 9.5);
    doc.text(`IFSC : ${SELLER.ifsc}`, margin + 2, blockY + 12.5, {
      maxWidth: contentWidth * 0.42,
    });

    if (qrDataUrl) {
      const qrX = (pageWidth - qrSize) / 2;
      const qrY = blockY + (bankSectionHeight - qrSize - 2) / 2;
      doc.addImage(qrDataUrl, "PNG", qrX, qrY, qrSize, qrSize);
      doc.setFont("helvetica", "bold");
      doc.setFontSize(6);
      doc.text("Scan to Pay", pageWidth / 2, qrY + qrSize + 2, {
        align: "center",
      });
    }

    blockY += bankSectionHeight;
  }

  doc.setFont("helvetica", "bold");
  doc.setFontSize(7);
  doc.text(SELLER.forLabel, pageWidth - margin, signatureTop + 2, {
    align: "right",
  });
  doc.setFont("helvetica", "normal");
  doc.text("Authorised Signatory", pageWidth - margin, signatureTop + 6, {
    align: "right",
  });

  return Math.max(blockY, signatureTop + 8);
}

export async function renderInvoicePdf(invoice) {
  const doc = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });
  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const margin = 6;
  const contentWidth = pageWidth - margin * 2;
  const cutY = pageHeight / 2;
  const copyGap = 2;
  const tax = calculateTaxSummary(invoice);
  let qrDataUrl = null;

  if (isPaymentConfigured() && invoice.status !== "cancelled") {
    try {
      qrDataUrl = await generateUpiQrDataUrl({
        amount: tax.grandTotal,
        note: getInvoicePaymentNote(invoice),
      });
    } catch {
      // Skip QR on PDF if generation fails.
    }
  }

  drawInvoiceCopy(doc, invoice, {
    startY: margin,
    margin,
    contentWidth,
    pageWidth,
    copyLabel: "CUSTOMER COPY",
    maxEndY: cutY - copyGap,
    qrDataUrl,
  });

  drawCutLine(doc, pageWidth, cutY, margin);

  drawInvoiceCopy(doc, invoice, {
    startY: cutY + copyGap,
    margin,
    contentWidth,
    pageWidth,
    copyLabel: "OFFICE COPY",
    maxEndY: pageHeight - margin,
    qrDataUrl,
  });

  return doc;
}

export async function generateInvoicePdfBlob(invoice) {
  const doc = await renderInvoicePdf(invoice);
  return ensurePdfBlob(doc.output("blob"));
}

export async function downloadInvoicePdf(invoice) {
  const blob = await generateInvoicePdfBlob(invoice);
  const filename = `${sanitizeFilename(invoice.invoiceNumber)}.pdf`;
  savePdfBlob(blob, filename);
}

export async function printInvoicePdf(invoice) {
  const blob = await generateInvoicePdfBlob(invoice);

  if (isMobileBrowser()) {
    openPdfBlobInNewTab(blob);
    return { method: "open" };
  }

  const url = URL.createObjectURL(blob);

  return new Promise((resolve, reject) => {
    const iframe = document.createElement("iframe");
    iframe.style.position = "fixed";
    iframe.style.right = "0";
    iframe.style.bottom = "0";
    iframe.style.width = "0";
    iframe.style.height = "0";
    iframe.style.border = "0";
    iframe.src = url;

    const cleanup = () => {
      URL.revokeObjectURL(url);
      iframe.remove();
      window.removeEventListener("focus", handleFocus);
    };

    const handleFocus = () => {
      window.setTimeout(cleanup, 500);
      resolve({ method: "print" });
    };

    iframe.onload = () => {
      try {
        iframe.contentWindow?.focus();
        iframe.contentWindow?.print();
        window.addEventListener("focus", handleFocus);
      } catch (error) {
        cleanup();
        reject(error);
      }
    };

    iframe.onerror = () => {
      cleanup();
      reject(new Error("Could not open the invoice for printing."));
    };

    document.body.appendChild(iframe);
  });
}

function buildInvoiceShareText(invoice) {
  const customerName = invoice.customer?.name || "Customer";
  const total = new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
  }).format(Number(invoice.total) || 0);

  return `Invoice ${invoice.invoiceNumber} for ${customerName} — ${total}`;
}

export async function shareInvoicePdf(invoice) {
  const blob = await generateInvoicePdfBlob(invoice);
  const filename = `${sanitizeFilename(invoice.invoiceNumber)}.pdf`;
  const file = new File([blob], filename, { type: "application/pdf" });
  const text = buildInvoiceShareText(invoice);
  const mobile = isMobileBrowser();

  if (navigator.share) {
    try {
      if (navigator.canShare?.({ files: [file] })) {
        await navigator.share(
          mobile
            ? {
                files: [file],
                title: `Invoice ${invoice.invoiceNumber}`,
              }
            : {
                files: [file],
                title: `Invoice ${invoice.invoiceNumber}`,
                text,
              },
        );
        return { method: "share" };
      }

      await navigator.share({
        title: `Invoice ${invoice.invoiceNumber}`,
        text,
      });
      return { method: "share-text" };
    } catch (error) {
      if (error?.name === "AbortError") {
        return { method: "cancelled" };
      }
    }
  }

  if (mobile) {
    openPdfBlobInNewTab(blob);
    return { method: "open" };
  }

  savePdfBlob(blob, filename);
  return { method: "download" };
}
