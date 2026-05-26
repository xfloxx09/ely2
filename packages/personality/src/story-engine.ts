import type { BFIQuestion } from "./bfi2.js";
import { BFI2_SHORT } from "./bfi2.js";
import { geminiGenerateText, geminiChatCompletion, resolveLlmProviderChain, type LlmKeySource, type GeminiMessage } from "./gemini.js";
import {
  parseStoryResponse,
} from "./story-json-parse.js";
import {
  WORLD_GEN_SYSTEM_PROMPT,
  buildWorldGenPrompt,
  buildMinimalWorldFallback,
  parseWorldResponse,
  storyEntropy,
  type StoryWorldDraft,
} from "./story-engine-world-gen.js";

export type StoryChoice = {
  label: string;
  value: number;
};

export type StoryBeat = {
  id: number;
  bfiId: number;
  trait: string;
  chapter: number;
  chapterTitle: string;
  narrative: string;
  question: string;
  choices: StoryChoice[];
  scenePrompt: string;
};

export type StoryWorldContext = {
  framing: string;
  timeline: string;
  place: string;
  yourRole: string;
  mood: string;
};

export type StoryJourney = {
  title: string;
  prologue: string;
  heroName: string;
  setting: string;
  worldContext: StoryWorldContext;
  beats: StoryBeat[];
  _debug?: StoryGenerationDebug;
};

export type StoryGenerationDebug = {
  storySource: "gemini" | "openai" | "fallback";
  storyModel?: string;
  providerResolved?: "gemini" | "openai" | null;
  storyFailureReason?: string;
  storyPartialFill?: boolean;
  storyWarnings?: string[];
  storySeed?: string;
  storyPremise?: string;
};

export type StoryGenerationOptions = {
  storySeed?: string;
};

export const STORY_REROLL_LIMITS = {
  FREE: 1,
  PLUS: 3,
  PRO: 10,
} as const;

export type StoryTier = keyof typeof STORY_REROLL_LIMITS;

export function storyRerollLimitForTier(tier: string | undefined | null): number {
  if (tier === "PRO") return STORY_REROLL_LIMITS.PRO;
  if (tier === "PLUS") return STORY_REROLL_LIMITS.PLUS;
  return STORY_REROLL_LIMITS.FREE;
}

export function createStorySeed(): string {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID();
  }
  return `${Date.now()}-${Math.random().toString(36).slice(2, 12)}`;
}

const TRAIT_THEMES: Record<string, string> = {
  extraversion: "social energy, speaking up, crowds vs solitude, leading vs listening",
  agreeableness: "empathy, conflict, trust, forgiveness, helping strangers",
  conscientiousness: "order vs chaos, duty, planning, reliability, temptation to slack",
  neuroticism: "stress, mood swings, worry, resilience after setbacks, calm under pressure",
  openness: "curiosity, art, imagination, abstract ideas, tradition vs novelty",
};

const CHAPTER_TITLES = [
  "Opening",
  "Rising",
  "Turn",
  "Depths",
  "Crossroads",
  "Reckoning",
  "Trial",
  "Drift",
  "Storm",
  "Threshold",
];

function personalityBeatHints(start: number, end: number) {
  return BFI2_SHORT.slice(start, end).map((q, i) => ({
    beat: start + i + 1,
    bfiId: q.id,
    trait: q.trait,
    theme: TRAIT_THEMES[q.trait] ?? q.trait,
  }));
}

