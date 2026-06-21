import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import * as XLSX from "xlsx";
import { formatCalendarDate, toExcelSerialDate } from "./dateUtils";

const SELLER = {
  name: "ABROS HEALTHCARE",
  rightTitle: "MEDICAL STORE",
  address: "Shop-2, Shivpuri Colony, Sultanpur, Ambala City, Haryana",
  phone: "PHONE NO- ",
  pincode: "134003",
  gstin: "",
  dlNo: "DL NO.",
  dlValidUpto: "UPTO DT",
  licNo: "LIC NO",
  creditLabel: "Credit",
  forLabel: "FOR  ABROS HEALTHCARE",
};

const GST_SLABS = ["5.00", "12.00", "18.00", "28.00"];

const TERMS = [
  "Goods once sold will not be taken back or exchanged.",
  "Bills not paid due date will attract 24% interest.",
];

const ITEM_HEADERS = [
  "COMP",
  "Qty.",
  "FREE",
  "Pack",
  "PRODUCT",
  "BATCH",
  "EXP",
  "HSN",
  "MRP",
  "RATE",
  "DIS",
  "CGST",
  "IGST",
  "AMOUNT",
];

function formatAmount(value) {
  return Number(value || 0).toFixed(2);
}

function sanitizeFilename(invoiceNumber) {
  return String(invoiceNumber).replace(/[^a-zA-Z0-9-_]/g, "_");
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

function buildLineItemRow(item) {
  const med = getMedicine(item);
  const amount = Number(item.amount ?? item.quantity * item.rate);

  return [
    0,
    Number(item.quantity) || 0,
    Number(item.free) || 0,
    med?.packagingType || "",
    item.medicineName || med?.name || "",
    med?.batchNumber || "",
    med?.expiryDate ? toExcelSerialDate(med.expiryDate) : "",
    3004,
    Number(med?.mrp ?? item.rate) || 0,
    Number(item.rate) || 0,
    0,
    0,
    0,
    amount,
  ];
}

function buildBillHeaderRows(invoice) {
  const customer = invoice.customer || {};

  return [
    [
      SELLER.name,
      "",
      "",
      "",
      "",
      SELLER.creditLabel,
      "",
      "MEDICAL",
      "",
      "",
      "",
      "STORE",
      "",
      "",
    ],
    ["", "", "", "", "", "", "", customer.name || "", "", "", "", "", ""],
    [
      SELLER.address,
      "",
      "",
      "",
      "",
      "",
      "",
      "Phone No:",
      customer.contact || "",
      "",
      "",
      "",
      "",
    ],
    [
      SELLER.pincode,
      "",
      "",
      "",
      "",
      "",
      "",
      "GSTIN",
      "",
      "",
      "",
      customer.gstin || "",
      "",
    ],
    [
      SELLER.phone,
      "",
      "",
      "",
      "",
      "",
      "",
      SELLER.dlNo,
      "",
      "",
      "",
      customer.dlNo || SELLER.dlValidUpto,
      "",
    ],
    [
      SELLER.licNo,
      "",
      "",
      "",
      "",
      "GSTIN INVOICE",
      "",
      "Invoice No.   :                ",
      "",
      invoice.invoiceNumber,
      "Date              :",
      toExcelSerialDate(invoice.invoiceDate),
      "",
      "",
    ],
    [
      `GSTIN NO: ${SELLER.gstin}`,
      "",
      "",
      "",
      "",
      "",
      "",
      "",
      "",
      "",
      "",
      "",
      "",
      "",
    ],
    ITEM_HEADERS,
  ];
}

function buildBillFooterRows(invoice) {
  const total = Number(invoice.total) || 0;

  return [
    [
      "CLASS",
      "TOTAL",
      "",
      "SCH",
      "DISC",
      "SGST",
      "CGST",
      "TOTAL",
      "",
      "",
      "",
      "",
      "",
      "",
    ],
    ...GST_SLABS.map((slab) => [
      `GST ${slab}`,
      0,
      "",
      0,
      0,
      0,
      0,
      0,
      "",
      "",
      "",
      "",
      "",
      "",
    ]),
    ["TOTAL", total, "", 0, 0, 0, 0, total, "", "", "", "", "", ""],
    [amountInWords(total), "", "", "", "", "", "", "", "", "", "", "", "", ""],
    [
      "Terms & Conditions",
      "",
      "",
      "",
      "",
      "",
      "Reciver",
      "",
      SELLER.forLabel,
      "",
      "",
      "",
      "",
      "",
    ],
    ...TERMS.map((term) => [
      term,
      "",
      "",
      "",
      "",
      "",
      "",
      "",
      "",
      "",
      "",
      "",
      "",
      "",
    ]),
  ];
}

function buildBillSheetData(invoice) {
  const headerRows = buildBillHeaderRows(invoice);
  const itemRows = invoice.items.map((item) => buildLineItemRow(item));
  const minItemRows = 27;
  const paddedItems = [
    ...itemRows,
    ...Array.from({ length: Math.max(0, minItemRows - itemRows.length) }, () =>
      Array(ITEM_HEADERS.length).fill(""),
    ),
  ];

  return [...headerRows, ...paddedItems, [""], ...buildBillFooterRows(invoice)];
}

function applyBillSheetLayout(worksheet) {
  worksheet["!cols"] = [
    { wch: 6 },
    { wch: 6 },
    { wch: 6 },
    { wch: 10 },
    { wch: 28 },
    { wch: 10 },
    { wch: 10 },
    { wch: 8 },
    { wch: 8 },
    { wch: 8 },
    { wch: 6 },
    { wch: 8 },
    { wch: 8 },
    { wch: 10 },
  ];

  const footerStart = 8 + 27 + 1;
  worksheet["!merges"] = [
    { s: { r: 0, c: 7 }, e: { r: 0, c: 10 } },
    { s: { r: 2, c: 8 }, e: { r: 2, c: 12 } },
    { s: { r: 5, c: 5 }, e: { r: 6, c: 6 } },
    { s: { r: 35, c: 0 }, e: { r: 35, c: 13 } },
    { s: { r: footerStart + 6, c: 0 }, e: { r: footerStart + 6, c: 13 } },
    { s: { r: footerStart + 1, c: 1 }, e: { r: footerStart + 1, c: 2 } },
    { s: { r: footerStart + 2, c: 1 }, e: { r: footerStart + 2, c: 2 } },
    { s: { r: footerStart + 3, c: 1 }, e: { r: footerStart + 3, c: 2 } },
    { s: { r: footerStart + 4, c: 1 }, e: { r: footerStart + 4, c: 2 } },
    { s: { r: footerStart + 5, c: 1 }, e: { r: footerStart + 5, c: 2 } },
    { s: { r: footerStart, c: 1 }, e: { r: footerStart, c: 2 } },
  ];
}

export function downloadInvoiceExcel(invoice) {
  const sheetData = buildBillSheetData(invoice);
  const worksheet = XLSX.utils.aoa_to_sheet(sheetData);
  applyBillSheetLayout(worksheet);

  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, "Sheet1");
  XLSX.writeFile(workbook, `${sanitizeFilename(invoice.invoiceNumber)}.xlsx`);
}

