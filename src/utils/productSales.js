// Pure helpers behind the Product Sales page: period columns, per-cell and
// per-row figures, filtering, sorting and the CSV export. Units always mean
// quantity + free, matching what the report has always shown.

export const BREAKDOWNS = [
  { value: "quarterly", label: "Quarterly" },
  { value: "monthly", label: "Monthly" },
];

export const CELL_MODES = [
  { value: "quantity", label: "Units" },
  { value: "revenue", label: "Revenue" },
  { value: "both", label: "Both" },
];

export const QUARTER_COLUMNS = [
  { key: "q1", label: "Q1 (Apr – Jun)", short: "Q1", index: 0 },
  { key: "q2", label: "Q2 (Jul – Sep)", short: "Q2", index: 1 },
  { key: "q3", label: "Q3 (Oct – Dec)", short: "Q3", index: 2 },
  { key: "q4", label: "Q4 (Jan – Mar)", short: "Q4", index: 3 },
];

export const MONTH_COLUMNS = [
  ["Apr", "April", 4],
  ["May", "May", 5],
  ["Jun", "June", 6],
  ["Jul", "July", 7],
  ["Aug", "August", 8],
  ["Sep", "September", 9],
  ["Oct", "October", 10],
  ["Nov", "November", 11],
  ["Dec", "December", 12],
  ["Jan", "January", 1],
  ["Feb", "February", 2],
  ["Mar", "March", 3],
].map(([short, label, monthNumber], index) => ({
  key: `m${monthNumber}`,
  label: short,
  fullLabel: label,
  short,
  index,
  monthNumber,
}));

const EMPTY_CELL = { quantity: 0, free: 0, revenue: 0 };

export function allColumns(breakdown) {
  return breakdown === "monthly" ? MONTH_COLUMNS : QUARTER_COLUMNS;
}

// `selected` is "all" or a column key; an unknown key falls back to every column.
export function activeColumns(breakdown, selected = "all") {
  const columns = allColumns(breakdown);
  if (selected === "all") return columns;
  const found = columns.find((column) => column.key === selected);
  return found ? [found] : columns;
}

function periodList(product, breakdown) {
  return (breakdown === "monthly" ? product.monthlyData : product.quarterlyData) || [];
}

export function cellFigures(product, breakdown, column) {
  const cell = periodList(product, breakdown)[column.index] || EMPTY_CELL;
  return {
    units: (cell.quantity || 0) + (cell.free || 0),
    revenue: cell.revenue || 0,
  };
}

// Always the full financial year, whatever period is shown, so a filtered view
// still has a stable year-to-date figure to compare against.
export function rowTotals(product) {
  let units = 0;
  let revenue = 0;
  for (const quarter of product.quarterlyData || []) {
    units += (quarter.quantity || 0) + (quarter.free || 0);
    revenue += quarter.revenue || 0;
  }
  return { units, revenue: Math.round(revenue * 100) / 100 };
}

export function filterProducts(products, search) {
  const term = (search || "").trim().toLowerCase();
  if (!term) return products || [];

  return (products || []).filter(
    (product) =>
      String(product.medicineName || "").toLowerCase().includes(term) ||
      (Array.isArray(product.customerNames) &&
        product.customerNames.some((name) => name && String(name).toLowerCase().includes(term))),
  );
}

export const SORT_KEYS = ["name", "units", "revenue"];

// Returns a new array; `revenue` descending is the report's natural order.
export function sortProducts(products, key = "revenue", direction = "desc") {
  const sign = direction === "asc" ? 1 : -1;
  const read = {
    name: (p) => String(p.medicineName || "").toLowerCase(),
    units: (p) => rowTotals(p).units,
    revenue: (p) => rowTotals(p).revenue,
  }[key];
  if (!read) return [...(products || [])];

  return [...(products || [])].sort((a, b) => {
    const left = read(a);
    const right = read(b);
    if (left < right) return -1 * sign;
    if (left > right) return 1 * sign;
    return String(a.medicineName || "").localeCompare(String(b.medicineName || ""));
  });
}

export function columnTotals(products, breakdown, columns) {
  return columns.map((column) => {
    let units = 0;
    let revenue = 0;
    for (const product of products) {
      const cell = cellFigures(product, breakdown, column);
      units += cell.units;
      revenue += cell.revenue;
    }
    return { units, revenue: Math.round(revenue * 100) / 100 };
  });
}

export function grandTotals(products) {
  let units = 0;
  let revenue = 0;
  for (const product of products) {
    const row = rowTotals(product);
    units += row.units;
    revenue += row.revenue;
  }
  return { units, revenue: Math.round(revenue * 100) / 100 };
}

// Largest single cell for the metric being shown, used to scale the heat map.
export function largestCell(products, breakdown, columns, mode) {
  let max = 0;
  for (const product of products) {
    for (const column of columns) {
      const cell = cellFigures(product, breakdown, column);
      max = Math.max(max, mode === "quantity" ? cell.units : cell.revenue);
    }
  }
  return max;
}

// A product's cumulative share of the shown revenue, as a 0-100 number.
export function revenueShare(revenue, total) {
  const whole = Number(total) || 0;
  if (whole <= 0) return 0;
  return Math.round(((Number(revenue) || 0) / whole) * 1000) / 10;
}

// One bar per period for the overview chart: units and revenue from the report's grand totals.
export function periodSeries(breakdown, report) {
  const totals =
    (breakdown === "monthly" ? report.monthlyGrandTotals : report.quarterlyGrandTotals) || [];

  return allColumns(breakdown).map((column) => {
    const cell = totals[column.index] || EMPTY_CELL;
    return {
      column,
      units: (cell.quantity || 0) + (cell.free || 0),
      revenue: cell.revenue || 0,
    };
  });
}

export function buildProductSalesCsv(products, breakdown, columns) {
  const headers = [
    "Product Name",
    ...columns.flatMap((column) => [
      `${column.label} Qty`,
      `${column.label} Revenue (Rs)`,
    ]),
    "Total Qty Sold",
    "Total Revenue (Rs)",
  ];

  const rows = products.map((product) => {
    const cells = columns.flatMap((column) => {
      const cell = cellFigures(product, breakdown, column);
      return [cell.units, cell.revenue];
    });
    const total = rowTotals(product);
    return [product.medicineName || "", ...cells, total.units, total.revenue];
  });

  const grand = grandTotals(products);
  rows.push([
    "GRAND TOTAL",
    ...columnTotals(products, breakdown, columns).flatMap((cell) => [cell.units, cell.revenue]),
    grand.units,
    grand.revenue,
  ]);

  return { headers, rows };
}
