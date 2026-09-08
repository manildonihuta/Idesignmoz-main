import "server-only";

export type AiErrorCode = "not_configured" | "timeout" | "http" | "invalid_response";

export class AiError extends Error {
  code: AiErrorCode;
  status?: number;
  constructor(code: AiErrorCode, message: string, status?: number) {
    super(message);
    this.name = "AiError";
    this.code = code;
    this.status = status;
  }
}

/** True when an OpenAI-compatible provider is configured via env. */
export function isAiConfigured(): boolean {
  return Boolean(process.env.AI_API_KEY);
}

type AiConfig = {
  baseUrl: string;
  model: string;
  apiKey: string;
  timeoutMs: number;
};

function aiConfig(): AiConfig {
  const apiKey = process.env.AI_API_KEY ?? "";
  if (!apiKey) {
    throw new AiError("not_configured", "Provider de IA não configurado (AI_API_KEY).");
  }
  const timeoutMs = Number(process.env.AI_TIMEOUT_MS ?? 120_000);
  return {
    baseUrl: (process.env.AI_BASE_URL ?? "https://api.openai.com/v1").replace(/\/+$/, ""),
    model: process.env.AI_MODEL ?? "gpt-4o-mini",
    apiKey,
    timeoutMs: Number.isFinite(timeoutMs) && timeoutMs > 0 ? timeoutMs : 120_000,
  };
}

export type ChatJsonInput = {
  system: string;
  user: string;
  temperature?: number;
  maxTokens?: number;
};

/**
 * Calls an OpenAI-compatible `/chat/completions` endpoint requesting strict
 * JSON output (OpenAI, DeepSeek, Groq, OpenRouter, Ollama, Azure via an
 * OpenAI-compatible base URL…). Never runs on the client (server-only).
 */
export async function chatJson<T>(input: ChatJsonInput): Promise<T> {
  const config = aiConfig();
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), config.timeoutMs);

  let response: Response;
  try {
    response = await fetch(`${config.baseUrl}/chat/completions`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${config.apiKey}`,
      },
      body: JSON.stringify({
        model: config.model,
        temperature: input.temperature ?? 0.6,
        max_tokens: input.maxTokens ?? 6000,
        messages: [
          { role: "system", content: input.system },
          { role: "user", content: input.user },
        ],
        response_format: { type: "json_object" },
      }),
      signal: controller.signal,
    });
  } catch {
    throw new AiError(
      controller.signal.aborted ? "timeout" : "http",
      controller.signal.aborted ? "O provedor de IA demorou a responder." : "Falha de rede no provedor de IA.",
    );
  } finally {
    clearTimeout(timer);
  }

  if (!response.ok) {
    await response.text().catch(() => "");
    throw new AiError("http", `O provedor de IA respondeu com erro ${response.status}.`, response.status);
  }

  const body = (await response.json()) as {
    choices?: Array<{ message?: { content?: string } }>;
  };
  const content = body.choices?.[0]?.message?.content;
  if (!content) {
    throw new AiError("invalid_response", "O provedor de IA não devolveu conteúdo.");
  }
  try {
    return JSON.parse(content) as T;
  } catch {
    throw new AiError("invalid_response", "A resposta do provedor de IA não é JSON válido.");
  }
}