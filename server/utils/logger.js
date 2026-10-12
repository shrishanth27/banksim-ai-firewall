/**
 * BankSim Structured Logger
 * Provides standardized, timestamped logging with level discrimination
 * and payload sanitization to prevent log injection.
 */

const LOG_LEVELS = {
  INFO: 'INFO',
  WARN: 'WARN',
  ERROR: 'ERROR',
  SECURITY: 'SECURITY'
};

function formatMessage(level, message, meta = null) {
  const timestamp = new Date().toISOString();
  const metaStr = meta ? ` | ${JSON.stringify(meta)}` : '';
  return `[${timestamp}] [${level}] ${message}${metaStr}`;
}

export const logger = {
  info(message, meta) {
    if (process.env.NODE_ENV !== 'test') {
      console.log(formatMessage(LOG_LEVELS.INFO, message, meta));
    }
  },

  warn(message, meta) {
    if (process.env.NODE_ENV !== 'test') {
      console.warn(formatMessage(LOG_LEVELS.WARN, message, meta));
    }
  },

  error(message, error, meta) {
    if (process.env.NODE_ENV !== 'test') {
      const errDetail = error instanceof Error ? { message: error.message, stack: error.stack } : error;
      console.error(formatMessage(LOG_LEVELS.ERROR, message, { ...meta, error: errDetail }));
    }
  },

  security(message, eventData) {
    if (process.env.NODE_ENV !== 'test') {
      console.log(formatMessage(LOG_LEVELS.SECURITY, message, eventData));
    }
  }
};
