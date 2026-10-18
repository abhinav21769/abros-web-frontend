// H-2 FIX: No hardcoded production URL — require VITE_API_URL to be set explicitly
const AUTH_TOKEN_KEY = "abros_auth_token";

function resolveApiBase() {
  const envUrl = import.meta.env.VITE_API_URL;
  if (import.meta.env.PROD) {
    if (envUrl && !envUrl.includes("localhost") && !envUrl.includes("127.0.0.1")) {
      return envUrl;
    }
    // Fail loudly so the missing config is caught immediately, not silently
    throw new Error(
      "[CONFIG ERROR] VITE_API_URL must be set to a production backend URL. " +
      "Do not use localhost in production builds."
    );
  }
  return envUrl || "http://localhost:3000";
}

const API_BASE = resolveApiBase();

export function getAuthToken() {
  return localStorage.getItem(AUTH_TOKEN_KEY);
}

export function setAuthToken(token) {
  localStorage.setItem(AUTH_TOKEN_KEY, token);
}

export function clearAuthToken() {
  localStorage.removeItem(AUTH_TOKEN_KEY);
}

async function request(path, options = {}) {
  const token = getAuthToken();
  // Spread the rest first so a caller's own `headers` adds to these instead of
  // replacing them (and silently dropping the Authorization header).
  const { headers, ...rest } = options;
  let res;

  try {
    res = await fetch(`${API_BASE}${path}`, {
      ...rest,
      headers: {
        "Content-Type": "application/json",
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
        ...headers,
      },
    });
  } catch (err) {
    throw new Error(
      "Unable to connect to backend server. If using production, the server may be waking up—please wait 10 seconds and try again."
    );
  }

  const data = await res.json().catch(() => ({}));

  if (res.status === 401 && !path.startsWith("/api/auth/login")) {
    clearAuthToken();
    if (window.location.pathname !== "/login") {
      window.location.href = "/login";
    }
  }

  if (!res.ok || data.success === false) {
    const errorMessage =
      data.error?.message || data.message || data.errorMessage || "Request failed";
    const error = new Error(errorMessage);
    error.code = data.error?.code;
    error.status = res.status;
    throw error;
  }

  return data;
}

export const authApi = {
  login: (body) =>
    request("/api/auth/login", {
      method: "POST",
      body: JSON.stringify(body),
    }),
  me: () => request("/api/auth/me"),
};

// M-6 FIX: pickers used to load one fixed page (100 customers, 500 medicines)
// and show nothing beyond it, so past those counts a record simply stopped
// appearing - and the usual response is to create a duplicate. This walks every
// page so the lists the form searches are always complete.
async function listAllPages(list, params = {}, pageSize = 200, maxPages = 100) {
  const items = [];
  let page = 1;

  for (;;) {
    const res = await list({ ...params, page, limit: pageSize });
    items.push(...(res.data?.items || []));

    const totalPages = res.data?.pagination?.totalPages || 1;
    page += 1;

    if (page > totalPages || page > maxPages) return items;
  }
}

export const medicinesApi = {
  list: (params = {}) => {
    const query = new URLSearchParams(params).toString();
    return request(`/api/medicines?${query}`);
  },
  get: (id) => request(`/api/medicines/${id}`),
  create: (body) =>
    request("/api/medicines", { method: "POST", body: JSON.stringify(body) }),
  update: (id, body) =>
    request(`/api/medicines/${id}`, { method: "PUT", body: JSON.stringify(body) }),
  remove: (id) => request(`/api/medicines/${id}`, { method: "DELETE" }),
  stats: (days = 180) => request(`/api/medicines/stats?days=${days}`),
  listAll: (params = {}) => listAllPages(medicinesApi.list, params),
};

export const customersApi = {
  list: (params = {}) => {
    const query = new URLSearchParams(params).toString();
    return request(`/api/customers?${query}`);
  },
  get: (id) => request(`/api/customers/${id}`),
  create: (body) =>
    request("/api/customers", { method: "POST", body: JSON.stringify(body) }),
  update: (id, body) =>
    request(`/api/customers/${id}`, { method: "PUT", body: JSON.stringify(body) }),
  remove: (id) => request(`/api/customers/${id}`, { method: "DELETE" }),
  stats: () => request("/api/customers/stats"),
  listAll: (params = {}) => listAllPages(customersApi.list, params),
};

