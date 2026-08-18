type LogValue = unknown;
export type LogMetadata = Record<string, LogValue>;

const protectedKey = /(password|secret|session|response|answer|signed.?url|audio|token|authorization|credential|cookie|api.?key|database.?url)/i;

export type OperationalEvent = {
  requestId: string;
  actorId?: string;
  feature: string;
  action: string;
  outcome: "success" | "failure";
  errorCode?: string;
  metadata?: LogMetadata;
};

export function redact(value: LogValue, key = "", seen = new WeakSet<object>()): LogValue {
  if (protectedKey.test(key)) return "[REDACTED]";
  if (typeof value === "bigint") return value.toString();
  if (Array.isArray(value)) {
    if (seen.has(value)) return "[CIRCULAR]";
    seen.add(value);
    return value.map((entry) => redact(entry, "", seen));
  }
  if (value && typeof value === "object") {
    if (seen.has(value)) return "[CIRCULAR]";
    seen.add(value);
    try {
      return Object.fromEntries(Object.entries(value).map(([entryKey, entryValue]) => [entryKey, redact(entryValue, entryKey, seen)]));
    } catch {
      return "[UNSERIALISABLE]";
    }
  }
  return value;
}

export function logEvent(event: OperationalEvent): void {
  try {
    const safeEvent = redact(event) as OperationalEvent;
    console.info(JSON.stringify(safeEvent));
  } catch {
    console.info(JSON.stringify({ requestId: event.requestId, feature: event.feature, action: event.action, outcome: "failure", errorCode: "LOG_SERIALISATION_FAILED" }));
  }
}
