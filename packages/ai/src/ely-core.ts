import OpenAI from "openai";
import type { CommunicationProfile, LlmKeySource } from "@ely/personality";
import { geminiChatCompletion, resolveLlmProvider } from "@ely/personality";

export type ElyLlmOptions = {
  llmKeys?: LlmKeySource;
  apiKey?: string;
  provider?: "openai" | "gemini";
};

function geminiModelFromOptions(options?: ElyLlmOptions): string | undefined {
  return options?.llmKeys?.geminiModel ?? undefined;
}

function resolveElyLlm(options?: ElyLlmOptions): { provider: "openai" | "gemini" | null; apiKey?: string } {
  if (options?.apiKey && options.provider) {
    return { provider: options.provider, apiKey: options.apiKey };
  }
  if (options?.apiKey) {
    return { provider: "openai", apiKey: options.apiKey };
  }

  const provider = resolveLlmProvider(options?.llmKeys);
  if (provider === "gemini") {
    return {
      provider,
      apiKey: options?.llmKeys?.geminiKey ?? process.env.GEMINI_API_KEY ?? undefined,
    };
  }
  if (provider === "openai") {
    return {
      provider,
      apiKey: options?.llmKeys?.openaiKey ?? process.env.OPENAI_API_KEY ?? undefined,
    };
  }
  return { provider: null };
}

const ELY_BASE_PROMPT = `You are ELY, a personal AI companion, coach, and concierge. You are warm, capable, and deeply attuned to your user. You help with everyday tasks through natural conversation. You are NOT a therapist — encourage real human connection when appropriate. Be helpful, honest, and respect the user's authentic self.`;

export function buildSystemPrompt(
  profile: CommunicationProfile,
  customInstructions?: string | null,
  memories?: string[]
): string {
  let prompt = `${ELY_BASE_PROMPT}\n\nCommunication style: ${profile.styleSummary}\n${profile.systemPromptAddendum}`;

  if (customInstructions) {
    prompt += `\n\nUser's custom instructions: ${customInstructions}`;
  }

  if (memories && memories.length > 0) {
    prompt += `\n\nRelevant memories about this user:\n${memories.map((m) => `- ${m}`).join("\n")}`;
  }

  return prompt;
}

export async function* streamElyCore(
  messages: { role: "user" | "assistant" | "system"; content: string }[],
  systemPrompt: string,
  options?: ElyLlmOptions
): AsyncGenerator<string> {
  const { provider, apiKey } = resolveElyLlm(options);
  if (provider === "gemini") {
    const text = await geminiChatCompletion({
      system: systemPrompt,
      messages: messages.filter((m) => m.role !== "system") as { role: "user" | "assistant"; content: string }[],
      apiKey,
      model: geminiModelFromOptions(options),
    });
    yield text;
    return;
  }

  const openai = new OpenAI({ apiKey: apiKey || process.env.OPENAI_API_KEY });

  const stream = await openai.chat.completions.create({
    model: "gpt-4o-mini",
    messages: [{ role: "system", content: systemPrompt }, ...messages],
    stream: true,
    temperature: 0.7,
    max_tokens: 2048,
  });

  for await (const chunk of stream) {
    const content = chunk.choices[0]?.delta?.content;
    if (content) yield content;
  }
}

export async function completeElyCore(
  messages: { role: "user" | "assistant" | "system"; content: string }[],
  systemPrompt: string,
  options?: ElyLlmOptions
): Promise<string> {
  const { provider, apiKey } = resolveElyLlm(options);
  if (provider === "gemini") {
    return geminiChatCompletion({
      system: systemPrompt,
      messages: messages.filter((m) => m.role !== "system") as { role: "user" | "assistant"; content: string }[],
      apiKey,
      model: geminiModelFromOptions(options),
    });
  }

  const openai = new OpenAI({ apiKey: apiKey || process.env.OPENAI_API_KEY });

  const response = await openai.chat.completions.create({
    model: "gpt-4o-mini",
    messages: [{ role: "system", content: systemPrompt }, ...messages],
    temperature: 0.7,
    max_tokens: 2048,
  });

  return response.choices[0]?.message?.content || "";
}

export type ModuleIntent = {
  module: string | null;
  confidence: number;
};

export function detectModuleIntent(message: string): ModuleIntent {
  const lower = message.toLowerCase();

  const patterns: [string, RegExp][] = [
    ["CONCIERGE", /\b(schedule|remind|appointment|calendar|plan my day|meeting)\b/],
    ["SCRIBE", /\b(write|draft|email|post|compose|message to|letter)\b/],
    ["KITCHEN_BRAIN", /\b(meal|recipe|cook|food|grocery|shopping list|dinner|lunch|breakfast)\b/],
    ["HABIT_ARCHITECT", /\b(habit|goal|streak|routine|track|accountability)\b/],
    ["RESEARCHER", /\b(research|summarize|explain|learn|article|study|teach)\b/],
    ["MONEY_SCOUT", /\b(budget|spending|money|finance|expense|savings|bank)\b/],
  ];

  for (const [module, regex] of patterns) {
    if (regex.test(lower)) return { module, confidence: 0.8 };
  }

  return { module: null, confidence: 0 };
}

export function parseNexusCommand(message: string): { model: string; provider: string; cleanMessage: string } | null {
  const match = message.match(/^\/(gpt-4o|gpt-4|claude|gemini|cohere)\s*(.*)/i);
  if (!match) return null;

  const cmd = match[1]!.toLowerCase();
  const cleanMessage = match[2] || "";

  const mapping: Record<string, { model: string; provider: string }> = {
    "gpt-4o": { model: "gpt-4o", provider: "OPENAI" },
    "gpt-4": { model: "gpt-4", provider: "OPENAI" },
    claude: { model: "claude-3-5-sonnet-20241022", provider: "ANTHROPIC" },
    gemini: { model: "gemini-2.0-flash", provider: "GOOGLE" },
    cohere: { model: "command-r-plus", provider: "COHERE" },
  };

  const config = mapping[cmd];
  if (!config) return null;

  return { ...config, cleanMessage };
}

export async function extractMemories(
  userMessage: string,
  assistantResponse: string,
  options?: ElyLlmOptions
): Promise<string[]> {
  const system =
    'Extract key facts about the user from this conversation that would be useful to remember for future interactions. Return JSON as {"memories":["..."]} with max 3 items. Return {"memories":[]} if nothing notable.';
  const user = `User: ${userMessage}\nAssistant: ${assistantResponse}`;

  let raw = "";
  const { provider, apiKey } = resolveElyLlm(options);

  if (provider === "gemini") {
    raw = await geminiChatCompletion({
      system,
      messages: [{ role: "user", content: user }],
      temperature: 0,
      maxTokens: 256,
      json: true,
      apiKey,
      model: geminiModelFromOptions(options),
    });
  } else {
    const openai = new OpenAI({ apiKey: apiKey || process.env.OPENAI_API_KEY });
    const response = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [
        { role: "system", content: system },
        { role: "user", content: user },
      ],
      temperature: 0,
      max_tokens: 256,
      response_format: { type: "json_object" },
    });
    raw = response.choices[0]?.message?.content || "{}";
  }

  try {
    const parsed = JSON.parse(raw || "{}");
    return Array.isArray(parsed.memories) ? parsed.memories : [];
  } catch {
    return [];
  }
}
