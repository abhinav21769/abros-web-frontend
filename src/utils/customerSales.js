// Pure helpers behind the Customer × Product Monthly Sales page: ranking and
// searching customers, heat-map levels for the matrix, and the CSV export.

export const MONTH_HEADERS = [
  "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec", "Jan", "Feb", "Mar",
];

export const HEAT_LEVELS = 4;

export function formatNumber(value) {
  const num = Number(value);
  if (value == null || Number.isNaN(num)) return "0";
  return new Intl.NumberFormat("en-IN").format(num);
}

export function financialYearLabel(year) {
  return `FY ${year}-${String(year + 1).slice(-2)}`;
}

export function customerKey(customer) {
  return String(customer.customerId || customer.customerName);
}

export function rankCustomers(customers) {
  return [...(customers || [])].sort(
    (a, b) => (Number(b.totalRevenue) || 0) - (Number(a.totalRevenue) || 0),
  );
}

// A customer matching on name, contact or GSTIN is kept whole; otherwise it is kept
// only if some product matches, narrowed to those products.
export function filterCustomers(customers, search) {
  const term = (search || "").trim().toLowerCase();
  if (!term) return customers || [];

  return (customers || [])
    .map((customer) => {
      const matchesCustomer = [customer.customerName, customer.contact, customer.gstin].some(
        (field) => String(field || "").toLowerCase().includes(term),
      );
      if (matchesCustomer) return customer;

      const products = (customer.products || []).filter((product) =>
        String(product.medicineName || "").toLowerCase().includes(term),
      );
      return products.length > 0 ? { ...customer, products } : null;
    })
    .filter(Boolean);
}

export function largestCellRevenue(customer) {
  let max = 0;
  for (const product of customer.products || []) {
    for (const cell of product.monthlyData || []) {
      max = Math.max(max, Number(cell.revenue) || 0);
    }
  }
  return max;
}

// 0 for an empty cell, otherwise 1..HEAT_LEVELS relative to the largest cell shown.
export function heatLevel(revenue, max) {
  const value = Number(revenue) || 0;
  if (value <= 0 || max <= 0) return 0;
  return Math.min(HEAT_LEVELS, Math.max(1, Math.ceil((value / max) * HEAT_LEVELS)));
}

export function bestMonth(monthlyTotals) {
  let best = null;
  (monthlyTotals || []).forEach((cell, index) => {
    const revenue = Number(cell?.revenue) || 0;
    if (revenue > 0 && (!best || revenue > best.revenue)) {
      best = { month: MONTH_HEADERS[index], revenue };
    }
  });
  return best;
}

// Month totals across a set of customers; equals the report's grand totals when all are given.
export function sumMonthlyTotals(customers) {
  const months = MONTH_HEADERS.map(() => ({ quantity: 0, free: 0, revenue: 0 }));
  for (const customer of customers || []) {
    (customer.monthlyTotals || []).forEach((cell, index) => {
      if (!months[index]) return;
      months[index].quantity += Number(cell?.quantity) || 0;
      months[index].free += Number(cell?.free) || 0;
      months[index].revenue += Number(cell?.revenue) || 0;
    });
  }
  return months;
}

export function buildCustomerSalesCsv(customers) {
  const headers = [
    "Customer Name",
    "Product Name",
    "Contact",
    "GSTIN",
    ...MONTH_HEADERS.flatMap((month) => [`${month} Qty`, `${month} Rev (Rs)`]),
    "Total Qty",
    "Total Revenue (Rs)",
  ];

  const rows = [];
  for (const customer of customers) {
    for (const product of customer.products || []) {
      const cells = (product.monthlyData || []).flatMap((cell) => [
        cell.quantity || 0,
        cell.revenue || 0,
      ]);
      rows.push([
        customer.customerName || "",
        product.medicineName || "",
        customer.contact || "",
        customer.gstin || "",
        ...cells,
        product.totalQuantity || 0,
        product.totalRevenue || 0,
      ]);
    }
  }

  const months = sumMonthlyTotals(customers);
  rows.push([
    customers.length === 1 ? "CUSTOMER TOTAL" : "GRAND TOTAL",
    "",
    "",
    "",
    ...months.flatMap((cell) => [cell.quantity, cell.revenue]),
    customers.reduce((sum, c) => sum + (Number(c.totalQuantity) || 0), 0),
    customers.reduce((sum, c) => sum + (Number(c.totalRevenue) || 0), 0),
  ]);

  return { headers, rows };
}
