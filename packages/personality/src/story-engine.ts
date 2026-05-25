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
      choices: contextualStoryChoices(q, hero, i),
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
Each beat must include: id (1-30), bfiId (matching input), trait, chapter (1-10, ~3 beats each), chapterTitle, narrative (2 sentences of story prose), question (story-framed, no clinical language), choices (array of exactly 5 UNIQUE options for THIS beat only — each with label and value), scenePrompt (pencil sketch image description).

CRITICAL scoring rules for choices:
- values must be exactly 5, 4, 3, 2, 1 (each used once)
- value 5 = strongest agreement with the original BFI statement (even if reverseScored / negative wording like "lazy" or "quiet")
- value 1 = strongest disagreement with that statement
- labels must be story actions or feelings tied to THIS beat's question — never reuse generic scales like "agree strongly"
- Never mention Big Five or psychology. Make it magical, literary, and unique.`;

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
  const beats = journey.beats.map((beat, index) => {
    const question = BFI2_SHORT.find((q) => q.id === beat.bfiId);
    if (!question) return beat;
    return {
      ...beat,
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
      return hydrateStoryBeats(parsed);
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
