// Pure helpers behind the Dashboard: expiry countdowns, the "needs attention"
// alerts and the collection / inventory-health breakdowns.

import { getCalendarParts } from "./dateUtils";

const DAY_MS = 24 * 60 * 60 * 1000;

function istDayNumber(value) {
  const parts = getCalendarParts(value);
  if (!parts) return null;
  return Date.UTC(Number(parts.year), Number(parts.month) - 1, Number(parts.day)) / DAY_MS;
}

// Whole IST calendar days from `now` until `date`: positive = in the future, 0 = today, negative = past.
export function daysUntil(date, now = new Date()) {
  const target = istDayNumber(date);
  const today = istDayNumber(now);
  if (target == null || today == null) return null;
  return target - today;
}

export function describeExpiry(days) {
  if (days == null) return "—";
  if (days === 0) return "Expires today";
  if (days === 1) return "Expires tomorrow";
  if (days > 1) return `In ${days} days`;
  if (days === -1) return "1 day overdue";
  return `${Math.abs(days)} days overdue`;
}

// Colours an expiry chip: overdue or within a month is urgent, otherwise a warning.
export function expiryTone(days) {
  if (days == null) return "neutral";
  return days <= 30 ? "danger" : "warning";
}

// "03 Nov" for the current IST year, "03 Nov 2025" otherwise: keeps recent-activity rows compact.
export function formatRecentDate(value, now = new Date()) {
  const parts = getCalendarParts(value);
  if (!parts) return "—";
  const date = new Date(Number(parts.year), Number(parts.month) - 1, Number(parts.day));
  const sameYear = parts.year === getCalendarParts(now).year;
  return date.toLocaleDateString("en-IN", {
    day: "2-digit",
    month: "short",
    ...(sameYear ? {} : { year: "numeric" }),
  });
}

export function percent(part, whole) {
  const denominator = Number(whole) || 0;
  if (denominator <= 0) return 0;
  return Math.min(100, Math.round(((Number(part) || 0) / denominator) * 100));
}

// Alerts worth acting on today; clear ones are left out so the strip only shows real work.
export function buildAlerts({ inventory, sales }) {
  const alerts = [];

  if (inventory.expiredStock > 0) {
    alerts.push({
      id: "expired",
      tone: "danger",
      count: inventory.expiredStock,
      title: "Expired batches",
      detail: "Still in stock, past their expiry date",
      to: "/inventory",
      cta: "Resolve",
    });
  }

  if (inventory.expiringStock > 0) {
    alerts.push({
      id: "expiring",
      tone: "warning",
      count: inventory.expiringStock,
      title: "Expiring soon",
      detail: `Batches expiring within ${inventory.expiringWithinDays} days`,
      to: "/inventory",
      cta: "Review",
    });
  }

  if (inventory.lowStockCount > 0) {
    alerts.push({
      id: "low",
      tone: "info",
      count: inventory.lowStockCount,
      title: "Low stock",
      detail: `Medicines below ${inventory.lowStockThreshold ?? 200} units`,
      to: "/inventory",
      cta: "Restock",
    });
  }

  if (sales.pendingInvoices > 0) {
    alerts.push({
      id: "pending",
      tone: "warning",
      count: sales.pendingInvoices,
      title: "Unpaid sales",
      detail: "Invoices waiting for payment",
      to: "/invoices",
      cta: "Collect",
    });
  }

  return alerts;
}

// Paid vs pending share of everything billed (cancelled invoices carry no amount here).
export function collectionBreakdown(sales) {
  const paid = Number(sales.totalRevenue) || 0;
  const pending = Number(sales.pendingAmount) || 0;
  const billed = paid + pending;

  return {
    paid,
    pending,
    billed,
    paidPercent: percent(paid, billed),
    pendingPercent: billed > 0 ? 100 - percent(paid, billed) : 0,
  };
}

export function inventoryHealth(inventory) {
  const products = Number(inventory.totalStock) || 0;

  return [
    {
      id: "active",
      label: "In stock and in date",
      value: inventory.activeStock,
      of: products,
      tone: "success",
    },
    {
      id: "low",
      label: "Below reorder level",
      value: inventory.lowStockCount,
      of: products,
      tone: "info",
    },
  ].map((row) => ({ ...row, percent: percent(row.value, row.of) }));
}

export function greeting(now = new Date()) {
  const hour = Number(
    new Intl.DateTimeFormat("en-GB", {
      hour: "numeric",
      hour12: false,
      timeZone: "Asia/Kolkata",
    }).format(now),
  );
  if (hour < 12) return "Good morning";
  if (hour < 17) return "Good afternoon";
  return "Good evening";
}
