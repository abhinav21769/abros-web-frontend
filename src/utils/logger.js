import * as Sentry from "@sentry/react";

const sentryDsn = import.meta.env.VITE_SENTRY_DSN;
const isProduction = import.meta.env.PROD;

// M-4 FIX: Export explicit init function instead of running as module side-effect
export function initLogger() {
  if (sentryDsn) {
    try {
      Sentry.init({
        dsn: sentryDsn,
        integrations: [Sentry.browserTracingIntegration()],
        // M-2 FIX: Lower sample rate in production
        tracesSampleRate: isProduction ? 0.1 : 1.0,
      });
    } catch (err) {
      console.warn("⚠️ Failed to initialize Sentry on frontend:", err);
    }
  }
}

export const logger = {
  info: (msg, meta = {}) => {
    console.log(`[INFO] ${msg}`, meta);
  },
  warn: (msg, meta = {}) => {
    console.warn(`[WARN] ${msg}`, meta);
  },
  error: (msg, errorOrMeta = {}) => {
    console.error(`[ERROR] ${msg}`, errorOrMeta);
    if (sentryDsn) {
      if (errorOrMeta instanceof Error) {
        Sentry.captureException(errorOrMeta, { extra: { customMessage: msg } });
      } else {
        Sentry.captureMessage(`${msg} - ${JSON.stringify(errorOrMeta)}`);
      }
    }
  },
};

export default logger;