/** Story-flavored answers that still map to standard BFI raw scores (1–5 = agree with statement). */
export function contextualStoryChoices(
  question: BFIQuestion,
  hero: string,
  variantIndex: number
): StoryChoice[] {
  const v = variantIndex % 2;
  const h = hero;

  type FiveLabels = [string, string, string, string, string];
  const pack = (labels: FiveLabels): StoryChoice[] =>
    labels.map((label, i) => ({ label, value: 5 - i }));

  const banks: Record<
    string,
    { forward: FiveLabels[]; reverse: FiveLabels[] }
  > = {
    extraversion: {
      forward: [
        [
          `${h} steps into the center — the room feels like home`,
          "More often than not, I seek the pulse of the gathering",
          "Some evenings I shine, others I need the quiet edge",
          "I usually watch from the sidelines and listen first",
          "Crowds drain me — I keep my fire for smaller circles",
        ],
        [
          "My spirit lifts the moment voices rise around me",
          "I tend to join in and let the moment carry me",
          "It depends — I can be social or perfectly still",
          "I prefer listening to leading the room",
          "Solitude restores me more than company does",
        ],
      ],
      reverse: [
        [
          "Yes — silence is my truest language",
          "I'm usually the quiet one in any room",
          "I speak when it counts, otherwise I stay still",
          "People are surprised by how loud I can be",
          "Quiet isn't me — I naturally fill the space",
        ],
        [
          "Stillness suits me better than the spotlight",
          "I often hold back and let others take the stage",
          "I'm social in bursts, not by default",
          "I find myself talking more than I planned to",
          "The idea of being 'the quiet one' doesn't fit me at all",
        ],
      ],
    },
    agreeableness: {
      forward: [
        [
          "My heart moves first — I soften every fall I see",
          "I usually extend warmth before judgment",
          "I try to be kind, though I have my limits",
          "I care, but I don't always show it quickly",
          "I protect my boundaries — sympathy isn't automatic",
        ],
        [
          "Helping others feels like the obvious choice",
          "I'm gentle with people more often than not",
          "I'm fair — sometimes soft, sometimes firm",
          "I can be distant until someone earns my trust",
          "I don't easily melt for every stranger's pain",
        ],
      ],
      reverse: [
        [
          "I can be sharp — fault-finding comes naturally",
          "I notice flaws in people before their gifts",
          "I'm balanced — not harsh, not endlessly soft",
          "I usually give people the benefit of the doubt",
          "Finding fault in others isn't who I am",
        ],
        [
          "Conflict doesn't frighten me — I say the hard thing",
          "I stand my ground even when it ruffles feathers",
          "I pick my battles, but I don't always yield",
          "I'd rather harmonize than pick a fight",
          "Starting arguments is the opposite of my nature",
        ],
      ],
    },
    conscientiousness: {
      forward: [
        [
          "Every step is planned — order is my compass",
          "I like a map, a list, a clear next move",
          "I'm organized when it matters, loose when it doesn't",
          "Structure helps, but I don't need it for everything",
          "Plans feel like cages — I trust improvisation",
        ],
        [
          "Reliability is simply who I am on the road",
          "I follow through more often than I drift",
          "I'm steady, though not rigid about every detail",
          "Deadlines slip sometimes — I'm human",
          "Discipline and I are occasional acquaintances",
        ],
      ],
      reverse: [
        [
          "Mess and I are old companions — yes, that's me",
          "I leave things half-done more than I'd admit",
          "I'm organized in some corners, chaotic in others",
          "I usually tidy up and finish what I start",
          "Disorganized doesn't describe me at all",
        ],
        [
          "I drift — structure rarely sticks for long",
          "Lazy moments win more often than I wish",
          "I work in waves, not steady lines",
          "I'm more dependable than people expect",
          "Calling me lazy would be completely wrong",
        ],
      ],
    },
    neuroticism: {
      forward: [
        [
          "The storm inside me is familiar — worry runs deep",
          "I feel tides of mood and tension often",
          "Stress visits, but I don't always surrender to it",
          "I usually find calm after the first surge",
          "Setbacks rarely shake me — I recover quickly",
        ],
        [
          "Anxiety hums beneath my skin most days",
          "I tense up when the ground shifts unexpectedly",
          "I'm sensitive, but not ruled by every fear",
          "Pressure comes and goes without owning me",
          "I'm steady inside — turmoil is rare",
        ],
      ],
      reverse: [
        [
          "Setbacks flatten me — optimism takes time to return",
          "I struggle to bounce back when things go wrong",
          "I recover, but not without a bruise to my spirit",
          "I usually rise again with reasonable speed",
          "Optimism after failure is simply how I'm built",
        ],
        [
          "Calm is my baseline, even when skies darken",
          "Tension rarely takes the wheel for long",
          "I'm composed most days, shaken on others",
          "I feel stress more than I show it",
          "Calling me tense would miss who I really am",
        ],
      ],
    },
    openness: {
      forward: [
        [
          "Wonder pulls me forward — the strange is welcome",
          "I chase new ideas, art, and unfamiliar paths",
          "I'm curious, though I still love what's known",
          "Novelty intrigues me in small doses",
          "The familiar ground feels safer than the unknown",
        ],
        [
          "Invention lives in me — I reimagine everything",
          "I lean into creativity and complex ideas",
          "I'm open-minded, but not endlessly restless",
          "I appreciate depth, yet prefer practical ground",
          "Routine and simplicity suit me better than novelty",
        ],
      ],
      reverse: [
        [
          "Art and abstraction barely whisper to me",
          "I rarely wander into imaginative territory",
          "Beauty matters, but I don't live for abstract art",
          "I enjoy creative things more than I expect to",
          "Few artistic interests? That couldn't be less true",
        ],
        [
          "The practical world holds my attention, not poetry",
          "I don't often lose myself in artistic daydreams",
          "I'm curious about some creative things, not all",
          "Unexpected ideas often catch my interest",
          "Saying I'm uninterested in art misses who I am",
        ],
      ],
    },
  };

  const traitBank = banks[question.trait] || banks.openness!;
  const set = question.reverseScored ? traitBank.reverse : traitBank.forward;
  return pack(set[v]!);
}

