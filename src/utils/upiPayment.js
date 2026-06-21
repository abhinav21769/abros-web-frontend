import QRCode from "qrcode";
import { PAYMENT_CONFIG } from "../config/payment";

export function buildUpiPaymentUri({
  upiId = PAYMENT_CONFIG.upiId,
  payeeName = PAYMENT_CONFIG.payeeName,
  amount,
  note,
} = {}) {
  if (!upiId?.trim()) {
    throw new Error("UPI ID is not configured.");
  }

  const params = new URLSearchParams();
  params.set("pa", upiId.trim());
  params.set("pn", payeeName.trim());
  params.set("cu", "INR");

  if (amount != null && Number(amount) > 0) {
    params.set("am", Number(amount).toFixed(2));
  }

  if (note) {
    params.set("tn", String(note).slice(0, 80));
  }

  return `upi://pay?${params.toString()}`;
}

export async function generateUpiQrDataUrl(options = {}) {
  const uri = buildUpiPaymentUri(options);
  return QRCode.toDataURL(uri, {
    width: 240,
    margin: 1,
    errorCorrectionLevel: "M",
  });
}

export function getInvoicePaymentNote(invoice) {
  return `Invoice ${invoice.invoiceNumber}`;
}
