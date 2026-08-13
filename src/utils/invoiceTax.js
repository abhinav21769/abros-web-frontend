export const GST_RATE_OPTIONS = [5, 12, 18, 28];

export function normalizeGstRate(value) {
  const rate = Number(value);
  if (!Number.isFinite(rate) || rate < 0) return 5;
  return rate;
}

export function normalizeDiscount(value) {
  const discount = Number(value);
  if (!Number.isFinite(discount) || discount < 0) return 0;
  return Math.min(discount, 100);
}

export function calculateLineAmount(quantity, rate, discount = 0) {
  const gross = Number(quantity || 0) * Number(rate || 0);
  const discountAmount = gross * (normalizeDiscount(discount) / 100);
  return Math.round((gross - discountAmount) * 100) / 100;
}

export function calculateLineNetRate(quantity, free, rate, discount = 0, enabled = true) {
  if (!enabled) return 0;
  const qty = Number(quantity) || 0;
  const freeQty = Number(free) || 0;
  const totalUnits = qty + freeQty;
  if (totalUnits <= 0) return 0;
  const taxableAmount = calculateLineAmount(qty, rate, discount);
  return Math.round((taxableAmount / totalUnits) * 100) / 100;
}

export function getLineNetRate(item, enabled = true) {
  if (!enabled) return 0;
  const quantity = Number(item?.quantity) || 0;
  const free = Number(item?.free) || 0;
  const totalUnits = quantity + free;
  if (totalUnits <= 0) return 0;
  const taxable = getLineTaxableAmount(item);
  return Math.round((taxable / totalUnits) * 100) / 100;
}

export function getLineTaxableAmount(item) {
  const quantity = Number(item?.quantity) || 0;
  const rate = Number(item?.rate) || 0;
  if (item?.amount != null) return Number(item.amount);
  return calculateLineAmount(quantity, rate, item?.discount);
}

export function getLineTotalWithGst(item) {
  const taxable = getLineTaxableAmount(item);
  const gstRate = getLineItemGstRate(item);
  const halfRate = gstRate / 200;
  const cgst = Math.round(taxable * halfRate * 100) / 100;
  const sgst = Math.round(taxable * halfRate * 100) / 100;
  return Math.round((taxable + cgst + sgst) * 100) / 100;
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
    const discount = normalizeDiscount(item.discount);
    const gstRate = getLineItemGstRate(item);
    const amount =
      item.amount != null
        ? Number(item.amount)
        : calculateLineAmount(quantity, rate, discount);
    const halfRate = gstRate / 200;
    const cgst = Math.round(amount * halfRate * 100) / 100;
    const sgst = Math.round(amount * halfRate * 100) / 100;

    return { amount, gstRate, cgst, sgst };
  });

  const subtotal = lineItems.reduce((sum, item) => sum + item.amount, 0);
  const cgst =
    Math.round(lineItems.reduce((sum, item) => sum + item.cgst, 0) * 100) / 100;
  const sgst =
    Math.round(lineItems.reduce((sum, item) => sum + item.sgst, 0) * 100) / 100;
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
