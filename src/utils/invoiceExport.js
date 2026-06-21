import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import { isPaymentConfigured } from "../config/payment";
import { generateUpiQrDataUrl, getInvoicePaymentNote } from "./upiPayment";
import {
  calculateInvoiceTax,
  formatGstRate,
  getLineItemGstRate,
  getLineTotalWithGst,
} from "./invoiceTax";

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

const TERMS = [
  "1. All disputes Subject to Ambala Jurisdiction only.",
  "2. Goods once sold will not taken back or Exchanged.",
  "3. Interest @ 18% p.a. will be charged, if bill is not paid within 15 days.",
  "4. E & O. E.",
];

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

export async function renderInvoicePdf(invoice) {
  const doc = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });
  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const margin = 8;
  const contentWidth = pageWidth - margin * 2;
  const customer = invoice.customer || {};
  const tax = calculateTaxSummary(invoice);
  let y = margin;

  const metaWidth = 52;
  const metaX = margin + contentWidth - metaWidth;

  doc.setFont("helvetica", "bold");
  doc.setFontSize(8);
  doc.text(`GSTIN: ${SELLER.gstin}`, margin, y + 4);
  const dlLabel = "D.L NO: - ";
  doc.text(`${dlLabel}${SELLER.dlNumbers[0] || ""}`, margin, y + 9);
  if (SELLER.dlNumbers[1]) {
    doc.text(SELLER.dlNumbers[1], margin + doc.getTextWidth(dlLabel), y + 14);
  }

  doc.setFont("helvetica", "normal");
  doc.setFontSize(7.5);
  doc.text("Invoice No.", metaX, y + 3);
  doc.setFont("helvetica", "bold");
  doc.text(String(invoice.invoiceNumber || ""), metaX + 20, y + 3);
  doc.setFont("helvetica", "normal");
  doc.text("Invoice Date", metaX, y + 8);
  doc.setFont("helvetica", "bold");
  doc.text(formatShortInvoiceDate(invoice.invoiceDate), metaX + 20, y + 8);
  doc.setFont("helvetica", "normal");
  doc.text("Invoice Type", metaX, y + 13);
  doc.setFont("helvetica", "bold");
  doc.text(getPaymentTypeLabel(invoice), metaX + 20, y + 13);

  y += SELLER.dlNumbers[1] ? 29 : 24;
  doc.setFont("helvetica", "bold");
  doc.setFontSize(16);
  doc.text(SELLER.name, pageWidth / 2, y, { align: "center" });

  y += 6;
  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  doc.text(
    `${SELLER.addressLine} Phone No.: ${SELLER.phoneDisplay}`,
    pageWidth / 2,
    y,
    { align: "center" },
  );

  y += 6;
  const receiverHeight = 34;
  doc.rect(margin, y, contentWidth, receiverHeight);
  doc.setFillColor(220, 220, 220);
  doc.rect(margin, y, contentWidth, 6, "FD");
  doc.setFont("helvetica", "bold");
  doc.setFontSize(8);
  doc.text("DETAILS OF RECEIVER / BILLED TO", pageWidth / 2, y + 4.2, {
    align: "center",
  });

  const receiverTextY = y + 11;
  drawPdfLabelValue(
    doc,
    "Name & Address:",
    displayOrDash(customer.name),
    margin + 2,
    receiverTextY,
    26,
  );
  doc.setFont("helvetica", "normal");
  doc.setFontSize(8);
  doc.text(displayOrDash(customer.address), margin + 28, receiverTextY + 4, {
    maxWidth: contentWidth - 32,
  });
  drawPdfLabelValue(
    doc,
    "Phone No.:",
    displayOrDash(customer.contact),
    margin + 2,
    receiverTextY + 10,
    26,
  );
  drawPdfLabelValue(
    doc,
    "D.L. No.:",
    displayOrDash(customer.dlNo),
    margin + 2,
    receiverTextY + 16,
    26,
  );
  drawPdfLabelValue(
    doc,
    "GSTIN:",
    displayOrDash(customer.gstin),
    margin + 2,
    receiverTextY + 22,
    26,
  );

  y += receiverHeight + 2;

  const tableRows = buildPdfTableRows(invoice);
  const minRows = Math.max(8, tableRows.length);
  const paddedRows = [
    ...tableRows,
    ...Array.from({ length: minRows - tableRows.length }, () =>
      Array(PDF_ITEM_HEADERS.length).fill(""),
    ),
  ];

  const totalAmount = formatAmount(tax.grandTotal);
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
    totalAmount,
  ]);

  const pdfColumnWidths = [10, 36, 14, 11, 14, 14, 11, 11, 12, 10, 12, 18];
  const widthScale =
    contentWidth / pdfColumnWidths.reduce((sum, w) => sum + w, 0);
  const scaledColumnStyles = pdfColumnWidths.reduce((styles, width, index) => {
    styles[index] = {
      cellWidth: width * widthScale,
      ...(index === 0 || [2, 3, 4, 5, 6, 7, 9].includes(index)
        ? { halign: "center" }
        : {}),
      ...([8, 10, 11].includes(index) ? { halign: "right" } : {}),
    };
    return styles;
  }, {});

  autoTable(doc, {
    startY: y,
    head: [PDF_ITEM_HEADERS],
    body: paddedRows,
    tableWidth: contentWidth,
    theme: "grid",
    styles: {
      fontSize: 7.5,
      cellPadding: 1.2,
      lineColor: [0, 0, 0],
      lineWidth: 0.2,
      textColor: [0, 0, 0],
      valign: "middle",
    },
    headStyles: {
      fillColor: [235, 235, 235],
      textColor: [0, 0, 0],
      fontStyle: "bold",
      halign: "center",
    },
    columnStyles: scaledColumnStyles,
    margin: { left: margin, right: margin, bottom: 62 },
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

  const footerHeight = 52;
  const wordsHeight = 8;
  const footerY = pageHeight - margin - footerHeight;
  let wordsY = doc.lastAutoTable.finalY + 3;

  if (wordsY + wordsHeight > footerY - 2) {
    doc.addPage();
    wordsY = margin;
  }

  doc.rect(margin, wordsY, contentWidth, wordsHeight);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(8);
  doc.text("Amount in words:", margin + 2, wordsY + 5);
  doc.setFont("helvetica", "normal");
  doc.text(amountInWords(tax.grandTotal), margin + 30, wordsY + 5, {
    maxWidth: contentWidth - 32,
  });

  const footerTop = footerY;
  const leftFooterWidth = 58;
  const rightBoxWidth = 48;
  const centerWidth = contentWidth - leftFooterWidth - rightBoxWidth;

  doc.rect(margin, footerTop, leftFooterWidth, footerHeight);
  doc.rect(margin + leftFooterWidth, footerTop, centerWidth, footerHeight);
  doc.rect(
    margin + leftFooterWidth + centerWidth,
    footerTop,
    rightBoxWidth,
    footerHeight,
  );

  doc.setFont("helvetica", "bold");
  doc.setFontSize(8);
  doc.text("Bank Details:", margin + 2, footerTop + 5);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(7.5);
  doc.text(SELLER.bankName, margin + 2, footerTop + 9.5);
  doc.text(`ACCOUNT : ${SELLER.account}`, margin + 2, footerTop + 14);
  doc.text(`IFSC : ${SELLER.ifsc}`, margin + 2, footerTop + 18.5, {
    maxWidth: leftFooterWidth - 4,
  });

  const termsX = margin + leftFooterWidth + 2;
  doc.setFont("helvetica", "bold");
  doc.setFontSize(8);
  doc.text("Terms & Conditions", termsX, footerTop + 5);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(6.8);
  TERMS.forEach((term, index) => {
    doc.text(term, termsX, footerTop + 9 + index * 3.6, {
      maxWidth: centerWidth - 4,
    });
  });

  const rightBoxX = margin + leftFooterWidth + centerWidth;
  const signatoryX = rightBoxX + rightBoxWidth / 2;
  doc.setFont("helvetica", "normal");
  doc.setFontSize(7.5);
  doc.text(
    "Certified that the particulars given above are true & correct.",
    signatoryX,
    footerTop + 18,
    { align: "center", maxWidth: rightBoxWidth - 4 },
  );
  doc.setFont("helvetica", "bold");
  doc.text(SELLER.forLabel, signatoryX, footerTop + 30, { align: "center" });
  doc.setFont("helvetica", "normal");
  doc.text("Authorised Signatory", signatoryX, footerTop + footerHeight - 6, {
    align: "center",
  });

  if (isPaymentConfigured() && invoice.status !== "cancelled") {
    try {
      const qrDataUrl = await generateUpiQrDataUrl({
        amount: tax.grandTotal,
        note: getInvoicePaymentNote(invoice),
      });
      const qrSize = 22;
      const qrX = margin + (leftFooterWidth - qrSize) / 2;
      const qrY = footerTop + 22;

      doc.addImage(qrDataUrl, "PNG", qrX, qrY, qrSize, qrSize);
      doc.setFont("helvetica", "bold");
      doc.setFontSize(7);
      doc.text("Scan to Pay", margin + leftFooterWidth / 2, qrY + qrSize + 4, {
        align: "center",
      });
    } catch {
      // Skip QR on PDF if generation fails.
    }
  }

  return doc;
}

export async function generateInvoicePdfBlob(invoice) {
  const doc = await renderInvoicePdf(invoice);
  return doc.output("blob");
}

export async function downloadInvoicePdf(invoice) {
  const doc = await renderInvoicePdf(invoice);
  doc.save(`${sanitizeFilename(invoice.invoiceNumber)}.pdf`);
}

export async function printInvoicePdf(invoice) {
  const blob = await generateInvoicePdfBlob(invoice);
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
      resolve();
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

  if (navigator.share) {
    const shareData = {
      title: `Invoice ${invoice.invoiceNumber}`,
      text,
    };

    if (navigator.canShare?.({ files: [file] })) {
      shareData.files = [file];
    }

    try {
      await navigator.share(shareData);
      return { method: "share" };
    } catch (error) {
      if (error?.name === "AbortError") {
        return { method: "cancelled" };
      }
      throw error;
    }
  }

  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  link.click();
  URL.revokeObjectURL(url);
  return { method: "download" };
}
