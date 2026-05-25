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
  if (openai) return "openai";
  if (gemini) return "gemini";
  return null;
}

export function getGeminiModel(source?: { geminiModel?: string | null }): string {
  return source?.geminiModel ?? process.env.GEMINI_MODEL ?? "gemini-2.0-flash";
}

async function geminiRequest(body: Record<string, unknown>, apiKey?: string, model?: string): Promise<string> {
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
