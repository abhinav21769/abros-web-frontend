export const PAYMENT_CONFIG = {
  upiId: import.meta.env.VITE_UPI_ID || "",
  payeeName: import.meta.env.VITE_UPI_PAYEE_NAME || "ABROS HEALTHCARE",
};

export function isPaymentConfigured() {
  return Boolean(PAYMENT_CONFIG.upiId.trim());
}
