import { describe, expect, it } from "vitest";
import {
  buildAlerts,
  collectionBreakdown,
  daysUntil,
  describeExpiry,
  expiryTone,
  formatRecentDate,
  greeting,
  inventoryHealth,
  percent,
} from "../../utils/dashboardMetrics";

// 12:00 IST on 4 Nov 2026
const NOW = new Date("2026-11-04T06:30:00Z");

describe("daysUntil", () => {
  it("counts IST calendar days, not 24-hour blocks", () => {
    expect(daysUntil("2026-11-04T00:00:00+05:30", NOW)).toBe(0);
    expect(daysUntil("2026-11-05T00:00:00+05:30", NOW)).toBe(1);
    expect(daysUntil("2026-12-04T00:00:00+05:30", NOW)).toBe(30);
    expect(daysUntil("2026-11-01T00:00:00+05:30", NOW)).toBe(-3);
  });

  it("treats a late-evening UTC timestamp as the next IST day", () => {
    // 20:00 UTC on 4 Nov is 01:30 IST on 5 Nov
    expect(daysUntil("2026-11-04T20:00:00Z", NOW)).toBe(1);
  });

  it("returns null for missing or invalid dates", () => {
    expect(daysUntil(null, NOW)).toBeNull();
    expect(daysUntil("not a date", NOW)).toBeNull();
  });
});

describe("describeExpiry and expiryTone", () => {
  it("words the countdown", () => {
    expect(describeExpiry(0)).toBe("Expires today");
    expect(describeExpiry(1)).toBe("Expires tomorrow");
    expect(describeExpiry(45)).toBe("In 45 days");
    expect(describeExpiry(-1)).toBe("1 day overdue");
    expect(describeExpiry(-9)).toBe("9 days overdue");
    expect(describeExpiry(null)).toBe("—");
  });

  it("marks overdue and near-term expiries urgent", () => {
    expect(expiryTone(-2)).toBe("danger");
    expect(expiryTone(30)).toBe("danger");
    expect(expiryTone(31)).toBe("warning");
    expect(expiryTone(null)).toBe("neutral");
  });
});

describe("percent", () => {
  it("rounds, clamps and survives a zero denominator", () => {
    expect(percent(1, 3)).toBe(33);
    expect(percent(5, 2)).toBe(100);
    expect(percent(1, 0)).toBe(0);
  });
});

describe("buildAlerts", () => {
  const inventory = {
    expiredStock: 2,
    expiringStock: 5,
    expiringWithinDays: 180,
    lowStockCount: 7,
    lowStockThreshold: 200,
  };

  it("lists every active problem in priority order", () => {
    const alerts = buildAlerts({ inventory, sales: { pendingInvoices: 3 } });
    expect(alerts.map((a) => a.id)).toEqual(["expired", "expiring", "low", "pending"]);
    expect(alerts[1].detail).toContain("180 days");
    expect(alerts[2].detail).toContain("200 units");
  });

  it("omits anything that is clear", () => {
    const alerts = buildAlerts({
      inventory: { ...inventory, expiredStock: 0, expiringStock: 0, lowStockCount: 0 },
      sales: { pendingInvoices: 0 },
    });
    expect(alerts).toEqual([]);
  });
});

describe("collectionBreakdown", () => {
  it("splits billed value into paid and pending", () => {
    const result = collectionBreakdown({ totalRevenue: "7500.00", pendingAmount: "2500.00" });
    expect(result).toMatchObject({ paid: 7500, pending: 2500, billed: 10000, paidPercent: 75, pendingPercent: 25 });
  });

  it("is all zero when nothing has been billed", () => {
    expect(collectionBreakdown({ totalRevenue: "0.00", pendingAmount: "0.00" })).toMatchObject({
      billed: 0,
      paidPercent: 0,
      pendingPercent: 0,
    });
  });
});

describe("inventoryHealth", () => {
  it("expresses stock health against the product count", () => {
    const rows = inventoryHealth({ totalStock: 40, activeStock: 30, lowStockCount: 10 });
    expect(rows.map((r) => [r.id, r.value, r.percent])).toEqual([
      ["active", 30, 75],
      ["low", 10, 25],
    ]);
  });
});

describe("greeting", () => {
  it("follows the IST hour", () => {
    expect(greeting(new Date("2026-11-04T03:00:00Z"))).toBe("Good morning"); // 08:30 IST
    expect(greeting(NOW)).toBe("Good afternoon");
    expect(greeting(new Date("2026-11-04T14:00:00Z"))).toBe("Good evening"); // 19:30 IST
  });
});

describe("formatRecentDate", () => {
  it("drops the year within the current IST year", () => {
    expect(formatRecentDate("2026-11-03T00:00:00+05:30", NOW)).toBe("03 Nov");
  });

  it("keeps the year for other years", () => {
    expect(formatRecentDate("2025-12-28T00:00:00+05:30", NOW)).toBe("28 Dec 2025");
  });

  it("shows a dash for missing dates", () => {
    expect(formatRecentDate(null, NOW)).toBe("—");
  });
});
