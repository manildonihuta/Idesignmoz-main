import "server-only";

export type LogMeta = Record<string, unknown>;

let seq = 0;

export function logId(): string {
  seq = (seq + 1) % 100000;
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}-${seq.toString(36)}`;
}

function describeError(value: unknown): Record<string, unknown> {
  if (value instanceof Error) {
    return {
      name: value.name,
      message: value.message.slice(0, 4000),
      stack: value.stack?.slice(0, 8000) ?? null,
    };
  }
  if (typeof value === "object" && value !== null) {
    try {
      return {
        name: "Unknown",
        message: JSON.stringify(value).slice(0, 4000),
      };
    } catch {
      return { name: "Unknown", message: String(value) };
    }
  }
  return { name: "Unknown", message: String(value).slice(0, 4000) };
}

/**
 * Writes a searchable, structured error line to the runtime logs
 * (collected by the hosting platform, e.g. Vercel). Never throws.
 */
export function serverLogError(source: string, err: unknown, meta?: LogMeta): string {
  const id = logId();
  const line = JSON.stringify({
    tag: "[idesign:error]",
    id,
    source,
    time: new Date().toISOString(),
    error: describeError(err),
    meta: meta ?? {},
  });
  try {
    console.error(line);
  } catch {
    /* logging must never break business logic */
  }
  return id;
}

/**
 * Structured informational log line for non-error runtime events.
 */
export function serverLogInfo(source: string, meta?: LogMeta): void {
  const line = JSON.stringify({
    tag: "[idesign:info]",
    id: logId(),
    source,
    time: new Date().toISOString(),
    meta: meta ?? {},
  });
  try {
    console.info(line);
  } catch {
    /* logging must never break business logic */
  }
}