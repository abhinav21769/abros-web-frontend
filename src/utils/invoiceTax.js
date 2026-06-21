export const GST_RATE_OPTIONS = [5, 12, 18, 28];

export function normalizeGstRate(value) {
  const rate = Number(value);
  if (!Number.isFinite(rate) || rate < 0) return 5;
  return rate;
}

export function calculateLineAmount(quantity, rate) {
  return Math.round(Number(quantity || 0) * Number(rate || 0) * 100) / 100;
}

export function getLineItemGstRate(item) {
  const med =
    item?.medicine && typeof item.medicine === "object" ? item.medicine : null;
  return normalizeGstRate(item?.gstRate ?? med?.gstRate);
}

export function formatGstRate(value) {
  return `${normalizeGstRate(value)}%`;
}

export function calculateInvoiceTax(items = []) {
  const lineItems = items.map((item) => {
    const quantity = Number(item.quantity) || 0;
    const rate = Number(item.rate) || 0;
    const gstRate = getLineItemGstRate(item);
    const amount =
      item.amount != null ? Number(item.amount) : calculateLineAmount(quantity, rate);
    const halfRate = gstRate / 200;
    const cgst = Math.round(amount * halfRate * 100) / 100;
    const sgst = Math.round(amount * halfRate * 100) / 100;

    return { amount, gstRate, cgst, sgst };
  });

  const subtotal = lineItems.reduce((sum, item) => sum + item.amount, 0);
  const cgst = Math.round(lineItems.reduce((sum, item) => sum + item.cgst, 0) * 100) / 100;
  const sgst = Math.round(lineItems.reduce((sum, item) => sum + item.sgst, 0) * 100) / 100;
  const exactTotal = subtotal + cgst + sgst;
  const grandTotal = Math.round(exactTotal);
  const roundOff = Math.round((grandTotal - exactTotal) * 100) / 100;

  return {
    subtotal: Math.round(subtotal * 100) / 100,
    cgst,
    sgst,
    igst: 0,
    grandTotal,
    roundOff,
  };
}
