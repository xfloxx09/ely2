import { createCipheriv, createDecipheriv, randomBytes, scryptSync } from "crypto";
import OpenAI from "openai";
import Anthropic from "@anthropic-ai/sdk";
import type { CommunicationProfile } from "@ely/personality";
import { buildSystemPrompt } from "./ely-core.js";

function getKey(): Buffer {
  const secret = process.env.API_KEY_ENCRYPTION_KEY || "dev-api-key-change-in-prod-32b";
  return scryptSync(secret, "ely-api-salt", 32);
}

export function encryptApiKey(key: string): string {
  const encKey = getKey();
  const iv = randomBytes(16);
  const cipher = createCipheriv("aes-256-gcm", encKey, iv);
  const encrypted = Buffer.concat([cipher.update(key, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  return Buffer.concat([iv, tag, encrypted]).toString("base64");
}

export function decryptApiKey(encrypted: string): string {
  const encKey = getKey();
  const buf = Buffer.from(encrypted, "base64");
  const iv = buf.subarray(0, 16);
  const tag = buf.subarray(16, 32);
  const data = buf.subarray(32);
  const decipher = createDecipheriv("aes-256-gcm", encKey, iv);
  decipher.setAuthTag(tag);
  return Buffer.concat([decipher.update(data), decipher.final()]).toString("utf8");
}

export async function callNexusModel(
  provider: string,
  model: string,
  messages: { role: string; content: string }[],
  profile: CommunicationProfile,
  apiKey: string
): Promise<string> {
  const systemPrompt = buildSystemPrompt(profile);

  switch (provider) {
    case "OPENAI": {
      const openai = new OpenAI({ apiKey });
      const response = await openai.chat.completions.create({
        model,
        messages: [{ role: "system", content: systemPrompt }, ...messages.map((m) => ({ role: m.role as "user" | "assistant", content: m.content }))],
        max_tokens: 4096,
      });
      return response.choices[0]?.message?.content || "";
    }
    case "ANTHROPIC": {
      const anthropic = new Anthropic({ apiKey });
      const response = await anthropic.messages.create({
        model,
        max_tokens: 4096,
        system: systemPrompt,
        messages: messages.filter((m) => m.role !== "system").map((m) => ({
          role: m.role as "user" | "assistant",
          content: m.content,
        })),
      });
      const block = response.content[0];
      return block?.type === "text" ? block.text : "";
    }
    default:
      throw new Error(`Provider ${provider} not yet supported`);
  }
}

export async function* streamNexusModel(
  provider: string,
  model: string,
  messages: { role: string; content: string }[],
  profile: CommunicationProfile,
  apiKey: string
): AsyncGenerator<string> {
  if (provider === "OPENAI") {
    const openai = new OpenAI({ apiKey });
    const systemPrompt = buildSystemPrompt(profile);
    const stream = await openai.chat.completions.create({
      model,
      messages: [{ role: "system", content: systemPrompt }, ...messages.map((m) => ({ role: m.role as "user" | "assistant", content: m.content }))],
      stream: true,
      max_tokens: 4096,
    });
    for await (const chunk of stream) {
      const content = chunk.choices[0]?.delta?.content;
      if (content) yield content;
    }
  } else {
    const result = await callNexusModel(provider, model, messages, profile, apiKey);
    yield result;
  }
}
