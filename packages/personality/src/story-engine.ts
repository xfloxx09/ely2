import type { BFIQuestion } from "./bfi2.js";
import { BFI2_SHORT } from "./bfi2.js";
import { geminiGenerateText, resolveLlmProvider, type LlmKeySource } from "./gemini.js";

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

function storyChoiceLabels(question: BFIQuestion): StoryChoice[] {
  const positive = !question.reverseScored;
  return [
    { label: positive ? "This feels deeply true — it's simply who I am" : "Not at all — that's the opposite of me", value: positive ? 5 : 1 },
    { label: positive ? "Yes, more often than not" : "Rarely, if ever", value: positive ? 4 : 2 },
    { label: "I'm somewhere in the middle", value: 3 },
    { label: positive ? "Only in small moments" : "Sometimes, but not really me", value: positive ? 2 : 4 },
    { label: positive ? "Hardly ever" : "Absolutely — that's me completely", value: positive ? 1 : 5 },
  ];
}

function narrativeForQuestion(q: BFIQuestion, hero: string, setting: string, idx: number): string {
  const intros = [
    `As ${hero} walks deeper into ${setting}, the world seems to pause and listen.`,
    `The path twists. ${hero} finds a moment of stillness, and a question rises unbidden.`,
    `Memory and possibility intertwine. ${hero} must choose what feels most honest.`,
    `Soft light gathers around ${hero}. The story waits for an answer only they can give.`,
  ];
  const intro = intros[idx % intros.length];
  const traitMood: Record<string, string> = {
    openness: "Something unfamiliar shimmers at the edge of perception — curiosity, or caution?",
    extraversion: "Voices carry on the wind. Does the heart lean toward the crowd, or the quiet?",
    conscientiousness: "A task unfinished, a plan unmade. How does order live inside this soul?",
    agreeableness: "Another traveler appears on the road. What lives in the space between two people?",
    neuroticism: "The air tightens. Storm or calm — which feels more like home inside?",
  };
  return `${intro} ${traitMood[q.trait] || "The moment asks for truth."}`;
}

function scenePromptFor(q: BFIQuestion, setting: string, chapter: number): string {
  const scenes: Record<string, string> = {
    openness: "open doorway leading to surreal landscape, floating books, stars",
    extraversion: "lively marketplace or gathering, warm faces, lanterns",
    conscientiousness: "organized desk, maps, compass, neat architecture",
    agreeableness: "two figures sharing tea, gentle bridge, soft trees",
    neuroticism: "calm lake reflecting sky, sheltered alcove, steady horizon",
    neuroticism_alt: "rain on window, but peaceful interior light",
  };
  const detail = scenes[q.trait] || "mysterious path through soft fog";
  return `Chapter ${chapter}, ${setting}, ${detail}, pencil sketch, graphite drawing on textured paper, crosshatching, artistic, no text`;
}

function questionAsStory(q: BFIQuestion, hero: string): string {
  const templates: Record<string, string[]> = {
    openness: [
      `${hero}, when the unknown calls — do you run toward wonder, or prefer the familiar ground beneath your feet?`,
      `A door opens to something strange and beautiful. How much of yourself do you give to the new?`,
    ],
    extraversion: [
      `In a room full of stories, does ${hero}'s spirit ignite — or seek a quieter corner to breathe?`,
      `When the world is loud with possibility, where does ${hero} truly come alive?`,
    ],
    conscientiousness: [
      `Before the journey continues — does ${hero} need a plan, a list, a map... or does freedom matter more?`,
      `The road ahead splits. Does ${hero} walk with careful steps, or trust the wind?`,
    ],
    agreeableness: [
      `Someone needs help on the path. How quickly does ${hero}'s heart move to soften the fall?`,
      `When conflict whispers — does ${hero} seek harmony, or stand firm in their truth?`,
    ],
    neuroticism: [
      `When the sky darkens unexpectedly — what stirs inside ${hero}?`,
      `The ground shifts. Does ${hero} find their center easily, or does the world feel heavier?`,
    ],
  };
  const opts = templates[q.trait] || [`What feels most true of ${hero} in this moment?`];
  return opts[q.id % opts.length]!;
}

export function buildFallbackStory(userId: string, userName?: string): StoryJourney {
  const seed = userId.split("").reduce((a, c) => a + c.charCodeAt(0), 0);
  const hero = userName?.split(" ")[0] || "You";
  const setting = pick(SETTINGS, seed);
  const title = `The Awakening of ${hero}`;

  const beats: StoryBeat[] = BFI2_SHORT.map((q, i) => {
    const chapter = Math.floor(i / 3) + 1;
    return {
      id: i + 1,
      bfiId: q.id,
      trait: q.trait,
      chapter,
      chapterTitle: CHAPTER_TITLES[chapter - 1] || `Chapter ${chapter}`,
      narrative: narrativeForQuestion(q, hero, setting, i),
      question: questionAsStory(q, hero),
      choices: storyChoiceLabels(q),
      scenePrompt: scenePromptFor(q, setting, chapter),
    };
  });

  return {
    title,
    prologue: `There is a place — ${setting} — where every soul leaves a trace in the air. Tonight, the pages turn for ${hero}. This is not a test. It is a story only you can finish. As you choose, something begins to take shape: a face, a companion, a reflection of who you truly are.`,
    heroName: hero,
    setting,
    beats,
  };
}

const STORY_SYSTEM_PROMPT = `You create immersive personalized story questionnaires for personality discovery. 
Return JSON with: title, prologue (2-3 poetic sentences), heroName, setting, beats (array of exactly 30).
Each beat must include: id (1-30), bfiId (matching input), trait, chapter (1-10, ~3 beats each), chapterTitle, narrative (2 sentences of story prose), question (story-framed, no clinical language), choices (5 options with label and value 1-5 where higher agreement with the trait unless reverseScored), scenePrompt (pencil sketch image description).
Never mention Big Five or psychology. Make it magical, literary, and unique.`;

export async function generateStoryJourney(
  userId: string,
  userName?: string,
  llmKeys?: LlmKeySource
): Promise<StoryJourney> {
  const provider = resolveLlmProvider(llmKeys);
  if (!provider) {
    return buildFallbackStory(userId, userName);
  }

  const bfiList = BFI2_SHORT.map((q) => ({
    id: q.id,
    trait: q.trait,
    reverseScored: q.reverseScored,
    original: q.text,
  }));

  const userPrompt = `Create a unique story for user "${userName || "Traveler"}" (id seed: ${userId.slice(0, 8)}). 
Map these 30 personality moments: ${JSON.stringify(bfiList)}`;

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
      if (!openaiKey) return buildFallbackStory(userId, userName);
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
      return parsed;
    }
  } catch {
    // fall through
  }

  return buildFallbackStory(userId, userName);
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
