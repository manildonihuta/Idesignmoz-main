export type ProviderErrorKind =
  | "authentication"
  | "authorization"
  | "validation"
  | "rate_limit"
  | "provider_unavailable"
  | "network"
  | "timeout"
  | "permanent"
  | "temporary"
  | "unknown";

export type ClassifiedError = {
  kind: ProviderErrorKind;
  /** Safe to schedule a retry (exponential backoff) when true. */
  retryable: boolean;
  /** Structural failure that will not resolve on retry (auth, config, misuse). */
  permanent: boolean;
  message: string;
};

export const PROVIDER_ERROR_KIND_LABEL: Record<ProviderErrorKind, string> = {
  authentication: "Autenticação",
  authorization: "Autorização",
  validation: "Validação",
  rate_limit: "Limite de pedidos",
  provider_unavailable: "Fornecedor indisponível",
  network: "Rede",
  timeout: "Timeout",
  permanent: "Erro permanente",
  temporary: "Erro temporário",
  unknown: "Desconhecido",
};

/** Kind → retryable truth table. Permanent classes never auto-retry. */
const RETRYABLE_KINDS: ReadonlySet<ProviderErrorKind> = new Set<ProviderErrorKind>([
  "rate_limit",
  "provider_unavailable",
  "network",
  "timeout",
  "temporary",
]);

export function isRetryableKind(kind: ProviderErrorKind): boolean {
  return RETRYABLE_KINDS.has(kind);
}

export class ProviderConnectionError extends Error {
  readonly kind: ProviderErrorKind;

  constructor(message: string, kind: ProviderErrorKind = "unknown") {
    super(message);
    this.name = "ProviderConnectionError";
    this.kind = kind;
  }
}

export class ProviderAuthenticationError extends ProviderConnectionError {
  constructor(message: string) {
    super(message, "authentication");
    this.name = "ProviderAuthenticationError";
  }
}

export class ProviderAuthorizationError extends ProviderConnectionError {
  constructor(message: string) {
    super(message, "authorization");
    this.name = "ProviderAuthorizationError";
  }
}

export class ProviderValidationError extends ProviderConnectionError {
  constructor(message: string) {
    super(message, "validation");
    this.name = "ProviderValidationError";
  }
}

export class ProviderRateLimitError extends ProviderConnectionError {
  constructor(message: string) {
    super(message, "rate_limit");
    this.name = "ProviderRateLimitError";
  }
}

export class ProviderUnavailableError extends ProviderConnectionError {
  constructor(message: string) {
    super(message, "provider_unavailable");
    this.name = "ProviderUnavailableError";
  }
}

export class ProviderTimeoutError extends ProviderConnectionError {
  constructor(message: string) {
    super(message, "timeout");
    this.name = "ProviderTimeoutError";
  }
}

/**
 * Maps any thrown value to a structured classification. HTTP status codes from
 * third-party APIs are the primary signal; network/timeout failure classes map
 * to retryable categories. Never throws.
 */
export function classifyProviderError(err: unknown): ClassifiedError {
  if (err instanceof ProviderConnectionError) {
    return {
      kind: err.kind,
      retryable: isRetryableKind(err.kind),
      permanent: !isRetryableKind(err.kind),
      message: err.message,
    };
  }

  if (err && typeof err === "object" && "status" in err) {
    const status = Number((err as { status: unknown }).status);
    let kind: ProviderErrorKind;
    if (status === 401) kind = "authentication";
    else if (status === 403) kind = "authorization";
    else if (status === 404 || status === 422) kind = "validation";
    else if (status === 429) kind = "rate_limit";
    else if (status >= 500) kind = "provider_unavailable";
    else kind = "permanent";
    const message =
      err && typeof err === "object" && "message" in err
        ? String((err as { message: unknown }).message)
        : `Erro HTTP ${status}.`;
    return { kind, retryable: isRetryableKind(kind), permanent: !isRetryableKind(kind), message };
  }

  if (err instanceof Error) {
    const name = err.name.toLowerCase();
    if (name.includes("timeout") || /abort/i.test(err.message)) {
      return { kind: "timeout", retryable: true, permanent: false, message: err.message };
    }
    if (/ECONNRESET|ENOTFOUND|EAI_AGAIN|Econnreset|fetch failed|network/i.test(err.message)) {
      return { kind: "network", retryable: true, permanent: false, message: err.message };
    }
    if (/rate.?limit|too many requests/i.test(err.message)) {
      return { kind: "rate_limit", retryable: true, permanent: false, message: err.message };
    }
    return { kind: "unknown", retryable: false, permanent: true, message: err.message };
  }

  return { kind: "unknown", retryable: false, permanent: true, message: String(err) };
}

/** Exponential backoff with jitter, capped — retries at 1m, 4m, 9m, ... */
export function computeBackoffMs(retryCount: number, baseMs = 60_000, capMs = 30 * 60_000): number {
  const exponential = baseMs * (retryCount + 1) * (retryCount + 1);
  const jitter = Math.floor(Math.random() * 0.25 * exponential);
  return Math.min(exponential + jitter, capMs);
}