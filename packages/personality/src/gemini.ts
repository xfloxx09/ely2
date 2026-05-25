export type GeminiMessage = {
  role: "user" | "assistant";
  content: string;
};

export type LlmKeySource = {
  geminiKey?: string | null;
  openaiKey?: string | null;
  llmProvider?: string | null;
  geminiModel?: string | null;
};

export function resolveLlmProvider(source?: LlmKeySource): "openai" | "gemini" | null {
  const gemini = source?.geminiKey ?? process.env.GEMINI_API_KEY;
  const openai = source?.openaiKey ?? process.env.OPENAI_API_KEY;
  const preferred = (source?.llmProvider ?? process.env.LLM_PROVIDER)?.toLowerCase();

  if (preferred === "gemini" && gemini) return "gemini";
  if (preferred === "openai" && openai) return "openai";
  if (gemini && !openai) return "gemini";
  if (openai && !gemini) return "openai";
  if (gemini) return "gemini";
  if (openai) return "openai";
  return null;
}

/** Providers to attempt in order when the preferred one fails. */
export function resolveLlmProviderChain(source?: LlmKeySource): ("openai" | "gemini")[] {
  const gemini = source?.geminiKey ?? process.env.GEMINI_API_KEY;
  const openai = source?.openaiKey ?? process.env.OPENAI_API_KEY;
  const primary = resolveLlmProvider(source);
  const chain: ("openai" | "gemini")[] = [];

  if (primary === "gemini" && gemini) chain.push("gemini");
  if (primary === "openai" && openai) chain.push("openai");
  if (primary !== "gemini" && gemini) chain.push("gemini");
  if (primary !== "openai" && openai) chain.push("openai");

  return [...new Set(chain)];
}

export function getGeminiModel(source?: { geminiModel?: string | null }): string {
  return source?.geminiModel ?? process.env.GEMINI_MODEL ?? "gemini-2.5-flash";
}

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/** Pull a short human hint from Gemini error JSON bodies. */
export function parseGeminiErrorHint(detail: string): string | null {
  if (detail.includes("limit: 0") || detail.includes("limit\":0")) {
    return "free_tier_limit_zero";
  }
  if (/429|quota|rate limit|resource exhausted/i.test(detail)) {
    return "rate_limited";
  }
  return null;
}

async function geminiRequest(
  body: Record<string, unknown>,
  apiKey?: string,
  model?: string,
  attempt = 0
): Promise<string> {
  const key = apiKey || process.env.GEMINI_API_KEY;
  if (!key) throw new Error("GEMINI_API_KEY not configured");

  const resolvedModel = model || getGeminiModel();
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${resolvedModel}:generateContent?key=${key}`;

  const response = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });

  if (!response.ok) {
    const detail = await response.text();
    if (response.status === 429 && attempt < 3) {
      const waitMs = Math.min(1500 * 2 ** attempt, 12000);
      await sleep(waitMs);
      return geminiRequest(body, apiKey, model, attempt + 1);
    }

    const hint = parseGeminiErrorHint(detail);
    if (hint === "free_tier_limit_zero") {
      throw new Error(
        `Gemini free tier not active for model ${resolvedModel} (limit: 0). In Admin set model to gemini-2.5-flash, create the key at aistudio.google.com/apikey, and link billing on the Google Cloud project (free tier still applies). Raw: ${detail.slice(0, 180)}`
      );
    }

    throw new Error(`Gemini API error (${response.status}): ${detail.slice(0, 300)}`);
  }

  const data = (await response.json()) as {
    candidates?: { content?: { parts?: { text?: string }[] } }[];
  };

  return data.candidates?.[0]?.content?.parts?.[0]?.text?.trim() || "";
}

export async function geminiGenerateText(options: {
  system?: string;
  prompt: string;
  temperature?: number;
  maxTokens?: number;
  json?: boolean;
  apiKey?: string;
  model?: string;
}): Promise<string> {
  return geminiRequest(
    {
      ...(options.system
        ? { systemInstruction: { parts: [{ text: options.system }] } }
        : {}),
      contents: [{ role: "user", parts: [{ text: options.prompt }] }],
      generationConfig: {
        temperature: options.temperature ?? 0.7,
        maxOutputTokens: options.maxTokens ?? 2048,
        ...(options.json ? { responseMimeType: "application/json" } : {}),
      },
    },
    options.apiKey,
    options.model
  );
}

export async function geminiChatCompletion(options: {
  system: string;
  messages: GeminiMessage[];
  temperature?: number;
  maxTokens?: number;
  json?: boolean;
  apiKey?: string;
  model?: string;
}): Promise<string> {
  const contents = options.messages.map((message) => ({
    role: message.role === "assistant" ? "model" : "user",
    parts: [{ text: message.content }],
  }));

  return geminiRequest(
    {
      systemInstruction: { parts: [{ text: options.system }] },
      contents,
      generationConfig: {
        temperature: options.temperature ?? 0.7,
        maxOutputTokens: options.maxTokens ?? 2048,
        ...(options.json ? { responseMimeType: "application/json" } : {}),
      },
    },
    options.apiKey,
    options.model
  );
}
