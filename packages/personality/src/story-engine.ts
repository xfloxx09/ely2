import type { BFIQuestion } from "./bfi2.js";
import { BFI2_SHORT } from "./bfi2.js";
import { geminiGenerateText, geminiChatCompletion, resolveLlmProviderChain, type LlmKeySource, type GeminiMessage } from "./gemini.js";

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
  storyBlueprintCategory?: string;
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

const SETTINGS = [
  "a misty coastal town where lanterns glow at dusk",
  "an ancient library that breathes with living ink",
  "a floating garden above the clouds",
  "a midnight train crossing forgotten stars",
  "a quiet city where dreams leak into the streets",
  "a rain-slick neon district after the last tram",
  "a sun-baked desert caravan route between red mesas",
  "a bioluminescent reef city beneath glass domes",
  "a mountain monastery where wind carries old songs",
  "a reclaimed space station orbiting a violet gas giant",
  "a medieval market town on the eve of a comet",
  "a sleepy lakeside village in perpetual golden hour",
  "an underground jazz club built in a converted vault",
  "a bamboo forest path lit by fireflies at twilight",
  "a polar research outpost during the endless night",
];

const STORY_GENRES = [
  "intimate character drama",
  "gentle mystery with wonder",
  "survival journey with heart",
  "magical realism in everyday life",
  "soft sci-fi exploration",
  "historical adventure",
  "dreamlike allegory",
  "cozy fantasy road tale",
  "noir-tinged investigation",
  "coming-of-age odyssey",
];

const STORY_TONES = [
  "hopeful and curious",
  "melancholic but warm",
  "playful and surreal",
  "grounded and reflective",
  "tense yet compassionate",
  "mythic and lyrical",
];

const TIMELINE_ERAS = [
  "Modern era — 2026",
  "Near future — 2087",
  "Late 20th century — 1989",
  "Victorian era — 1880s",
  "Industrial Revolution — 1840s",
  "Age of Sail — 1770s",
  "Renaissance — 1520s",
  "Medieval period — 1240s",
  "Iron Age — 600 BCE",
  "Bronze Age — 1200 BCE",
  "Ancient Egypt — 1400 BCE",
  "Classical antiquity — 430 BCE",
  "Mythic prehistory — timeless, before written history",
  "Post-apocalyptic future — 50 years after the collapse",
];

type StoryBlueprint = {
  category: "modern" | "retro" | "historical" | "futuristic" | "ancient";
  premise: string;
  timeline: string;
  framing: string;
  place: string;
  mood: string;
};

