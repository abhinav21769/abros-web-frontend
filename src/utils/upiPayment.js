import QRCode from "qrcode";

// The payee is always the signed-in company: a shared env-configured UPI id
// would collect one tenant's money into another's account.
export function buildUpiPaymentUri({ upiId, payeeName = "", amount, note } = {}) {
  if (!upiId?.trim()) {
    throw new Error("No UPI ID on your company profile. Add one in Settings.");
  }

  const params = new URLSearchParams();
  params.set("pa", upiId.trim());
  params.set("pn", String(payeeName || "").trim());
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
