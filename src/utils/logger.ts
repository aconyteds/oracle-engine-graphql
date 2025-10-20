import * as Sentry from "@sentry/bun";

const sentryEnabled =
  process.env.SENTRY_DSN && process.env.NODE_ENV === "production";

class Logger {
  static info(message: string, ...args: unknown[]) {
    console.log(`INFO: ${message}`, ...args);
    if (sentryEnabled) {
      Sentry.captureMessage(message, {
        level: "info",
        extra: this.formatArgsForSentry(args),
      });
    }
  }

  static warn(message: string, ...args: unknown[]) {
    console.warn(`WARN: ${message}`, ...args);
    if (sentryEnabled) {
      Sentry.captureMessage(message, {
        level: "warning",
        extra: this.formatArgsForSentry(args),
      });
    }
  }

  static error(
    message: string,
    errorOrArgs?: Error | unknown,
    ...args: unknown[]
  ) {
    // If first argument is an Error, use it; otherwise create one
    const error =
      errorOrArgs instanceof Error ? errorOrArgs : new Error(message);
    const extraArgs =
      errorOrArgs instanceof Error ? args : [errorOrArgs, ...args];

    // In test environment, don't log errors to console (reduces noise)
    // Tests can still catch and verify errors through the GraphQL response
    if (process.env.NODE_ENV !== "test") {
      console.error(`ERROR: ${message}`, error, ...extraArgs);
    }

    if (sentryEnabled) {
      Sentry.captureException(error, {
        level: "error",
        extra: {
          message,
          ...this.formatArgsForSentry(extraArgs),
        },
      });
    }
  }

  static debug(message: string, ...args: unknown[]) {
    if (
      process.env.NODE_ENV !== "production" &&
      process.env.NODE_ENV !== "test"
    ) {
      console.debug(`DEBUG: ${message}`, ...args);
    }
  }

  static success(message: string, ...args: unknown[]) {
    console.log(`✓ SUCCESS: ${message}`, ...args);
    if (sentryEnabled) {
      Sentry.captureMessage(message, {
        level: "info",
        extra: {
          type: "success",
          ...this.formatArgsForSentry(args),
        },
      });
    }
  }

  /**
   * Formats arguments into a Sentry-readable format
   * Handles objects, arrays, primitives, and Error objects
   */
  private static formatArgsForSentry(args: unknown[]): Record<string, unknown> {
    if (args.length === 0) {
      return {};
    }

    const formatted: Record<string, unknown> = {};

    args.forEach((arg, index) => {
      const key = `arg${index}`;

      if (arg === null || arg === undefined) {
        formatted[key] = String(arg);
      } else if (arg instanceof Error) {
        formatted[key] = {
          name: arg.name,
          message: arg.message,
          stack: arg.stack,
        };
      } else if (typeof arg === "object") {
        try {
          // Try to serialize objects, handling circular references
          formatted[key] = JSON.parse(JSON.stringify(arg));
        } catch {
          // If serialization fails (circular refs, etc), use string representation
          formatted[key] = String(arg);
        }
      } else {
        // Primitives (string, number, boolean)
        formatted[key] = arg;
      }
    });

    return formatted;
  }
}

export const logger = Logger;
export default Logger;
