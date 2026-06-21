const PRODUCTION_API_URL = "https://abros-healthcare.onrender.com";
const AUTH_TOKEN_KEY = "abros_auth_token";

const API_BASE =
  import.meta.env.VITE_API_URL ||
  (import.meta.env.PROD ? PRODUCTION_API_URL : "http://localhost:3000");

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
  const res = await fetch(`${API_BASE}${path}`, {
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...options.headers,
    },
    ...options,
  });

  const data = await res.json().catch(() => ({}));

  if (res.status === 401 && !path.startsWith("/api/auth/login")) {
    clearAuthToken();
    if (window.location.pathname !== "/login") {
      window.location.href = "/login";
    }
  }

  if (!res.ok) {
    const errorMessage =
      data.error?.message || data.message || "Request failed";
    throw new Error(errorMessage);
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
  stats: (days = 30) => request(`/api/medicines/stats?days=${days}`),
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
  generateNumber: () => request("/api/invoices/generate-number"),
};
