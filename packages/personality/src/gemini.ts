export type GeminiMessage = {
  role: "user" | "assistant";
  content: string;
};

export function resolveLlmProvider(): "openai" | "gemini" | null {
  const preferred = process.env.LLM_PROVIDER?.toLowerCase();
  if (preferred === "gemini" && process.env.GEMINI_API_KEY) return "gemini";
  if (preferred === "openai" && process.env.OPENAI_API_KEY) return "openai";
  if (process.env.GEMINI_API_KEY && !process.env.OPENAI_API_KEY) return "gemini";
  if (process.env.OPENAI_API_KEY) return "openai";
  if (process.env.GEMINI_API_KEY) return "gemini";
  return null;
}

export function getGeminiModel(): string {
  return process.env.GEMINI_MODEL || "gemini-2.0-flash";
}

async function geminiRequest(body: Record<string, unknown>, apiKey?: string): Promise<string> {
  const key = apiKey || process.env.GEMINI_API_KEY;
  if (!key) throw new Error("GEMINI_API_KEY not configured");

  const model = getGeminiModel();
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${key}`;

  const response = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });

  if (!response.ok) {
    const detail = await response.text();
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
    options.apiKey
  );
}

export async function geminiChatCompletion(options: {
  system: string;
  messages: GeminiMessage[];
  temperature?: number;
  maxTokens?: number;
  json?: boolean;
  apiKey?: string;
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
    options.apiKey
  );
}