export const invoicesApi = {
  list: (params = {}) => {
    const query = new URLSearchParams(params).toString();
    return request(`/api/invoices?${query}`);
  },
  get: (id) => request(`/api/invoices/${id}`),
  create: (body) =>
    request("/api/invoices", { method: "POST", body: JSON.stringify(body) }),
  update: (id, body) =>
    request(`/api/invoices/${id}`, { method: "PUT", body: JSON.stringify(body) }),
  remove: (id) => request(`/api/invoices/${id}`, { method: "DELETE" }),
  stats: () => request("/api/invoices/stats"),
  generateNumber: (invoiceType = "sale") =>
    request(
      `/api/invoices/generate-number?invoiceType=${encodeURIComponent(invoiceType)}`,
    ),
};

export const dashboardApi = {
  stats: (days = 180) => request(`/api/dashboard/stats?days=${days}`),
  productSales: (params = {}) => {
    const query = new URLSearchParams(params).toString();
    return request(`/api/dashboard/product-sales${query ? `?${query}` : ""}`);
  },
  customerSales: (params = {}) => {
    const query = new URLSearchParams(params).toString();
    return request(`/api/dashboard/customer-sales${query ? `?${query}` : ""}`);
  },
  customerProductSales: (params = {}) => {
    const query = new URLSearchParams(params).toString();
    return request(`/api/dashboard/customer-product-sales${query ? `?${query}` : ""}`);
  },
};

export const gstApi = {
  quarterlySummary: ({ financialYear, quarter, month, periodType } = {}) => {
    const params = new URLSearchParams();
    if (financialYear != null) params.set("financialYear", financialYear);
    if (quarter != null) params.set("quarter", quarter);
    if (month != null) params.set("month", month);
    if (periodType != null) params.set("periodType", periodType);
    const query = params.toString();
    return request(`/api/gst/quarterly-summary${query ? `?${query}` : ""}`);
  },
};

export const purchasesApi = {
  list: (params = {}) => {
    const query = new URLSearchParams(params).toString();
    return request(`/api/purchases?${query}`);
  },
  get: (id) => request(`/api/purchases/${id}`),
  create: (body) =>
    request("/api/purchases", { method: "POST", body: JSON.stringify(body) }),
  generateNumber: () => request("/api/purchases/generate-number"),
};

export const ledgerApi = {
  list: (params = {}) => {
    const query = new URLSearchParams(params).toString();
    return request(`/api/ledger?${query}`);
  },
};

// Customer Services needs a second, section-only password. `unlock` trades it
// for a short-lived section token that every other call sends back; callers
// keep that token in memory only, so leaving the page locks it again.
const sectionHeaders = (sectionToken) => ({ "X-Section-Token": sectionToken || "" });

export const SECTION_LOCKED = "SECTION_LOCKED";

export const customerServicesApi = {
  unlock: (password) =>
    request("/api/customer-services/unlock", {
      method: "POST",
      body: JSON.stringify({ password }),
    }),
  list: (sectionToken, params = {}) => {
    const query = new URLSearchParams(params).toString();
    return request(`/api/customer-services?${query}`, {
      headers: sectionHeaders(sectionToken),
    });
  },
  customerNames: (sectionToken) =>
    request("/api/customer-services/customers", {
      headers: sectionHeaders(sectionToken),
    }),
  create: (sectionToken, body) =>
    request("/api/customer-services", {
      method: "POST",
      body: JSON.stringify(body),
      headers: sectionHeaders(sectionToken),
    }),
  update: (sectionToken, id, body) =>
    request(`/api/customer-services/${id}`, {
      method: "PUT",
      body: JSON.stringify(body),
      headers: sectionHeaders(sectionToken),
    }),
  remove: (sectionToken, id) =>
    request(`/api/customer-services/${id}`, {
      method: "DELETE",
      headers: sectionHeaders(sectionToken),
    }),
};
