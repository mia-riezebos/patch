import pino from "pino";

export function createLogger(debugLogging: boolean) {
  return pino({
    level: debugLogging ? "debug" : "info",
    serializers: {
      err: serializeError,
      error: serializeError,
    },
    redact: {
      paths: [
        "discordToken",
        "authorization",
        "headers.authorization",
        "req.headers.authorization",
      ],
      remove: true,
    },
  });
}

export type Logger = ReturnType<typeof createLogger>;

function serializeError(error: unknown) {
  if (error instanceof Error) {
    return {
      type: error.constructor.name,
      message: error.message,
      stack: error.stack,
      cause: error.cause,
    };
  }

  if (typeof error === "object" && error !== null) {
    return Object.fromEntries(
      Object.entries(error).map(([key, value]) => [key, String(value)]),
    );
  }

  return { message: String(error) };
}