export function downloadInvoicePdf(invoice) {
  const doc = new jsPDF({ orientation: "landscape", unit: "mm", format: "a4" });
  const pageWidth = doc.internal.pageSize.getWidth();
  const margin = 8;
  const customer = invoice.customer || {};
  let y = 10;

  doc.setFont("helvetica", "bold");
  doc.setFontSize(14);
  doc.text(SELLER.name, margin, y);
  doc.text("MEDICAL STORE", pageWidth - margin, y, { align: "right" });

  y += 6;
  doc.setFontSize(9);
  doc.setFont("helvetica", "normal");
  doc.text(SELLER.address, margin, y);
  doc.text(customer.name || "", pageWidth - margin, y, { align: "right" });

  y += 5;
  doc.text(`${SELLER.phone}${customer.contact || ""}`, margin, y);
  doc.text(customer.address || "", pageWidth - margin, y, { align: "right" });

  y += 5;
  doc.text(`GSTIN NO: ${SELLER.gstin}`, margin, y);
  doc.text(`GSTIN: ${customer.gstin || ""}`, pageWidth / 2, y);
  doc.text(`DL NO: ${customer.dlNo || ""}`, pageWidth - margin, y, {
    align: "right",
  });

  y += 6;
  doc.setFont("helvetica", "bold");
  doc.text(`Invoice No: ${invoice.invoiceNumber}`, margin, y);
  doc.text(`Date: ${formatCalendarDate(invoice.invoiceDate)}`, pageWidth / 2, y);
  doc.text(SELLER.creditLabel, pageWidth - margin, y, { align: "right" });

  y += 4;

  const tableBody = invoice.items.map((item) => {
    const row = buildLineItemRow(item);
    return row.map((cell, index) => {
      if (index === 6 && cell)
        return formatCalendarDate(getMedicine(item)?.expiryDate);
      if ([8, 9, 11, 12, 13].includes(index) && cell !== "")
        return formatAmount(cell);
      return cell === "" ? "" : String(cell);
    });
  });

  autoTable(doc, {
    startY: y,
    head: [ITEM_HEADERS],
    body: tableBody,
    theme: "grid",
    styles: { fontSize: 7, cellPadding: 1.5 },
    headStyles: {
      fillColor: [240, 240, 240],
      textColor: 20,
      fontStyle: "bold",
    },
    columnStyles: {
      4: { cellWidth: 42 },
      8: { halign: "right" },
      9: { halign: "right" },
      13: { halign: "right" },
    },
    margin: { left: margin, right: margin },
  });

  y = doc.lastAutoTable.finalY + 6;
  doc.setFont("helvetica", "bold");
  doc.setFontSize(9);
  doc.text(`TOTAL: Rs. ${formatAmount(invoice.total)}`, pageWidth - margin, y, {
    align: "right",
  });

  y += 6;
  doc.setFont("helvetica", "normal");
  doc.text(amountInWords(invoice.total), margin, y);

  y += 8;
  doc.setFont("helvetica", "bold");
  doc.text("Terms & Conditions", margin, y);
  doc.text("Receiver", pageWidth - 50, y);
  doc.text(SELLER.forLabel, pageWidth - margin, y, { align: "right" });

  doc.setFont("helvetica", "normal");
  TERMS.forEach((term, index) => {
    doc.text(term, margin, y + 5 + index * 4);
  });

  doc.save(`${sanitizeFilename(invoice.invoiceNumber)}.pdf`);
}
