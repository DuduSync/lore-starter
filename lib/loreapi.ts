export const LOREAPI_BASE =
  process.env.NEXT_PUBLIC_LOREAPI_BASE ?? "https://loreapi.online/v1";

export type ChatRole = "system" | "user" | "assistant";

export interface ChatMessage {
  role: ChatRole;
  content: string;
}

export interface AccountInfo {
  credits?: number;
  balance_usd?: number;
  user?: { id?: number; name?: string; email?: string };
  limits?: { weekly_usd?: number; monthly_usd?: number; context_tokens?: number };
  usage?: {
    week_usd?: number;
    month_usd?: number;
    total_usd?: number;
    requests?: number;
  };
  key?: { model?: string; context_tokens?: number };
}

export class LoreApiError extends Error {
  status: number;

  constructor(status: number, message: string) {
    super(message);
    this.status = status;
  }
}

async function readErrorMessage(res: Response): Promise<string> {
  try {
    const data = await res.json();
    return data?.error?.message ?? JSON.stringify(data);
  } catch {
    return `HTTP ${res.status}`;
  }
}

export async function fetchAccount(key: string): Promise<AccountInfo> {
  const res = await fetch(`${LOREAPI_BASE}/account`, {
    headers: { Authorization: `Bearer ${key}` },
  });
  if (!res.ok) throw new LoreApiError(res.status, await readErrorMessage(res));
  return res.json();
}

export async function fetchModel(key: string): Promise<string> {
  const res = await fetch(`${LOREAPI_BASE}/models`, {
    headers: { Authorization: `Bearer ${key}` },
  });
  if (!res.ok) throw new LoreApiError(res.status, await readErrorMessage(res));
  const data = await res.json();
  return data?.data?.[0]?.id ?? "loreapi-rp";
}

export async function* streamChat(
  key: string,
  model: string,
  messages: ChatMessage[],
  signal?: AbortSignal,
): AsyncGenerator<string> {
  const res = await fetch(`${LOREAPI_BASE}/chat/completions`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${key}`,
    },
    body: JSON.stringify({ model, messages, stream: true }),
    signal,
  });

  if (!res.ok || !res.body) {
    throw new LoreApiError(res.status, await readErrorMessage(res));
  }

  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });

    const lines = buffer.split("\n");
    buffer = lines.pop() ?? "";

    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed.startsWith("data:")) continue;
      const payload = trimmed.slice(5).trim();
      if (payload === "[DONE]") return;
      try {
        const json = JSON.parse(payload);
        const delta: string | undefined = json?.choices?.[0]?.delta?.content;
        if (delta) yield delta;
      } catch {
        // partial line, keep buffering
      }
    }
  }
}