/** Premise + timeline + place are locked together so the LLM cannot default to medieval every run. */
const STORY_BLUEPRINTS: StoryBlueprint[] = [
  {
    category: "modern",
    premise: "A wealthy teenager in Monaco discovers their life is being live-streamed to an unknown audience",
    timeline: "Modern era, March 2026, one volatile weekend",
    framing: "Contemporary literary fiction",
    place: "Monte Carlo marina towers and private yacht decks",
    mood: "Glamorous, paranoid, sharp",
  },
  {
    category: "modern",
    premise: "A hospice nurse in Dublin begins receiving voicemails from patients who have not been born yet",
    timeline: "Present day, autumn 2025, four consecutive night shifts",
    framing: "Contemporary magical realism",
    place: "A public hospital on the River Liffey",
    mood: "Tender, uncanny, grounded",
  },
  {
    category: "modern",
    premise: "A Michelin chef's protégé in Seoul cooks meals that force diners to relive forgotten memories",
    timeline: "Modern era, 2026, three dinner services",
    framing: "Contemporary drama with a surreal edge",
    place: "A basement tasting kitchen in Gangnam",
    mood: "Intimate, intense, sensory",
  },
  {
    category: "modern",
    premise: "A professional esports player is trapped inside their favorite game during a live tournament blackout",
    timeline: "Modern era, July 2026, one sleepless tournament day",
    framing: "Near-contemporary techno-thriller",
    place: "A sold-out arena and the game's neon megacity",
    mood: "Adrenaline, disorientation, wit",
  },
  {
    category: "modern",
    premise: "A suburban teenager finds a phone app that trades emotions like cryptocurrency",
    timeline: "Modern era, 2026, one chaotic week of school",
    framing: "Contemporary YA sci-fi",
    place: "American suburb, mall, and rooftop parties",
    mood: "Playful, anxious, bright",
  },
  {
    category: "modern",
    premise: "A climate activist influencer discovers their sponsor is terraforming the desert in secret",
    timeline: "Modern era, 2026, a five-day convoy across Morocco",
    framing: "Contemporary eco-thriller",
    place: "Solar farms and dust highways outside Marrakech",
    mood: "Urgent, conflicted, sun-scorched",
  },
  {
    category: "modern",
    premise: "A night-shift rideshare driver in Lagos keeps picking up passengers who know impossible details about their past",
    timeline: "Modern era, 2026, one rain-soaked night",
    framing: "Contemporary urban mystery",
    place: "Neon-lit streets and flooded underpasses of Lagos",
    mood: "Electric, skeptical, warm",
  },
  {
    category: "modern",
    premise: "A startup founder in San Francisco realizes their AI assistant is negotiating their relationships for them",
    timeline: "Modern era, spring 2026, forty-eight hours before launch",
    framing: "Contemporary satire",
    place: "Glass offices and hacker-house lofts in SoMa",
    mood: "Caffeinated, ironic, tense",
  },
  {
    category: "futuristic",
    premise: "A night-shift barista on an orbital habitat serves an alien diplomat who speaks in colors",
    timeline: "Far future, 2240, one eighteen-hour docking shift",
    framing: "Science fiction first contact",
    place: "Ringhab Module Seven above Jupiter",
    mood: "Wonder, diplomatic tension, quiet",
  },
  {
    category: "futuristic",
    premise: "A Martian colonist teenager races to save their hydroponic dome before the dust season",
    timeline: "Near future, 2089, six sols until lockdown",
    framing: "Hard science fiction survival",
    place: "Red dust valleys of Valles Marineris colony",
    mood: "Claustrophobic, hopeful, gritty",
  },
  {
    category: "futuristic",
    premise: "An interstellar courier delivers a package that screams when opened",
    timeline: "Far future, 2512, a three-jump delivery route",
    framing: "Space opera noir",
    place: "Cargo bays between dying starports",
    mood: "Cynical, curious, vast",
  },
  {
    category: "futuristic",
    premise: "A quantum physicist accidentally splits their personality across parallel timelines in a lab accident",
    timeline: "Near future, 2039, one experiment cycle",
    framing: "Mind-bending sci-fi",
    place: "Underground research ring beneath Geneva",
    mood: "Cerebral, unstable, luminous",
  },
  {
    category: "futuristic",
    premise: "An AI caretaker wakes in a museum of extinct animals after humanity silently vanishes",
    timeline: "Post-human future, year 3000, seven days of automated routines",
    framing: "Quiet apocalypse sci-fi",
    place: "A domed natural history museum on a silent Earth",
    mood: "Lonely, gentle, eerie",
  },
  {
    category: "futuristic",
    premise: "A climate refugee fleet captain navigates floating cities through acid seas",
    timeline: "Far future, 2195, one storm season crossing",
    framing: "Climate sci-fi epic",
    place: "Acid-green waves and welded city-ships",
    mood: "Epic, weary, defiant",
  },
  {
    category: "futuristic",
    premise: "A memory dealer in Neo-Tokyo sells other people's childhoods on the black market",
    timeline: "Cyberpunk future, 2098, three nights in the neon district",
    framing: "Cyberpunk thriller",
    place: "Shinjuku back alleys and sky-bridge markets",
    mood: "Neon-soaked, moral ambiguity",
  },
  {
    category: "futuristic",
    premise: "A android priest on a generation ship debates whether souls can upload",
    timeline: "Far future, 2780, the final month before arrival",
    framing: "Philosophical space opera",
    place: "Cathedral vault at the ship's rotating spine",
    mood: "Solemn, cosmic, questioning",
  },
  {
    category: "retro",
    premise: "A retired detective in 1970s Tokyo investigates crimes that happen only inside shared dreams",
    timeline: "Late 20th century, 1978, five humid summer nights",
    framing: "Retro noir with supernatural elements",
    place: "Shinjuku jazz bars and tatami apartments",
    mood: "Smoky, melancholic, stylish",
  },
  {
    category: "retro",
    premise: "A jazz musician in 1950s New Orleans plays a song that opens doors to the dead",
    timeline: "Mid 20th century, 1954, one carnival week",
    framing: "Historical magical realism",
    place: "French Quarter clubs and foggy cemeteries",
    mood: "Swinging, haunted, warm",
  },
  {
    category: "retro",
    premise: "A street magician in 1920s Cairo finds real magic leaking through a cracked tomb seal",
    timeline: "Roaring Twenties, 1923, three nights of excavation",
    framing: "Pulp adventure",
    place: "Candlelit bazaars and desert dig sites",
    mood: "Exotic, reckless, dazzling",
  },
  {
    category: "retro",
    premise: "A Hollywood stunt double wakes up as the murdered actor they impersonate",
    timeline: "Late 20th century, 1988, one week before the Oscars",
    framing: "Retro Hollywood thriller",
    place: "Studio lots and hillside mansions of Los Angeles",
    mood: "Glossy, paranoid, cinematic",
  },
  {
    category: "retro",
    premise: "A New Age wellness guru on a Bali retreat realizes one guest can actually see souls",
    timeline: "Modern era, 2019, a ten-day retreat cycle",
    framing: "Contemporary spiritual satire",
    place: "Ubud jungle villas and rice terraces",
    mood: "Serene, uncanny, lush",
  },
  {
    category: "historical",
    premise: "A Regency-era governess inherits a haunted estate that rewrites itself each dawn",
    timeline: "Regency England, 1814, one fortnight in the countryside",
    framing: "Historical gothic romance",
    place: "A mist-wrapped manor in the Cotswolds",
    mood: "Proper, eerie, romantic",
  },
  {
    category: "historical",
    premise: "A samurai's child in Edo-period Japan carries a letter that could start a war",
    timeline: "Edo period, 1803, ten days on the Tōkaidō road",
    framing: "Historical adventure",
    place: "Post towns and pine forests of feudal Japan",
    mood: "Disciplined, urgent, poetic",
  },
  {
    category: "historical",
    premise: "A witch trial survivor in 1600s Salem runs a hidden library of forbidden science",
    timeline: "Colonial era, 1692, one winter of secrecy",
    framing: "Historical thriller",
    place: "Salt-stained cottages and candlelit cellars of Salem",
    mood: "Fearful, defiant, claustrophobic",
  },
  {
    category: "historical",
    premise: "A Viking merchant's daughter brokers peace between raiders and monks during a white winter",
    timeline: "Viking Age, 986 CE, one blizzard-bound month",
    framing: "Historical saga",
    place: "A frozen fjord trading hall in Norway",
    mood: "Harsh, honorable, windswept",
  },
  {
    category: "historical",
    premise: "A medieval blacksmith's apprentice hides a forbidden clockwork heart from the inquisitors",
    timeline: "Medieval Europe, 1240s, nine days before the inspection",
    framing: "Historical fiction with clockpunk elements",
    place: "A soot-dark forge town in the Rhineland",
    mood: "Tense, inventive, candlelit",
  },
  {
    category: "historical",
    premise: "A circus runaway in Victorian London joins a secret society of inventors",
    timeline: "Victorian era, 1887, one exhibition season",
    framing: "Steampunk historical adventure",
    place: "Gaslit London rooftops and hidden workshops",
    mood: "Whimsical, daring, foggy",
  },
  {
    category: "ancient",
    premise: "A Bronze Age village child befriends a stray god disguised as a wounded wolf",
    timeline: "Bronze Age, 1150 BCE, three moonlit nights",
    framing: "Mythic historical fiction",
    place: "A river settlement in Anatolia",
    mood: "Primal, wonder-filled, fierce",
  },
  {
    category: "ancient",
    premise: "A palace scribe in ancient Mesopotamia must forge a peace treaty between rival kings",
    timeline: "Ancient Mesopotamia, 1750 BCE, seven days of negotiation",
    framing: "Epic historical drama",
    place: "Ziggurat courts under a merciless sun",
    mood: "Weighty, diplomatic, dusty",
  },
  {
    category: "ancient",
    premise: "A desert nomad on the Silk Road guides a stranger who never casts a shadow",
    timeline: "Classical antiquity, 200 BCE, a caravan crossing of forty days",
    framing: "Legendary road epic",
    place: "Salt flats and oasis caravanserais of Central Asia",
    mood: "Mythic, patient, sun-beaten",
  },
];

