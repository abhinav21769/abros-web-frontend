import { describe, expect, it } from "vitest";
import {
  buildFinancialYearOptions,
  buildGstCsv,
  buildSummaryParams,
  filterInvoices,
  getFinancialYear,
  getQuarter,
  gstCsvFilename,
  monthsInQuarter,
  percentOf,
  sumInvoices,
} from "../../utils/gstReport";

const invoices = [
  {
    _id: "1",
    invoiceNumber: "AH-2026-0001",
    invoiceDate: "2026-04-10T00:00:00+05:30",
    customerName: "Sharma Medical",
    customerGstin: "07ABCDE1234F1Z5",
    registrationType: "gst",
    status: "paid",
    subtotal: "1000.00",
    cgst: "60.00",
    sgst: "60.00",
    gst: "120.00",
    total: "1120.00",
  },
  {
    _id: "2",
    invoiceNumber: "AH-2026-0002",
    invoiceDate: "2026-05-02T00:00:00+05:30",
    customerName: "Walk-in Customer",
    customerGstin: "",
    registrationType: "non-gst",
    status: "pending",
    subtotal: "500.00",
    cgst: "30.00",
    sgst: "30.00",
    gst: "60.00",
    total: "560.00",
  },
];

describe("financial year helpers", () => {
  it("starts the financial year in April", () => {
    expect(getFinancialYear(new Date(2026, 2, 31))).toBe(2025);
    expect(getFinancialYear(new Date(2026, 3, 1))).toBe(2026);
  });

  it("maps months to Indian quarters", () => {
    expect(getQuarter(new Date(2026, 3, 15))).toBe(1);
    expect(getQuarter(new Date(2026, 11, 15))).toBe(3);
    expect(getQuarter(new Date(2026, 0, 15))).toBe(4);
  });

  it("lists the months of a quarter in financial-year order", () => {
    expect(monthsInQuarter(4).map((m) => m.value)).toEqual([1, 2, 3]);
    expect(monthsInQuarter(2).map((m) => m.short)).toEqual(["Jul", "Aug", "Sep"]);
  });

  it("builds descending FY options", () => {
    const options = buildFinancialYearOptions(new Date(2026, 5, 1), 3);
    expect(options).toEqual([
      { value: 2026, label: "FY 2026-27" },
      { value: 2025, label: "FY 2025-26" },
      { value: 2024, label: "FY 2024-25" },
    ]);
  });
});

describe("buildSummaryParams", () => {
  it("sends the quarter for quarterly views", () => {
    expect(
      buildSummaryParams({ financialYear: 2026, periodType: "quarterly", quarter: 2, month: 7 }),
    ).toEqual({ financialYear: 2026, periodType: "quarterly", quarter: 2 });
  });

  it("sends the month for monthly views", () => {
    expect(
      buildSummaryParams({ financialYear: 2026, periodType: "monthly", quarter: 2, month: 7 }),
    ).toEqual({ financialYear: 2026, periodType: "monthly", month: 7 });
  });

  it("asks for the whole year otherwise", () => {
    expect(
      buildSummaryParams({ financialYear: 2026, periodType: "yearly", quarter: 2, month: 7 }),
    ).toEqual({ financialYear: 2026, periodType: "yearly", quarter: "all" });
  });
});

describe("filterInvoices", () => {
  it("filters by registration type", () => {
    expect(filterInvoices(invoices, { registration: "gst" })).toHaveLength(1);
    expect(filterInvoices(invoices, { registration: "non-gst" })[0]._id).toBe("2");
  });

  it("filters by month in IST", () => {
    expect(filterInvoices(invoices, { month: "5" }).map((i) => i._id)).toEqual(["2"]);
  });

  it("searches invoice number, customer and GSTIN", () => {
    expect(filterInvoices(invoices, { search: "sharma" })).toHaveLength(1);
    expect(filterInvoices(invoices, { search: "0002" })[0]._id).toBe("2");
    expect(filterInvoices(invoices, { search: "abcde1234" })[0]._id).toBe("1");
    expect(filterInvoices(invoices, { search: "nobody" })).toHaveLength(0);
  });

  it("tolerates missing data", () => {
    expect(filterInvoices(undefined)).toEqual([]);
  });
});

describe("totals and shares", () => {
  it("sums invoice amounts", () => {
    expect(sumInvoices(invoices)).toEqual({
      count: 2,
      subtotal: 1500,
      cgst: 90,
      sgst: 90,
      gst: 180,
      total: 1680,
    });
  });

  it("computes a percentage share without dividing by zero", () => {
    expect(percentOf(1000, 1500)).toBe(66.7);
    expect(percentOf(0, 0)).toBe(0);
  });
});

describe("CSV export", () => {
  it("emits numeric columns and B2B/B2C labels", () => {
    const { headers, rows } = buildGstCsv(invoices, () => "10-04-2026");
    expect(headers).toHaveLength(rows[0].length);
    expect(rows[0]).toEqual([
      "AH-2026-0001",
      "10-04-2026",
      "Sharma Medical",
      "07ABCDE1234F1Z5",
      "B2B",
      "paid",
      1000,
      60,
      60,
      120,
      1120,
    ]);
    expect(rows[1][4]).toBe("B2C");
  });

  it("derives a filesystem-safe filename from the period", () => {
    expect(gstCsvFilename({ label: "Q1 FY 2026-27 (Apr – Jun)" })).toBe(
      "gstr1-q1-fy-2026-27-apr-jun.csv",
    );
    expect(gstCsvFilename(undefined)).toBe("gstr1-gst-report.csv");
  });
});