function normalizeWorldContext(
  raw: Partial<StoryWorldContext> | undefined,
  hero: string,
  setting: string
): StoryWorldContext {
  return {
    framing: raw?.framing?.trim() || "A fictional fable — symbolic and immersive, not literal history",
    timeline: raw?.timeline?.trim() || "Modern era — present day, over a few continuous days",
    place: raw?.place?.trim() || setting,
    yourRole:
      raw?.yourRole?.trim() ||
      `You are ${hero}, the protagonist. Read each moment as if you are living it and choose what you would do.`,
    mood: raw?.mood?.trim() || "Reflective, wonder-filled, grounded",
  };
}

function parseWorldContext(parsed: Record<string, unknown>, hero: string, setting: string): StoryWorldContext {
  const nested = parsed.worldContext as Partial<StoryWorldContext> | undefined;
  if (nested && typeof nested === "object") {
    return normalizeWorldContext(nested, hero, setting);
  }
  return normalizeWorldContext(
    {
      framing: typeof parsed.framing === "string" ? parsed.framing : undefined,
      timeline: typeof parsed.timeline === "string" ? parsed.timeline : undefined,
      place: typeof parsed.place === "string" ? parsed.place : undefined,
      yourRole: typeof parsed.yourRole === "string" ? parsed.yourRole : undefined,
      mood: typeof parsed.mood === "string" ? parsed.mood : undefined,
    },
    hero,
    setting
  );
}

export function buildFallbackStory(
  userId: string,
  userName?: string,
  storySeed?: string
): StoryJourney {
  const seedKey = storySeed || userId;
  const hero = userName?.split(" ")[0] || "You";
  const world = buildMinimalWorldFallback(hero, seedKey);

  const beats: StoryBeat[] = BFI2_SHORT.map((_, i) =>
    buildTraitFallbackBeat(i, hero, world.setting, world.premise)
  );

  return {
    title: world.title,
    prologue: world.prologue,
    heroName: hero,
    setting: world.setting,
    worldContext: world.worldContext,
    beats,
  };
}

const STORY_BATCH_SYSTEM_PROMPT = `You write story BEATS for an interactive personality journey. Return compact JSON only.

The story world (title, era, place, premise) is ALREADY defined — do not change it.
Return ONLY a single JSON object: {"beats":[...]} — no markdown, no commentary after the JSON.

Keep each beat compact: narrative one short sentence, scenePrompt under 12 words, choice labels under 10 words.
Each beat: id, bfiId, trait, chapter, chapterTitle, narrative, question, choices (5 label+value), scenePrompt.
Choice values 5,4,3,2,1 once each. Never mention Big Five or psychology.`;