/** Fully distinct story concepts — legacy list kept for reference; blueprints are authoritative. */
const STORY_PREMISES = STORY_BLUEPRINTS.map((b) => b.premise);

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

function pick<T>(arr: T[], seed: number): T {
  return arr[Math.abs(seed) % arr.length]!;
}

function hashString(input: string): number {
  return input.split("").reduce((acc, char, index) => acc + char.charCodeAt(0) * (index + 1), 0);
}

function creativeBriefForSeed(storySeed: string) {
  const h = hashString(storySeed);
  const blueprint = pick(STORY_BLUEPRINTS, h + 23);
  return {
    settingHint: pick(SETTINGS, h),
    genreHint: pick(STORY_GENRES, h + 7),
    toneHint: blueprint.mood || pick(STORY_TONES, h + 13),
    timelineEra: blueprint.timeline,
    premise: blueprint.premise,
    blueprint,
    runId: storySeed.slice(0, 12),
  };
}

function worldContextFromBlueprint(
  blueprint: StoryBlueprint,
  hero: string,
  parsed?: Partial<StoryWorldContext>,
  settingFallback?: string
): StoryWorldContext {
  return {
    framing: blueprint.framing,
    timeline: blueprint.timeline,
    place: parsed?.place?.trim() || blueprint.place,
    yourRole:
      parsed?.yourRole?.trim() ||
      `You are ${hero}, living inside this story. Every choice is yours.`,
    mood: parsed?.mood?.trim() || blueprint.mood,
  };
}

