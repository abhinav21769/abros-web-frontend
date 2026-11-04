import { describe, expect, it } from "vitest";
import {
  batchOverview,
  batchRange,
  expiryStatus,
  medicineExpiry,
  stockLevel,
  stockShare,
} from "../../utils/inventoryView";

// 12:00 IST on 4 Nov 2026
const NOW = new Date("2026-11-04T06:30:00Z");
const on = (date) => `${date}T00:00:00+05:30`;

describe("expiryStatus", () => {
  it("flags expired, same-day, near and distant expiries", () => {
    expect(expiryStatus(on("2026-11-01"), NOW)).toMatchObject({ days: -3, tone: "danger", label: "Expired" });
    expect(expiryStatus(on("2026-11-04"), NOW)).toMatchObject({ days: 0, tone: "danger", label: "Expires today" });
    expect(expiryStatus(on("2026-11-20"), NOW)).toMatchObject({ days: 16, tone: "warning", label: "16d left" });
    expect(expiryStatus(on("2026-12-04"), NOW)).toMatchObject({ days: 30, tone: "warning" });
    expect(expiryStatus(on("2026-12-05"), NOW)).toMatchObject({ days: 31, tone: "success", label: "In date" });
  });

  it("copes with a missing date", () => {
    expect(expiryStatus(null, NOW)).toEqual({ days: null, tone: "neutral", label: "No expiry" });
  });
});

describe("stockLevel", () => {
  it("separates out, low and healthy stock", () => {
    expect(stockLevel(0)).toBe("out");
    expect(stockLevel(-4)).toBe("out");
    expect(stockLevel(199)).toBe("low");
    expect(stockLevel(200)).toBe("ok");
    expect(stockLevel(50, 40)).toBe("ok");
    expect(stockLevel(undefined)).toBe("out");
  });
});

describe("batchRange", () => {
  const batches = [
    { mrp: 10, rate: 7 },
    { mrp: 12, rate: 7 },
  ];

  it("returns min and max when batches differ", () => {
    expect(batchRange(batches, "mrp")).toEqual({ min: 10, max: 12 });
  });

  it("returns null when batches agree or there is only one", () => {
    expect(batchRange(batches, "rate")).toBeNull();
    expect(batchRange([{ mrp: 5 }], "mrp")).toBeNull();
    expect(batchRange(undefined, "mrp")).toBeNull();
  });
});

describe("medicineExpiry", () => {
  it("uses the nearest-expiring batch that still has stock", () => {
    const medicine = {
      expiryDate: on("2027-06-01"),
      batches: [
        { quantity: 0, expiryDate: on("2026-10-01") }, // expired but empty: ignore
        { quantity: 10, expiryDate: on("2026-11-20") },
        { quantity: 5, expiryDate: on("2027-03-01") },
      ],
    };
    expect(medicineExpiry(medicine, NOW)).toMatchObject({ days: 16, tone: "warning", date: on("2026-11-20") });
  });

  it("falls back to every batch when none holds stock", () => {
    const medicine = { batches: [{ quantity: 0, expiryDate: on("2026-10-01") }] };
    expect(medicineExpiry(medicine, NOW).tone).toBe("danger");
  });

  it("falls back to the medicine's own expiry when it has no batches", () => {
    expect(medicineExpiry({ expiryDate: on("2027-01-01") }, NOW)).toMatchObject({ tone: "success" });
  });
});

describe("batchOverview", () => {
  const batches = [
    { batchNumber: "A", quantity: 100, expiryDate: on("2027-06-01") },
    { batchNumber: "B", quantity: 0, expiryDate: on("2026-10-01") }, // earliest but empty
    { batchNumber: "C", quantity: 50, expiryDate: on("2026-11-20") },
  ];

  it("counts batches and units and points at the batch sales draw from first", () => {
    const overview = batchOverview(batches, NOW);
    expect(overview).toMatchObject({ count: 3, totalUnits: 150, emptyCount: 1, nextIndex: 2 });
    expect(overview.nearestDate).toBe(on("2026-11-20"));
    expect(overview.nearestStatus).toMatchObject({ days: 16, tone: "warning" });
  });

  it("still picks an expired batch, since FEFO only looks at stock", () => {
    const overview = batchOverview([{ quantity: 5, expiryDate: on("2026-10-01") }, ...batches.slice(0, 1)], NOW);
    expect(overview.nextIndex).toBe(0);
    expect(overview.nearestStatus.tone).toBe("danger");
  });

  it("has no next batch when nothing holds stock", () => {
    const overview = batchOverview([{ quantity: 0, expiryDate: on("2027-01-01") }], NOW);
    expect(overview).toMatchObject({ nextIndex: -1, nearestDate: null, nearestStatus: null, totalUnits: 0 });
  });

  it("copes with no batches", () => {
    expect(batchOverview(undefined, NOW)).toMatchObject({ count: 0, totalUnits: 0, nextIndex: -1 });
  });
});

describe("stockShare", () => {
  it("returns a clamped percentage and survives a zero total", () => {
    expect(stockShare(50, 200)).toBe(25);
    expect(stockShare(300, 200)).toBe(100);
    expect(stockShare(5, 0)).toBe(0);
  });
});