function scenePromptFromBeat(setting: string, chapter: number, narrative: string): string {
  const detail = narrative.slice(0, 100).replace(/["']/g, "");
  return `${setting}, ${detail}, chapter ${chapter}, pencil sketch, graphite on paper, no text`;
}

function buildTraitFallbackBeat(
  globalIndex: number,
  hero: string,
  setting: string,
  premise: string
): StoryBeat {
  const q = BFI2_SHORT[globalIndex]!;
  const chapter = Math.floor(globalIndex / 3) + 1;
  const theme = TRAIT_THEMES[q.trait] ?? q.trait;
  return {
    id: globalIndex + 1,
    bfiId: q.id,
    trait: q.trait,
    chapter,
    chapterTitle: CHAPTER_TITLES[chapter - 1] || `Chapter ${chapter}`,
    narrative: `Within "${premise.slice(0, 70)}…", ${hero} faces a moment shaped by ${theme}.`,
    question: `Standing in this situation, what would ${hero} do?`,
    choices: contextualStoryChoices(q, hero, globalIndex),
    scenePrompt: scenePromptFromBeat(setting, chapter, premise),
  };
}

const STORY_BATCH_SIZE = 5;
const STORY_BATCH_COUNT = 6;

type ChatTurn = { role: "user" | "assistant"; content: string };

function parseStoryJson(raw: string): Partial<StoryJourney> & { beats?: StoryBeat[]; jsonRecovered?: boolean } {
  const { beats, recovered } = parseStoryResponse(raw);
  return { beats: beats as StoryBeat[], jsonRecovered: recovered };
}

function compactBeatsForHistory(beats: StoryBeat[]): { id: number; bfiId: number; narrative: string }[] {
  return beats.slice(0, STORY_BATCH_SIZE).map((beat) => ({
    id: beat.id,
    bfiId: beat.bfiId,
    narrative: beat.narrative.slice(0, 100),
  }));
}

async function fetchAndParseStoryBatch(options: {
  provider: "gemini" | "openai";
  systemPrompt: string;
  prompt: string;
  llmKeys: LlmKeySource | undefined;
  batch: number;
  chatHistory: ChatTurn[];
}): Promise<{ parsed: ReturnType<typeof parseStoryJson>; raw: string }> {
  const { provider, systemPrompt, prompt, llmKeys, batch, chatHistory } = options;
  const retryHint =
    "\n\nReturn ONLY valid compact JSON: {\"beats\":[...]} — no markdown, no text before or after the object.";

  for (let parseAttempt = 0; parseAttempt < 2; parseAttempt++) {
    const effectivePrompt = parseAttempt === 0 ? prompt : prompt + retryHint;
    const raw =
      batch === 0
        ? await fetchStoryBatchSingle(provider, systemPrompt, effectivePrompt, llmKeys, batch)
        : await fetchStoryBatchChat(
            provider,
            systemPrompt,
            chatHistory.slice(-2),
            effectivePrompt,
            llmKeys,
            batch
          );

    try {
      const parsed = parseStoryJson(raw);
      return { parsed, raw };
    } catch (err) {
      if (parseAttempt === 1) throw err;
    }
  }

  throw new Error(`Batch ${batch + 1} parse failed`);
}

async function generateStoryWorld(
  provider: "gemini" | "openai",
  hero: string,
  storySeed: string,
  llmKeys: LlmKeySource | undefined
): Promise<{ draft: StoryWorldDraft; worldRecovered: boolean; worldWarnings: string[] }> {
  const prompt = buildWorldGenPrompt(hero, storySeed);
  const worldWarnings: string[] = [];

  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      const temperature = 1 + attempt * 0.05;
      const retryHint =
        attempt > 0
          ? "\n\nYour last response was invalid or truncated. Return minimal compact JSON only — short strings, complete the object."
          : "";
      const raw =
        provider === "gemini"
          ? await geminiGenerateText({
              system: WORLD_GEN_SYSTEM_PROMPT,
              prompt: prompt + retryHint,
              temperature,
              maxTokens: 8192,
              json: true,
              apiKey: llmKeys?.geminiKey ?? undefined,
              model: llmKeys?.geminiModel ?? undefined,
            })
          : await callStoryLlmOpenAi(WORLD_GEN_SYSTEM_PROMPT, prompt + retryHint, llmKeys, temperature);

      const { draft, recovered } = parseWorldResponse(raw, hero);
      if (draft) {
        if (recovered) {
          worldWarnings.push("World JSON was truncated or malformed; recovered partial fields");
        }
        return { draft, worldRecovered: recovered, worldWarnings };
      }
      worldWarnings.push(`World attempt ${attempt + 1}: JSON missing usable title/prologue`);
    } catch (err) {
      worldWarnings.push(
        `World attempt ${attempt + 1}: ${err instanceof Error ? err.message : String(err)}`
      );
    }
  }

  worldWarnings.push("World generation failed after retries; using minimal shell");
  return {
    draft: buildMinimalWorldFallback(hero, storySeed),
    worldRecovered: false,
    worldWarnings,
  };
}

type StoryBatchMeta = {
  title: string;
  prologue: string;
  heroName: string;
  setting: string;
  premise: string;
  worldContext: StoryWorldContext;
};