function personalityBeatHints(start: number, end: number) {
  return BFI2_SHORT.slice(start, end).map((q, i) => ({
    beat: start + i + 1,
    bfiId: q.id,
    trait: q.trait,
    theme: TRAIT_THEMES[q.trait] ?? q.trait,
  }));
}

function settingForSeed(storySeed: string): string {
  return creativeBriefForSeed(storySeed).settingHint;
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
  const brief = creativeBriefForSeed(seedKey);
  const setting = brief.premise.split(":")[0]?.slice(0, 80) || settingForSeed(seedKey);
  const title = brief.premise.split(/[.!]/)[0]?.slice(0, 60) || `Tale of ${hero}`;

  const beats: StoryBeat[] = BFI2_SHORT.map((q, i) =>
    buildTraitFallbackBeat(i, hero, setting, brief.premise)
  );

  return {
    title,
    prologue: brief.premise,
    heroName: hero,
    setting: brief.blueprint.place,
    worldContext: worldContextFromBlueprint(brief.blueprint, hero, undefined, setting),
    beats,
  };
}

const STORY_BATCH_SYSTEM_PROMPT = `You write ONE continuous story for personality discovery. Return compact JSON only.

CRITICAL: Every run is a totally different story. Premises can be ANY genre — sci-fi, aliens, medieval, modern wealth, horror, comedy, historical, surreal, whatever fits the brief. NEVER default to a fantasy quest with maps, lanterns, mirror pools, travelers, or mystical journeys.

Batch 1: title, prologue (2 sentences max), heroName, setting, worldContext, beats (exactly N items).
Later batches: beats array only (exactly N items).

worldContext (batch 1 only): {
  "framing": "Match the STORY BLUEPRINT framing exactly",
  "timeline": "Copy the EXACT timeline string from the blueprint — do not invent a different era",
  "place": "Match the blueprint place unless the premise requires a specific sub-location",
  "yourRole": "Who the player is in THIS premise — 1-2 sentences",
  "mood": "Match the blueprint mood"
}

TIMELINE RULE: worldContext.timeline MUST be copied verbatim from the blueprint. Do NOT default to Medieval 1240s. Modern, retro, futuristic, and ancient eras are all valid — use what the blueprint says.

Each beat must advance YOUR invented plot. Weave personality themes naturally — never mention Big Five or psychology.
Each beat: id, bfiId, trait, chapter, chapterTitle, narrative (ONE sentence), question (one line), choices (5 label+value), scenePrompt (visual, no text in image).
Choice values 5,4,3,2,1 once each. Labels under 12 words.`;

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

