import * as Sentry from "@sentry/react";

const sentryDsn = import.meta.env.VITE_SENTRY_DSN;

if (sentryDsn) {
  try {
    Sentry.init({
      dsn: sentryDsn,
      integrations: [Sentry.browserTracingIntegration()],
      tracesSampleRate: 1.0,
    });
    console.log("🛡️ Sentry frontend crash tracking enabled.");
  } catch (err) {
    console.warn("⚠️ Failed to initialize Sentry on frontend:", err);
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