function metaFromWorldDraft(world: StoryWorldDraft, hero: string): StoryBatchMeta {
  return {
    title: world.title,
    prologue: world.prologue,
    heroName: hero,
    setting: world.setting,
    premise: world.premise,
    worldContext: world.worldContext,
  };
}

const FORBIDDEN_STORY_PATTERNS =
  /blank map|mirror pool|lantern quest|mystical journey|traveler collaps|festival has begun|glowing map|continuous story journey/i;

function isUsableLlmBeat(candidate: StoryBeat | undefined): candidate is StoryBeat {
  if (!candidate?.narrative || candidate.narrative.length < 12) return false;
  if (FORBIDDEN_STORY_PATTERNS.test(candidate.narrative)) return false;
  return true;
}

function mergeBatchBeats(
  start: number,
  llmBeats: StoryBeat[],
  hero: string,
  setting: string,
  premise: string
): { beats: StoryBeat[]; filled: number } {
  const result: StoryBeat[] = [];
  let filled = 0;

  for (let i = 0; i < STORY_BATCH_SIZE; i++) {
    const globalIndex = start + i;
    const q = BFI2_SHORT[globalIndex];
    if (!q) continue;

    const byBfi = llmBeats.find((b) => b.bfiId === q.id);
    const byIndex = llmBeats[i];
    const candidate = byBfi || byIndex;
    const chapter = Math.floor(globalIndex / 3) + 1;

    if (isUsableLlmBeat(candidate)) {
      result.push({
        ...candidate,
        id: globalIndex + 1,
        bfiId: q.id,
        trait: q.trait,
        chapter: candidate.chapter || chapter,
        chapterTitle: candidate.chapterTitle || CHAPTER_TITLES[chapter - 1] || `Chapter ${chapter}`,
        choices:
          candidate.choices?.length === 5
            ? candidate.choices
            : contextualStoryChoices(q, hero, globalIndex),
        scenePrompt:
          candidate.scenePrompt && candidate.scenePrompt.length > 10
            ? candidate.scenePrompt
            : scenePromptFromBeat(setting, chapter, candidate.narrative),
      });
    } else {
      result.push(buildTraitFallbackBeat(globalIndex, hero, setting, premise));
      filled++;
    }
  }

  return { beats: result, filled };
}

async function fetchStoryBatchSingle(
  provider: "gemini" | "openai",
  system: string,
  prompt: string,
  llmKeys: LlmKeySource | undefined,
  batchIndex: number
): Promise<string> {
  const attempts = 3;
  let lastError = "empty response";

  for (let attempt = 0; attempt < attempts; attempt++) {
    try {
      const temperature = attempt === 0 ? (batchIndex === 0 ? 1 : 0.9) : attempt === 1 ? 0.75 : 0.55;
      const raw =
        provider === "gemini"
          ? await geminiGenerateText({
              system,
              prompt,
              temperature,
              maxTokens: 16384,
              json: true,
              apiKey: llmKeys?.geminiKey ?? undefined,
              model: llmKeys?.geminiModel ?? undefined,
            })
          : await callStoryLlmOpenAi(system, prompt, llmKeys, temperature);

      if (raw?.trim()) return raw;
      lastError = `batch ${batchIndex + 1} empty response`;
    } catch (err) {
      lastError = err instanceof Error ? err.message : String(err);
      if (attempt < attempts - 1) {
        await new Promise((resolve) => setTimeout(resolve, 1500 * (attempt + 1)));
      }
    }
  }

  throw new Error(lastError);
}

async function fetchStoryBatchChat(
  provider: "gemini" | "openai",
  system: string,
  history: ChatTurn[],
  prompt: string,
  llmKeys: LlmKeySource | undefined,
  batchIndex: number
): Promise<string> {
  const attempts = 3;
  let lastError = "empty response";
  const messages: ChatTurn[] = [...history, { role: "user", content: prompt }];

  for (let attempt = 0; attempt < attempts; attempt++) {
    try {
      const temperature = attempt === 0 ? 0.9 : attempt === 1 ? 0.75 : 0.55;
      const raw =
        provider === "gemini"
          ? await geminiChatCompletion({
              system,
              messages: messages as GeminiMessage[],
              temperature,
              maxTokens: 16384,
              json: true,
              apiKey: llmKeys?.geminiKey ?? undefined,
              model: llmKeys?.geminiModel ?? undefined,
            })
          : await callStoryChatOpenAi(system, messages, llmKeys, temperature);

      if (raw?.trim()) return raw;
      lastError = `batch ${batchIndex + 1} empty chat response`;
    } catch (err) {
      lastError = err instanceof Error ? err.message : String(err);
      if (attempt < attempts - 1) {
        await new Promise((resolve) => setTimeout(resolve, 1500 * (attempt + 1)));
      }
    }
  }

  throw new Error(lastError);
}

