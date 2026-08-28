import { describe, it, expect } from "vitest";
import { buildCsv, csvCell } from "../../utils/csvExport";

describe("csvExport", () => {
  it("keeps a '#' in a product name instead of truncating the file", () => {
    const csv = buildCsv(
      ["Product Name", "Qty"],
      [
        ["Vitamin #5 Syrup", 12],
        ["Paracetamol 500", 30],
      ]
    );

    // The old data: URI export lost everything from the '#' onwards.
    expect(csv).toContain("Vitamin #5 Syrup");
    expect(csv).toContain("Paracetamol 500");
    expect(csv.split("\r\n")).toHaveLength(3);
  });

  it("neutralises cells a spreadsheet would run as a formula", () => {
    expect(csvCell("=1+1")).toBe("\"'=1+1\"");
    expect(csvCell("+SUM(A1)")).toBe("\"'+SUM(A1)\"");
    expect(csvCell("-2+3")).toBe("\"'-2+3\"");
    expect(csvCell("@import")).toBe("\"'@import\"");
  });

  it("escapes quotes and keeps commas inside a field", () => {
    expect(csvCell('Cough "DX" Syrup, 100ml')).toBe(
      '"Cough ""DX"" Syrup, 100ml"'
    );
  });

  it("writes numbers unquoted so they stay numeric in a spreadsheet", () => {
    expect(csvCell(1050.5)).toBe("1050.5");
    expect(csvCell(0)).toBe("0");
    expect(csvCell(null)).toBe("");
  });
});
