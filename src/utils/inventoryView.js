// Pure helpers behind the Inventory list: expiry and stock status and batch
// price ranges.

import { daysUntil } from "./dashboardMetrics";

export const DEFAULT_LOW_STOCK_THRESHOLD = 200;
export const EXPIRING_SOON_DAYS = 30;

// Status of a single expiry date. `days` is whole IST calendar days from today.
export function expiryStatus(expiryDate, now = new Date()) {
  const days = daysUntil(expiryDate, now);
  if (days == null) return { days: null, tone: "neutral", label: "No expiry" };
  if (days < 0) return { days, tone: "danger", label: "Expired" };
  if (days === 0) return { days, tone: "danger", label: "Expires today" };
  if (days <= EXPIRING_SOON_DAYS) return { days, tone: "warning", label: `${days}d left` };
  return { days, tone: "success", label: "In date" };
}

// "out" at zero, "low" below the reorder level, otherwise "ok".
export function stockLevel(quantity, threshold = DEFAULT_LOW_STOCK_THRESHOLD) {
  const qty = Number(quantity) || 0;
  if (qty <= 0) return "out";
  return qty < threshold ? "low" : "ok";
}

// null when every batch agrees (nothing to range over); the caller then shows
// the medicine's single mirrored value instead.
export function batchRange(batches, field) {
  if (!batches || batches.length < 2) return null;
  const values = batches.map((batch) => Number(batch[field]) || 0);
  const min = Math.min(...values);
  const max = Math.max(...values);
  return min === max ? null : { min, max };
}

// The single status that best describes a medicine: its nearest-expiring batch
// that still holds stock, falling back to the medicine's own expiry date.
export function medicineExpiry(medicine, now = new Date()) {
  const stocked = (medicine.batches || []).filter((batch) => Number(batch.quantity) > 0);
  const dates = (stocked.length > 0 ? stocked : medicine.batches || [])
    .map((batch) => batch.expiryDate)
    .filter(Boolean);

  if (dates.length === 0) return expiryStatus(medicine.expiryDate, now);

  const nearest = dates.reduce((a, b) => (new Date(a) <= new Date(b) ? a : b));
  return { ...expiryStatus(nearest, now), date: nearest };
}

// Facts for the batch panel under a medicine: how many batches, how much stock
// they hold, which one a sale draws from first, and the nearest expiry. Sales
// without a chosen batch use FEFO (first expiry first out) over batches that
// hold stock, so `nextIndex` is the earliest-expiring one with quantity.
export function batchOverview(batches, now = new Date()) {
  const list = batches || [];
  const totalUnits = list.reduce((sum, batch) => sum + (Number(batch.quantity) || 0), 0);

  let nextIndex = -1;
  list.forEach((batch, index) => {
    if (!(Number(batch.quantity) > 0) || !batch.expiryDate) return;
    if (
      nextIndex === -1 ||
      new Date(batch.expiryDate) < new Date(list[nextIndex].expiryDate)
    ) {
      nextIndex = index;
    }
  });

  const nearestDate = nextIndex >= 0 ? list[nextIndex].expiryDate : null;

  return {
    count: list.length,
    totalUnits,
    emptyCount: list.filter((batch) => !(Number(batch.quantity) > 0)).length,
    nextIndex,
    nearestDate,
    nearestStatus: nearestDate ? expiryStatus(nearestDate, now) : null,
  };
}

// A batch's share of the medicine's stock, 0-100.
export function stockShare(quantity, total) {
  const whole = Number(total) || 0;
  if (whole <= 0) return 0;
  return Math.min(100, Math.round(((Number(quantity) || 0) / whole) * 100));
}
