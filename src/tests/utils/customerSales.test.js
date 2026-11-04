import { describe, expect, it } from "vitest";
import {
  MONTH_HEADERS,
  bestMonth,
  buildCustomerSalesCsv,
  customerKey,
  filterCustomers,
  financialYearLabel,
  heatLevel,
  largestCellRevenue,
  rankCustomers,
  sumMonthlyTotals,
} from "../../utils/customerSales";

const month = (quantity = 0, revenue = 0, free = 0) => ({ quantity, free, revenue });
const months = (overrides = {}) =>
  MONTH_HEADERS.map((_, i) => overrides[i] || month());

const customers = [
  {
    customerId: "c1",
    customerName: "Sharma Medical",
    contact: "9810000001",
    gstin: "07ABCDE1234F1Z5",
    totalQuantity: 30,
    totalRevenue: 3000,
    products: [
      { id: "p1", medicineName: "Paracetamol 500", monthlyData: months({ 0: month(10, 1000), 2: month(20, 2000) }), totalQuantity: 30, totalRevenue: 3000 },
    ],
    monthlyTotals: months({ 0: month(10, 1000), 2: month(20, 2000) }),
  },
  {
    customerId: "c2",
    customerName: "City Care",
    contact: "",
    gstin: "",
    totalQuantity: 5,
    totalRevenue: 9000,
    products: [
      { id: "p2", medicineName: "Amoxicillin 250", monthlyData: months({ 1: month(5, 9000, 2) }), totalQuantity: 5, totalRevenue: 9000 },
      { id: "p3", medicineName: "Cetirizine", monthlyData: months(), totalQuantity: 0, totalRevenue: 0 },
    ],
    monthlyTotals: months({ 1: month(5, 9000, 2) }),
  },
];

describe("labels and keys", () => {
  it("formats a financial year", () => {
    expect(financialYearLabel(2026)).toBe("FY 2026-27");
  });

  it("keys a customer by id, falling back to name", () => {
    expect(customerKey(customers[0])).toBe("c1");
    expect(customerKey({ customerName: "Walk-in" })).toBe("Walk-in");
  });
});

describe("rankCustomers", () => {
  it("orders by revenue without mutating the input", () => {
    expect(rankCustomers(customers).map((c) => c.customerId)).toEqual(["c2", "c1"]);
    expect(customers[0].customerId).toBe("c1");
  });
});

describe("filterCustomers", () => {
  it("returns everyone for an empty search", () => {
    expect(filterCustomers(customers, "  ")).toHaveLength(2);
  });

  it("keeps a customer whole when its own details match", () => {
    const result = filterCustomers(customers, "sharma");
    expect(result).toHaveLength(1);
    expect(result[0].products).toHaveLength(1);
    expect(filterCustomers(customers, "abcde1234")).toHaveLength(1);
    expect(filterCustomers(customers, "98100000")).toHaveLength(1);
  });

  it("narrows to matching products otherwise", () => {
    const result = filterCustomers(customers, "amox");
    expect(result).toHaveLength(1);
    expect(result[0].customerId).toBe("c2");
    expect(result[0].products.map((p) => p.id)).toEqual(["p2"]);
  });

  it("returns nothing when nothing matches", () => {
    expect(filterCustomers(customers, "zzz")).toEqual([]);
  });
});

describe("heat map", () => {
  it("finds the largest cell", () => {
    expect(largestCellRevenue(customers[1])).toBe(9000);
    expect(largestCellRevenue({})).toBe(0);
  });

  it("scales cells into levels 1-4 and leaves empty cells at 0", () => {
    expect(heatLevel(0, 100)).toBe(0);
    expect(heatLevel(10, 0)).toBe(0);
    expect(heatLevel(1, 100)).toBe(1);
    expect(heatLevel(50, 100)).toBe(2);
    expect(heatLevel(51, 100)).toBe(3);
    expect(heatLevel(100, 100)).toBe(4);
  });
});

describe("month totals", () => {
  it("names the best month", () => {
    expect(bestMonth(customers[0].monthlyTotals)).toEqual({ month: "Jun", revenue: 2000 });
    expect(bestMonth(months())).toBeNull();
  });

  it("sums months across customers", () => {
    const total = sumMonthlyTotals(customers);
    expect(total[0]).toEqual({ quantity: 10, free: 0, revenue: 1000 });
    expect(total[1]).toEqual({ quantity: 5, free: 2, revenue: 9000 });
    expect(total).toHaveLength(12);
  });
});

describe("buildCustomerSalesCsv", () => {
  it("emits one row per product plus a labelled total", () => {
    const { headers, rows } = buildCustomerSalesCsv(customers);
    expect(headers).toHaveLength(rows[0].length);
    expect(rows).toHaveLength(4);
    const total = rows[rows.length - 1];
    expect(total[0]).toBe("GRAND TOTAL");
    expect(total[total.length - 1]).toBe(12000);
    expect(total[total.length - 2]).toBe(35);
  });

  it("labels a single-customer export as that customer's total", () => {
    const { rows } = buildCustomerSalesCsv([customers[0]]);
    expect(rows[rows.length - 1][0]).toBe("CUSTOMER TOTAL");
  });
});