function extractBeatsFromJson(parsed: Record<string, unknown>): StoryBeat[] {
  const direct = [parsed.beats, parsed.storyBeats, parsed.items];
  for (const candidate of direct) {
    if (Array.isArray(candidate) && candidate.length) {
      return candidate as StoryBeat[];
    }
  }
  for (const val of Object.values(parsed)) {
    if (
      Array.isArray(val) &&
      val.length &&
      typeof val[0] === "object" &&
      val[0] !== null &&
      ("bfiId" in (val[0] as object) || "narrative" in (val[0] as object))
    ) {
      return val as StoryBeat[];
    }
  }
  return [];
}

function parseStoryJson(raw: string): Partial<StoryJourney> & { beats?: StoryBeat[] } {
  const trimmed = raw.trim();
  if (!trimmed) return { beats: [] };
  try {
    const parsed = JSON.parse(trimmed) as Record<string, unknown>;
    return { ...(parsed as Partial<StoryJourney>), beats: extractBeatsFromJson(parsed) };
  } catch {
    const match = trimmed.match(/\{[\s\S]*\}/);
    if (match) {
      const parsed = JSON.parse(match[0]) as Record<string, unknown>;
      return { ...(parsed as Partial<StoryJourney>), beats: extractBeatsFromJson(parsed) };
    }
    throw new Error(`Invalid story JSON (${trimmed.slice(0, 120)}…)`);
  }
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

type StoryBatchMeta = {
  title: string;
  prologue: string;
  heroName: string;
  setting: string;
  premise: string;
  blueprint: StoryBlueprint;
  worldContext: StoryWorldContext;
};

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
  const brief = creativeBriefForSeed(storySeed);

  if (batch === 0) {
    const bp = brief.blueprint;
    return `Write a COMPLETELY ORIGINAL story. Run id: ${brief.runId}.
Category: ${bp.category.toUpperCase()} — honor this era, NOT a default medieval fantasy.

STORY BLUEPRINT (authoritative — copy timeline/framing/place/mood exactly into worldContext):
- Premise: "${bp.premise}"
- Timeline (COPY VERBATIM into worldContext.timeline): "${bp.timeline}"
- Framing: "${bp.framing}"
- Place: "${bp.place}"
- Mood: "${bp.mood}"

The plot, characters, and scenes must match this blueprint's era (${bp.category}).
Do NOT set the story in Medieval Europe unless the timeline above says so.

Return exactly ${STORY_BATCH_SIZE} beats (ids ${start + 1}-${end}).
Each beat explores a personality theme through YOUR plot:
${JSON.stringify(personalityHints)}`;
  }

  return `Continue the SAME story for "${meta?.heroName || hero}".
Premise (do not abandon): "${meta?.premise || brief.premise}"
World bible:
${JSON.stringify(meta?.worldContext)}

Title: ${meta?.title || "Untitled"}
Setting: ${meta?.setting || setting}
Recent plot: ${storySoFar.slice(-600) || "Story just started."}

Return JSON ONLY: {"beats":[...]}
Exactly ${STORY_BATCH_SIZE} beats, ids ${start + 1}-${end}. Same world, same characters, new plot events.

Personality themes for these beats (weave into YOUR story):
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
): Promise<{ journey: StoryJourney; warnings: string[]; partialFill: boolean } | null> {
  const hero = userName || "Traveler";
  const brief = creativeBriefForSeed(storySeed);
  const settingHint = brief.settingHint;
  let meta: StoryBatchMeta | null = null;
  const allBeats: StoryBeat[] = [];
  let storySoFar = "";
  const warnings: string[] = [];
  let partialFill = false;

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
      meta?.setting || settingHint,
      storySoFar,
      start,
      end,
      personalityHints
    );

    let parsed: Partial<StoryJourney> & { beats?: StoryBeat[] };
    let raw = "";
    try {
      raw =
        batch === 0
          ? await fetchStoryBatchSingle(provider, systemPrompt, prompt, llmKeys, batch)
          : await fetchStoryBatchChat(provider, systemPrompt, chatHistory, prompt, llmKeys, batch);
      parsed = parseStoryJson(raw);
      chatHistory.push({ role: "user", content: prompt });
      chatHistory.push({ role: "assistant", content: raw.slice(0, 12000) });
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      if (batch === 0) throw new Error(`Batch 1 failed: ${msg}`);
      warnings.push(`Batch ${batch + 1} LLM failed (${msg}); filled with premise-based placeholders`);
      parsed = { beats: [] };
      partialFill = true;
    }

    if (batch === 0) {
      if (!parsed.title || !parsed.prologue) {
        throw new Error(`Batch 1 missing title/prologue (got ${parsed.beats?.length ?? 0} beats)`);
      }
      meta = {
        title: parsed.title,
        prologue: parsed.prologue,
        heroName: parsed.heroName || hero,
        setting: parsed.setting || brief.blueprint.place || settingHint,
        premise: brief.premise,
        blueprint: brief.blueprint,
        worldContext: worldContextFromBlueprint(
          brief.blueprint,
          parsed.heroName || hero,
          parseWorldContext(parsed as Record<string, unknown>, parsed.heroName || hero, parsed.setting || settingHint),
          parsed.setting || settingHint
        ),
      };
    }

    const llmBeats = parsed.beats ?? [];
    const { beats: merged, filled } = mergeBatchBeats(
      start,
      llmBeats,
      meta?.heroName || hero,
      meta?.setting || settingHint,
      meta?.premise || brief.premise
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

  if (!meta || allBeats.length !== 30) {
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
  const brief = creativeBriefForSeed(storySeed);
  const providerChain = resolveLlmProviderChain(llmKeys);
  const providerResolved = providerChain[0] ?? null;

  const fallback = (reason: string): StoryJourney => ({
    ...buildFallbackStory(userId, userName, storySeed),
    _debug: {
      storySource: "fallback",
      storyModel: "built-in-arc",
      providerResolved,
      storyFailureReason: reason,
      storySeed,
      storyPremise: brief.premise,
      storyBlueprintCategory: brief.blueprint.category,
    },
  });

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
            storyPremise: brief.premise,
            storyBlueprintCategory: brief.blueprint.category,
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
