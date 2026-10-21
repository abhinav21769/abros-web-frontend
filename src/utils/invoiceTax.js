export const DEFAULT_GST_RATE = 5;

// GST slabs in force from 22 Sep 2025 (12% and 28% were folded into 5/18/40).
export const GST_RATE_OPTIONS = [0, 5, 18, 40];

// Only empty or invalid input falls back to the default; 0 stays 0.
// Must stay identical to the backend's normalizeGstRate.
export function normalizeGstRate(value) {
  if (value == null || (typeof value === "string" && value.trim() === "")) {
    return DEFAULT_GST_RATE;
  }
  const rate = Number(value);
  if (!Number.isFinite(rate) || rate < 0) return DEFAULT_GST_RATE;
  return rate;
}

// The current slabs plus any stored rates that are no longer a slab (e.g. 12
// or 28 on an old medicine or invoice line), so editing an old record keeps
// its rate selectable instead of silently showing a different one.
export function getGstRateOptions(...storedRates) {
  const extras = storedRates
    .filter((value) => value != null && String(value).trim() !== "")
    .map(Number)
    .filter((rate) => Number.isFinite(rate) && rate >= 0);
  return [...new Set([...GST_RATE_OPTIONS, ...extras])].sort((a, b) => a - b);
}

export function isLegacyGstRate(rate) {
  return !GST_RATE_OPTIONS.includes(Number(rate));
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
