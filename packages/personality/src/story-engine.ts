import type { BFIQuestion } from "./bfi2.js";
import { BFI2_SHORT } from "./bfi2.js";
import { geminiGenerateText, resolveLlmProvider, type LlmKeySource } from "./gemini.js";
import { buildContinuousArc } from "./story-arc.js";

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

export type StoryJourney = {
  title: string;
  prologue: string;
  heroName: string;
  setting: string;
  beats: StoryBeat[];
  _debug?: StoryGenerationDebug;
};

export type StoryGenerationDebug = {
  storySource: "gemini" | "openai" | "fallback";
  storyModel?: string;
};

const SETTINGS = [
  "a misty coastal town where lanterns glow at dusk",
  "an ancient library that breathes with living ink",
  "a floating garden above the clouds",
  "a midnight train crossing forgotten stars",
  "a quiet city where dreams leak into the streets",
];

const CHAPTER_TITLES = [
  "The Threshold",
  "The First Light",
  "A Stranger's Gift",
  "The Hidden Path",
  "Echoes of Choice",
  "The Mirror Pool",
  "Crossroads of Heart",
  "The Long Road",
  "Gathering Storm",
  "The Inner Door",
];

function pick<T>(arr: T[], seed: number): T {
  return arr[seed % arr.length]!;
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

function scenePromptFromArc(setting: string, chapter: number, sceneDetail: string): string {
  return `${setting}, ${sceneDetail}, chapter ${chapter}, continuous story journey, pencil sketch, graphite on paper, no text`;
}

export function buildFallbackStory(userId: string, userName?: string): StoryJourney {
  const seed = userId.split("").reduce((a, c) => a + c.charCodeAt(0), 0);
  const hero = userName?.split(" ")[0] || "You";
  const setting = pick(SETTINGS, seed);
  const title = `The Awakening of ${hero}`;
  const arc = buildContinuousArc(hero, setting);

  const beats: StoryBeat[] = BFI2_SHORT.map((q, i) => {
    const chapter = Math.floor(i / 3) + 1;
    const moment = arc[i]!;
    return {
      id: i + 1,
      bfiId: q.id,
      trait: q.trait,
      chapter,
      chapterTitle: CHAPTER_TITLES[chapter - 1] || `Chapter ${chapter}`,
      narrative: moment.narrative,
      question: moment.question,
      choices: contextualStoryChoices(q, hero, i),
      scenePrompt: scenePromptFromArc(setting, chapter, moment.sceneDetail),
    };
  });

  return {
    title,
    prologue: `${hero} steps into ${setting} with a blank map that only fills when their story is told truthfully. Over thirty moments, one journey unfolds — from the first lantern to the mirror pool where a companion takes shape. This is not a test. It is the tale of how ${hero} becomes whole.`,
    heroName: hero,
    setting,
    beats,
  };
}

const STORY_SYSTEM_PROMPT = `You create ONE continuous short story split into exactly 30 sequential beats for personality discovery.
Return JSON with: title, prologue (2-3 sentences setting up the whole arc), heroName, setting, beats (array of exactly 30).

STORY CONTINUITY (mandatory):
- This is a single tale from beat 1 to 30 — a complete hero's journey with beginning, middle, and end
- Beat 1 opens the adventure; beat 30 resolves at a mirror/reveal where a companion is born
- Each beat MUST reference what just happened in the previous beat (carry objects, characters, locations forward)
- Never reset to a random new scene without a story transition
- Recurring elements: a glowing map that fills with each choice, at least one companion/traveler who returns

Each beat must include: id (1-30), bfiId (matching input), trait, chapter (1-10, 3 beats each), chapterTitle, narrative (2 sentences continuing the plot), question (story-framed, tied to THIS exact moment), choices (5 unique options with label and value), scenePrompt (pencil sketch of THIS scene).

CRITICAL scoring rules for choices:
- values must be exactly 5, 4, 3, 2, 1 (each used once)
- value 5 = strongest agreement with the original BFI statement (even if reverseScored)
- value 1 = strongest disagreement with that statement
- labels must be story actions tied to THIS beat — never generic agree/disagree scales
- Never mention Big Five or psychology.`;

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
  const setting = journey.setting || pick(SETTINGS, 0);
  const arc = buildContinuousArc(hero, setting);

  const beats = journey.beats.map((beat, index) => {
    const question = BFI2_SHORT.find((q) => q.id === beat.bfiId);
    const fallback = arc[index];
    if (!question) return beat;

    const narrative =
      beat.narrative && beat.narrative.length > 50 && !beat.narrative.includes("world seems to pause")
        ? beat.narrative
        : fallback?.narrative || beat.narrative;

    const storyQuestion =
      beat.question && beat.question.length > 30 ? beat.question : fallback?.question || beat.question;

    const scenePrompt =
      beat.scenePrompt && beat.scenePrompt.length > 20
        ? beat.scenePrompt
        : fallback
          ? scenePromptFromArc(setting, beat.chapter || Math.floor(index / 3) + 1, fallback.sceneDetail)
          : beat.scenePrompt;

    return {
      ...beat,
      narrative,
      question: storyQuestion,
      scenePrompt,
      choices: normalizeBeatChoices(beat, question, hero, index),
    };
  });

  return { ...journey, beats };
}

