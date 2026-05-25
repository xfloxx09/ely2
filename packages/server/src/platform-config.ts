import { eq } from "drizzle-orm";
import { getDb, platformSettings, ensurePlatformSettingsTable } from "@ely/db";
import { encryptApiKey, decryptApiKey } from "@ely/ai";
import { resolveLlmProvider, type LlmKeySource } from "@ely/personality";

export type PlatformConfig = {
  llmProvider: string | null;
  geminiModel: string | null;
  geminiApiKey: string | null;
  openaiApiKey: string | null;
  replicateApiToken: string | null;
};

const SECRET_KEYS = new Set(["GEMINI_API_KEY", "OPENAI_API_KEY", "REPLICATE_API_TOKEN"]);
const CACHE_TTL_MS = 30_000;

let cache: { config: PlatformConfig; expires: number } | null = null;

function envFallback(): PlatformConfig {
  return {
    llmProvider: process.env.LLM_PROVIDER || null,
    geminiModel: process.env.GEMINI_MODEL || null,
    geminiApiKey: process.env.GEMINI_API_KEY || null,
    openaiApiKey: process.env.OPENAI_API_KEY || null,
    replicateApiToken: process.env.REPLICATE_API_TOKEN || null,
  };
}

function mergeConfig(dbValues: Record<string, string>): PlatformConfig {
  const env = envFallback();
  return {
    llmProvider: dbValues.LLM_PROVIDER ?? env.llmProvider,
    geminiModel: dbValues.GEMINI_MODEL ?? env.geminiModel,
    geminiApiKey: dbValues.GEMINI_API_KEY ?? env.geminiApiKey,
    openaiApiKey: dbValues.OPENAI_API_KEY ?? env.openaiApiKey,
    replicateApiToken: dbValues.REPLICATE_API_TOKEN ?? env.replicateApiToken,
  };
}

export function clearPlatformConfigCache() {
  cache = null;
}

export async function getPlatformConfig(): Promise<PlatformConfig> {
  if (cache && cache.expires > Date.now()) {
    return cache.config;
  }

  try {
    await ensurePlatformSettingsTable();
    const db = getDb();
    const rows = await db.select().from(platformSettings);
    const dbValues: Record<string, string> = {};

    for (const row of rows) {
      dbValues[row.key] = row.isSecret ? decryptApiKey(row.value) : row.value;
    }

    const config = mergeConfig(dbValues);
    cache = { config, expires: Date.now() + CACHE_TTL_MS };
    return config;
  } catch {
    const config = envFallback();
    cache = { config, expires: Date.now() + CACHE_TTL_MS };
    return config;
  }
}

export function toLlmKeySource(config: PlatformConfig): LlmKeySource {
  return {
    geminiKey: config.geminiApiKey,
    openaiKey: config.openaiApiKey,
    llmProvider: config.llmProvider,
    geminiModel: config.geminiModel,
  };
}

export async function getActiveLlmProvider(): Promise<"openai" | "gemini" | null> {
  const config = await getPlatformConfig();
  return resolveLlmProvider(toLlmKeySource(config));
}

export function maskSecret(value: string): string {
  if (value.length <= 8) return "••••••••";
  return `${value.slice(0, 4)}…${value.slice(-4)}`;
}

export type AdminPlatformSettingsView = {
  llmProvider: string;
  geminiModel: string;
  activeProvider: "openai" | "gemini" | null;
  secrets: Record<
    string,
    {
      configured: boolean;
      preview: string | null;
      source: "database" | "environment" | null;
    }
  >;
};

export async function getAdminPlatformSettings(): Promise<AdminPlatformSettingsView> {
  await ensurePlatformSettingsTable();
  const db = getDb();
  const rows = await db.select().from(platformSettings);
  const dbMap = new Map(rows.map((r) => [r.key, r]));

  const env = envFallback();
  const config = await getPlatformConfig();
  const activeProvider = resolveLlmProvider(toLlmKeySource(config));

  const secretMeta = (
    configVal: string | null,
    dbKey: string,
    envVal: string | null
  ) => {
    const inDb = dbMap.get(dbKey);
    const configured = !!configVal;
    let preview: string | null = null;
    let source: "database" | "environment" | null = null;

    if (inDb?.isSecret) {
      preview = maskSecret(decryptApiKey(inDb.value));
      source = "database";
    } else if (envVal) {
      preview = maskSecret(envVal);
      source = "environment";
    }

    return { configured, preview, source };
  };

  return {
    llmProvider: config.llmProvider || "gemini",
    geminiModel: config.geminiModel || "gemini-2.5-flash",
    activeProvider,
    secrets: {
      GEMINI_API_KEY: secretMeta(config.geminiApiKey, "GEMINI_API_KEY", env.geminiApiKey),
      OPENAI_API_KEY: secretMeta(config.openaiApiKey, "OPENAI_API_KEY", env.openaiApiKey),
      REPLICATE_API_TOKEN: secretMeta(config.replicateApiToken, "REPLICATE_API_TOKEN", env.replicateApiToken),
    },
  };
}

export async function updateAdminPlatformSettings(
  adminUserId: string,
  input: {
    llmProvider?: string;
    geminiModel?: string;
    geminiApiKey?: string;
    openaiApiKey?: string;
    replicateApiToken?: string;
    clearKeys?: string[];
  }
) {
  await ensurePlatformSettingsTable();
  const db = getDb();

  async function upsert(key: string, value: string, isSecret: boolean) {
    await db
      .insert(platformSettings)
      .values({
        key,
        value: isSecret ? encryptApiKey(value) : value,
        isSecret,
        updatedById: adminUserId,
        updatedAt: new Date(),
      })
      .onConflictDoUpdate({
        target: platformSettings.key,
        set: {
          value: isSecret ? encryptApiKey(value) : value,
          isSecret,
          updatedById: adminUserId,
          updatedAt: new Date(),
        },
      });
  }

  async function remove(key: string) {
    await db.delete(platformSettings).where(eq(platformSettings.key, key));
  }

  if (input.llmProvider !== undefined) {
    await upsert("LLM_PROVIDER", input.llmProvider, false);
  }
  if (input.geminiModel !== undefined) {
    await upsert("GEMINI_MODEL", input.geminiModel, false);
  }

  const secretUpdates: [string, string | undefined][] = [
    ["GEMINI_API_KEY", input.geminiApiKey],
    ["OPENAI_API_KEY", input.openaiApiKey],
    ["REPLICATE_API_TOKEN", input.replicateApiToken],
  ];

  for (const [key, val] of secretUpdates) {
    if (val === undefined) continue;
    if (val.trim() === "") {
      await remove(key);
    } else {
      await upsert(key, val.trim(), true);
    }
  }

  if (input.clearKeys?.length) {
    for (const key of input.clearKeys) {
      if (SECRET_KEYS.has(key) || key === "LLM_PROVIDER" || key === "GEMINI_MODEL") {
        await remove(key);
      }
    }
  }

  clearPlatformConfigCache();
  return getAdminPlatformSettings();
}