async function callStoryLlm(
  provider: "gemini" | "openai",
  system: string,
  prompt: string,
  llmKeys?: LlmKeySource
): Promise<string> {
  if (provider === "gemini") {
    return geminiGenerateText({
      system,
      prompt,
      temperature: 0.85,
      maxTokens: 16384,
      json: true,
      apiKey: llmKeys?.geminiKey ?? undefined,
      model: llmKeys?.geminiModel ?? undefined,
    });
  }

  return callStoryLlmOpenAi(system, prompt, llmKeys, 0.85);
}

async function callStoryLlmOpenAi(
  system: string,
  prompt: string,
  llmKeys?: LlmKeySource,
  temperature = 0.85
): Promise<string> {
  const openaiKey = llmKeys?.openaiKey ?? process.env.OPENAI_API_KEY;
  if (!openaiKey) throw new Error("OpenAI key not configured");

  const OpenAI = (await import("openai")).default;
  const openai = new OpenAI({ apiKey: openaiKey });
  const response = await openai.chat.completions.create({
    model: "gpt-4o-mini",
    temperature,
    response_format: { type: "json_object" },
    messages: [
      { role: "system", content: system },
      { role: "user", content: prompt },
    ],
    max_tokens: 12000,
  });
  return response.choices[0]?.message?.content || "";
}

async function callStoryChatOpenAi(
  system: string,
  messages: ChatTurn[],
  llmKeys?: LlmKeySource,
  temperature = 0.75
): Promise<string> {
  const openaiKey = llmKeys?.openaiKey ?? process.env.OPENAI_API_KEY;
  if (!openaiKey) throw new Error("OpenAI key not configured");

  const OpenAI = (await import("openai")).default;
  const openai = new OpenAI({ apiKey: openaiKey });
  const response = await openai.chat.completions.create({
    model: "gpt-4o-mini",
    temperature,
    response_format: { type: "json_object" },
    messages: [
      { role: "system", content: system },
      ...messages.map((m) => ({ role: m.role as "user" | "assistant", content: m.content })),
    ],
    max_tokens: 12000,
  });
  return response.choices[0]?.message?.content || "";
}

function buildBatchPrompt(
  batch: number,
  hero: string,
  storySeed: string,
  meta: StoryBatchMeta | null,
  setting: string,
  storySoFar: string,
  start: number,
  end: number,
  personalityHints: unknown
): string {
  const entropy = storyEntropy(storySeed);

  if (!meta) {
    throw new Error("Story meta missing for batch prompt");
  }

  if (batch === 0) {
    return `Run id: ${entropy.runId}
The story world is ALREADY invented — do not change era, timeline, or premise.

Title: ${meta.title}
Prologue: ${meta.prologue}
Premise: ${meta.premise}
Setting: ${meta.setting}
World context: ${JSON.stringify(meta.worldContext)}

Write the OPENING ${STORY_BATCH_SIZE} beats (ids ${start + 1}-${end}) that launch THIS specific story.
Return JSON ONLY: {"beats":[...]}

Personality themes to weave into your plot:
${JSON.stringify(personalityHints)}`;
  }

  return `Continue the SAME story for "${meta.heroName || hero}".
Premise (do not abandon): "${meta.premise}"
World bible: ${JSON.stringify(meta.worldContext)}

Title: ${meta.title}
Setting: ${meta.setting}
Recent plot: ${storySoFar.slice(-600) || "Story just started."}

Return JSON ONLY: {"beats":[...]}
Exactly ${STORY_BATCH_SIZE} beats, ids ${start + 1}-${end}. Same world, same characters, new plot events.

Personality themes for these beats:
${JSON.stringify(personalityHints)}`;
}

function storyModelFor(provider: "gemini" | "openai", llmKeys?: LlmKeySource): string {
  return provider === "gemini"
    ? llmKeys?.geminiModel ?? process.env.GEMINI_MODEL ?? "gemini-2.5-flash"
    : "gpt-4o-mini";
}