export async function generateStoryJourney(
  userId: string,
  userName?: string,
  llmKeys?: LlmKeySource
): Promise<StoryJourney> {
  const provider = resolveLlmProvider(llmKeys);
  const fallback = (): StoryJourney => ({
    ...buildFallbackStory(userId, userName),
    _debug: { storySource: "fallback", storyModel: "built-in-arc" },
  });

  if (!provider) {
    return fallback();
  }

  const bfiList = BFI2_SHORT.map((q) => ({
    id: q.id,
    trait: q.trait,
    reverseScored: q.reverseScored,
    original: q.text,
  }));

  const arcOutline = buildContinuousArc(userName || "Traveler", "a magical realm").map((m, i) => ({
    beat: i + 1,
    bfiId: BFI2_SHORT[i]?.id,
    plotHint: m.narrative.slice(0, 80),
  }));

  const userPrompt = `Create a unique continuous story for "${userName || "Traveler"}" (seed: ${userId.slice(0, 8)}).
Use this plot spine as inspiration — each beat must flow into the next like chapters of one book:
${JSON.stringify(arcOutline)}

Map these 30 personality moments to story beats (same order, same bfiId):
${JSON.stringify(bfiList)}`;

  const storyModel =
    provider === "gemini"
      ? llmKeys?.geminiModel ?? process.env.GEMINI_MODEL ?? "gemini-2.0-flash"
      : "gpt-4o-mini";

  try {
    let raw = "";

    if (provider === "gemini") {
      raw = await geminiGenerateText({
        system: STORY_SYSTEM_PROMPT,
        prompt: userPrompt,
        temperature: 0.9,
        maxTokens: 8192,
        json: true,
        apiKey: llmKeys?.geminiKey ?? undefined,
        model: llmKeys?.geminiModel ?? undefined,
      });
    } else {
      const openaiKey = llmKeys?.openaiKey ?? process.env.OPENAI_API_KEY;
      if (!openaiKey) return fallback();
      const OpenAI = (await import("openai")).default;
      const openai = new OpenAI({ apiKey: openaiKey });
      const response = await openai.chat.completions.create({
        model: "gpt-4o-mini",
        temperature: 0.9,
        response_format: { type: "json_object" },
        messages: [
          { role: "system", content: STORY_SYSTEM_PROMPT },
          { role: "user", content: userPrompt },
        ],
        max_tokens: 8000,
      });
      raw = response.choices[0]?.message?.content || "";
    }

    const parsed = JSON.parse(raw || "{}") as StoryJourney;
    if (parsed.beats?.length === 30) {
      return {
        ...hydrateStoryBeats(parsed),
        _debug: { storySource: provider, storyModel },
      };
    }
  } catch {
    // fall through
  }

  return fallback();
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
