import { describe, expect, it } from "vitest";
import {
  MONTH_COLUMNS,
  QUARTER_COLUMNS,
  activeColumns,
  buildProductSalesCsv,
  cellFigures,
  columnTotals,
  filterProducts,
  grandTotals,
  largestCell,
  periodSeries,
  revenueShare,
  rowTotals,
  sortProducts,
} from "../../utils/productSales";

const quarter = (quantity = 0, revenue = 0, free = 0) => ({ quantity, free, revenue });
const quarters = (...cells) => [0, 1, 2, 3].map((i) => cells[i] || quarter());
const months = (overrides = {}) =>
  Array.from({ length: 12 }, (_, i) => overrides[i] || quarter());

const products = [
  {
    id: "p1",
    medicineName: "Paracetamol 500",
    customerNames: ["Sharma Medical", "City Care"],
    quarterlyData: quarters(quarter(10, 1000, 2), quarter(5, 500)),
    monthlyData: months({ 0: quarter(10, 1000, 2), 3: quarter(5, 500) }),
  },
  {
    id: "p2",
    medicineName: "Amoxicillin 250",
    customerNames: ["Apollo"],
    quarterlyData: quarters(quarter(40, 8000), null, quarter(0, 0, 4)),
    monthlyData: months({ 1: quarter(40, 8000) }),
  },
  {
    id: "p3",
    medicineName: "Cetirizine",
    customerNames: [],
    quarterlyData: quarters(quarter(20, 2500)),
    monthlyData: months({ 2: quarter(20, 2500) }),
  },
];

describe("columns", () => {
  it("has four quarters and twelve months in financial-year order", () => {
    expect(QUARTER_COLUMNS).toHaveLength(4);
    expect(MONTH_COLUMNS.map((m) => m.short).slice(0, 3)).toEqual(["Apr", "May", "Jun"]);
    expect(MONTH_COLUMNS[11]).toMatchObject({ short: "Mar", monthNumber: 3, index: 11 });
  });

  it("narrows to one column and falls back for unknown keys", () => {
    expect(activeColumns("quarterly")).toHaveLength(4);
    expect(activeColumns("quarterly", "q2").map((c) => c.key)).toEqual(["q2"]);
    expect(activeColumns("monthly", "m11").map((c) => c.short)).toEqual(["Nov"]);
    expect(activeColumns("monthly", "bogus")).toHaveLength(12);
  });
});

describe("figures", () => {
  it("counts quantity plus free as units", () => {
    expect(cellFigures(products[0], "quarterly", QUARTER_COLUMNS[0])).toEqual({ units: 12, revenue: 1000 });
    expect(cellFigures(products[0], "monthly", MONTH_COLUMNS[3])).toEqual({ units: 5, revenue: 500 });
  });

  it("treats missing periods as empty", () => {
    expect(cellFigures({}, "quarterly", QUARTER_COLUMNS[2])).toEqual({ units: 0, revenue: 0 });
  });

  it("totals a row across the full year regardless of the shown period", () => {
    expect(rowTotals(products[0])).toEqual({ units: 17, revenue: 1500 });
    expect(rowTotals(products[1])).toEqual({ units: 44, revenue: 8000 });
  });

  it("sums columns and the grand total", () => {
    const totals = columnTotals(products, "quarterly", QUARTER_COLUMNS);
    expect(totals[0]).toEqual({ units: 72, revenue: 11500 });
    expect(grandTotals(products)).toEqual({ units: 81, revenue: 12000 });
  });

  it("finds the largest cell for the metric shown", () => {
    expect(largestCell(products, "quarterly", QUARTER_COLUMNS, "revenue")).toBe(8000);
    expect(largestCell(products, "quarterly", QUARTER_COLUMNS, "quantity")).toBe(40);
  });
});

describe("filterProducts", () => {
  it("matches product or customer names, case-insensitively", () => {
    expect(filterProducts(products, "amox")).toHaveLength(1);
    expect(filterProducts(products, "SHARMA").map((p) => p.id)).toEqual(["p1"]);
    expect(filterProducts(products, "  ")).toHaveLength(3);
    expect(filterProducts(products, "zzz")).toEqual([]);
  });
});

describe("sortProducts", () => {
  it("sorts by revenue descending by default without mutating the input", () => {
    expect(sortProducts(products).map((p) => p.id)).toEqual(["p2", "p3", "p1"]);
    expect(products[0].id).toBe("p1");
  });

  it("sorts by units and by name in either direction", () => {
    expect(sortProducts(products, "units", "asc").map((p) => p.id)).toEqual(["p1", "p3", "p2"]);
    expect(sortProducts(products, "name", "asc").map((p) => p.id)).toEqual(["p2", "p3", "p1"]);
  });

  it("returns a copy for an unknown key", () => {
    expect(sortProducts(products, "nope").map((p) => p.id)).toEqual(["p1", "p2", "p3"]);
  });
});

describe("revenueShare and periodSeries", () => {
  it("computes a share without dividing by zero", () => {
    expect(revenueShare(8000, 12000)).toBe(66.7);
    expect(revenueShare(5, 0)).toBe(0);
  });

  it("builds one bar per period from the grand totals", () => {
    const report = { quarterlyGrandTotals: [quarter(10, 100, 1), quarter(), quarter(5, 50)] };
    const series = periodSeries("quarterly", report);
    expect(series).toHaveLength(4);
    expect(series[0]).toMatchObject({ units: 11, revenue: 100 });
    expect(series[3]).toMatchObject({ units: 0, revenue: 0 });
    expect(periodSeries("monthly", {})).toHaveLength(12);
  });
});

describe("buildProductSalesCsv", () => {
  it("emits a row per product plus a grand total", () => {
    const { headers, rows } = buildProductSalesCsv(products, "quarterly", QUARTER_COLUMNS);
    expect(headers).toHaveLength(rows[0].length);
    expect(rows).toHaveLength(4);
    expect(rows[0].slice(0, 3)).toEqual(["Paracetamol 500", 12, 1000]);
    expect(rows[3][0]).toBe("GRAND TOTAL");
    expect(rows[3].slice(-2)).toEqual([81, 12000]);
  });

  it("exports only the shown columns", () => {
    const columns = activeColumns("quarterly", "q1");
    const { headers } = buildProductSalesCsv(products, "quarterly", columns);
    expect(headers).toEqual([
      "Product Name",
      "Q1 (Apr – Jun) Qty",
      "Q1 (Apr – Jun) Revenue (Rs)",
      "Total Qty Sold",
      "Total Revenue (Rs)",
    ]);
  });
});