async function generateStoryInBatches(
  userId: string,
  userName: string | undefined,
  provider: "gemini" | "openai",
  llmKeys: LlmKeySource | undefined,
  storySeed: string
): Promise<{ journey: StoryJourney; warnings: string[]; partialFill: boolean; worldDraft: StoryWorldDraft } | null> {
  const hero = userName || "Traveler";
  const { draft: worldDraft, worldRecovered, worldWarnings } = await generateStoryWorld(
    provider,
    hero,
    storySeed,
    llmKeys
  );

  let meta: StoryBatchMeta = metaFromWorldDraft(worldDraft, hero);
  const allBeats: StoryBeat[] = [];
  let storySoFar = "";
  const warnings: string[] = [...worldWarnings];
  let partialFill = worldRecovered;

  const systemPrompt = STORY_BATCH_SYSTEM_PROMPT.replaceAll("N", String(STORY_BATCH_SIZE));
  const chatHistory: ChatTurn[] = [];

  for (let batch = 0; batch < STORY_BATCH_COUNT; batch++) {
    if (batch > 0) {
      await new Promise((resolve) => setTimeout(resolve, 2000));
    }

    const start = batch * STORY_BATCH_SIZE;
    const end = start + STORY_BATCH_SIZE;
    const personalityHints = personalityBeatHints(start, end);

    const prompt = buildBatchPrompt(
      batch,
      hero,
      storySeed,
      meta,
      meta.setting,
      storySoFar,
      start,
      end,
      personalityHints
    );

    let parsed: Partial<StoryJourney> & { beats?: StoryBeat[]; jsonRecovered?: boolean };
    let raw = "";
    try {
      ({ parsed, raw } = await fetchAndParseStoryBatch({
        provider,
        systemPrompt,
        prompt,
        llmKeys,
        batch,
        chatHistory,
      }));

      const llmBeatCount = parsed.beats?.length ?? 0;
      if (parsed.jsonRecovered && llmBeatCount < STORY_BATCH_SIZE) {
        warnings.push(
          `Batch ${batch + 1} JSON was truncated; recovered ${llmBeatCount}/${STORY_BATCH_SIZE} beats`
        );
        partialFill = true;
      }

      chatHistory.push({ role: "user", content: prompt });
      chatHistory.push({
        role: "assistant",
        content: JSON.stringify({ beats: compactBeatsForHistory(parsed.beats ?? []) }),
      });
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      if (batch === 0) throw new Error(`Batch 1 failed: ${msg}`);
      warnings.push(`Batch ${batch + 1} LLM failed (${msg}); filled with premise-based placeholders`);
      parsed = { beats: [] };
      partialFill = true;
    }

    const llmBeats = parsed.beats ?? [];
    const { beats: merged, filled } = mergeBatchBeats(
      start,
      llmBeats,
      meta.heroName || hero,
      meta.setting,
      meta.premise
    );

    if (filled > 0) {
      partialFill = true;
      if (llmBeats.length === 0) {
        const hint = raw ? ` response: ${raw.slice(0, 80).replace(/\s+/g, " ")}…` : "";
        warnings.push(`Batch ${batch + 1} returned 0/${STORY_BATCH_SIZE} beats; used placeholders for all${hint}`);
      } else {
        warnings.push(
          `Batch ${batch + 1} returned ${llmBeats.length}/${STORY_BATCH_SIZE} beats; filled ${filled} with placeholders`
        );
      }
    }

    allBeats.push(...merged);
    storySoFar = allBeats
      .slice(-2)
      .map((b) => b.narrative)
      .join(" ");
  }

  if (allBeats.length !== 30) {
    throw new Error(`Expected 30 beats, got ${allBeats.length}`);
  }

  return {
    journey: hydrateStoryBeats({
      title: meta.title,
      prologue: meta.prologue,
      heroName: meta.heroName,
      setting: meta.setting,
      worldContext: meta.worldContext,
      beats: allBeats,
    }),
    warnings,
    partialFill,
    worldDraft,
  };
}

function normalizeBeatChoices(
  beat: StoryBeat,
  question: BFIQuestion,
  hero: string,
  index: number
): StoryChoice[] {
  const choices = beat.choices;
  if (choices?.length === 5) {
    const values = choices.map((c) => c.value).sort((a, b) => a - b);
    const valid = values.join(",") === "1,2,3,4,5" && choices.every((c) => c.label?.trim());
    if (valid) {
      return [...choices].sort((a, b) => b.value - a.value);
    }
  }
  return contextualStoryChoices(question, hero, index);
}

function hydrateStoryBeats(journey: StoryJourney): StoryJourney {
  const hero = journey.heroName || "You";
  const setting = journey.setting || "the story world";

  const beats = journey.beats.map((beat, index) => {
    const question = BFI2_SHORT.find((q) => q.id === beat.bfiId);
    if (!question) return beat;

    const chapter = beat.chapter || Math.floor(index / 3) + 1;
    const narrative =
      beat.narrative && !FORBIDDEN_STORY_PATTERNS.test(beat.narrative)
        ? beat.narrative
        : beat.narrative;

    return {
      ...beat,
      chapter,
      chapterTitle: beat.chapterTitle || CHAPTER_TITLES[chapter - 1] || `Chapter ${chapter}`,
      narrative,
      question: beat.question?.trim() ? beat.question : `What would ${hero} do next?`,
      scenePrompt:
        beat.scenePrompt && beat.scenePrompt.length > 10
          ? beat.scenePrompt
          : scenePromptFromBeat(setting, chapter, narrative || journey.prologue),
      choices: normalizeBeatChoices(beat, question, hero, index),
    };
  });

  return { ...journey, beats };
}

export async function generateStoryJourney(
  userId: string,
  userName?: string,
  llmKeys?: LlmKeySource,
  options?: StoryGenerationOptions
): Promise<StoryJourney> {
  const storySeed = options?.storySeed || createStorySeed();
  const providerChain = resolveLlmProviderChain(llmKeys);
  const providerResolved = providerChain[0] ?? null;

  const fallback = (reason: string): StoryJourney => {
    const fb = buildFallbackStory(userId, userName, storySeed);
    return {
      ...fb,
      _debug: {
        storySource: "fallback",
        storyModel: "built-in-arc",
        providerResolved,
        storyFailureReason: reason,
        storySeed,
        storyPremise: fb.worldContext.timeline,
      },
    };
  };

  if (!providerChain.length) {
    return fallback("No LLM API key configured (add a key in Admin → Platform AI Keys)");
  }

  const errors: string[] = [];

  for (const provider of providerChain) {
    const storyModel = storyModelFor(provider, llmKeys);
    try {
      const result = await generateStoryInBatches(userId, userName, provider, llmKeys, storySeed);
      if (result) {
        return {
          ...result.journey,
          _debug: {
            storySource: provider,
            storyModel,
            providerResolved,
            storyPartialFill: result.partialFill,
            storyWarnings: result.warnings.length ? result.warnings : undefined,
            storySeed,
            storyPremise: result.worldDraft.premise,
          },
        };
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      errors.push(`${provider}: ${msg.slice(0, 200)}`);
    }
  }

  return fallback(errors.join(" | ") || "LLM story generation failed");
}

/** Detect which LLM provider(s) hit quota / 429 from a fallback reason string. */
export function parseLlmQuotaFailure(
  reason?: string,
  providerResolved?: "gemini" | "openai" | null
): { providers: ("openai" | "gemini")[] } | null {
  if (!reason) return null;
  const lower = reason.toLowerCase();
  if (!lower.includes("429") && !lower.includes("quota") && !lower.includes("rate limit")) {
    return null;
  }

  const providers: ("openai" | "gemini")[] = [];
  if (/openai\s*:/i.test(reason)) providers.push("openai");
  if (/gemini\s*:/i.test(reason) || lower.includes("gemini api")) providers.push("gemini");

  if (providers.length === 0 && providerResolved) {
    providers.push(providerResolved);
  }

  return providers.length ? { providers: [...new Set(providers)] } : null;
}

export function partialScoresFromResponses(
  responses: Record<number, number>,
  beats: StoryBeat[]
): Record<string, number> {
  const traitSums: Record<string, { sum: number; count: number }> = {};
  for (const beat of beats) {
    const val = responses[beat.bfiId];
    if (val === undefined) continue;
    if (!traitSums[beat.trait]) traitSums[beat.trait] = { sum: 0, count: 0 };
    traitSums[beat.trait].sum += val;
    traitSums[beat.trait].count += 1;
  }
  const result: Record<string, number> = {};
  for (const [trait, { sum, count }] of Object.entries(traitSums)) {
    result[trait] = count ? Math.round((sum / count / 5) * 100) : 50;
  }
  return result;
}
