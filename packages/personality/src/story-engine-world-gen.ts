export type StoryWorldContextFields = {
  framing: string;
  timeline: string;
  place: string;
  yourRole: string;
  mood: string;
};

export type StoryWorldDraft = {
  title: string;
  prologue: string;
  setting: string;
  premise: string;
  worldContext: StoryWorldContextFields;
};

export const WORLD_GEN_SYSTEM_PROMPT = `You invent a completely original fictional story world for an interactive personality journey. Return JSON only — no markdown.

Every run must be unique. Invent from scratch: time period, genre, location, conflict, tone, cast.
Valid eras include ANY of: present day, historical (any century), near future, far future, alternate history, mythic, surreal — choose freely and vary it every time.
Do NOT default to medieval Europe, generic fantasy quests, blank maps, mirror pools, or lantern journeys.

Output JSON shape:
{
  "title": "original title",
  "prologue": "max 2 sentences hook",
  "setting": "short physical setting description",
  "premise": "central conflict in one sentence",
  "worldContext": {
    "framing": "e.g. Sci-fi | Contemporary drama | Historical | Surreal | Horror | Comedy",
    "timeline": "specific era or year PLUS duration, e.g. 'Manila, 2026, one weekend' or 'Orbital habitat, 2388, one shift'",
    "place": "specific place name and atmosphere",
    "yourRole": "1-2 sentences: who the player is — use the hero name given",
    "mood": "overall emotional tone"
  }
}`;

export function hashString(input: string): number {
  return input.split("").reduce((acc, char, index) => acc + char.charCodeAt(0) * (index + 1), 0);
}

/** Nonce only — no curated story lists. Entropy nudges the model without picking presets. */
export function storyEntropy(storySeed: string) {
  const h = hashString(storySeed);
  const h2 = hashString(`${storySeed}:salt`);
  return {
    runId: storySeed,
    nonce: `${h.toString(36)}-${h2.toString(36)}`,
    rollA: h % 997,
    rollB: h2 % 991,
    rollC: (h ^ h2) % 983,
  };
}

export function buildWorldGenPrompt(hero: string, storySeed: string): string {
  const e = storyEntropy(storySeed);
  return `Unique run ID: ${e.runId}
Entropy nonce: ${e.nonce} (rolls: ${e.rollA}, ${e.rollB}, ${e.rollC})
Hero name: ${hero}

Invent a brand-new story world that has never existed before in any prior run.
Surprise the reader — combine unexpected era + genre + place.
The hero "${hero}" is the protagonist. Make worldContext.yourRole about them.`;
}

export function isValidWorldDraft(
  parsed: Record<string, unknown>,
  hero: string
): parsed is Record<string, unknown> & {
  title: string;
  prologue: string;
  setting: string;
  premise: string;
  worldContext: StoryWorldContextFields;
} {
  const wc = parsed.worldContext as Partial<StoryWorldContextFields> | undefined;
  return (
    typeof parsed.title === "string" &&
    parsed.title.length > 3 &&
    typeof parsed.prologue === "string" &&
    parsed.prologue.length > 20 &&
    typeof parsed.setting === "string" &&
    typeof parsed.premise === "string" &&
    !!wc?.timeline?.trim() &&
    wc.timeline.length > 8 &&
    !!wc.framing?.trim() &&
    !!wc.place?.trim() &&
    !!wc.mood?.trim() &&
    (!!wc.yourRole?.trim() || !!hero)
  );
}

export function draftFromParsed(
  parsed: Record<string, unknown>,
  hero: string
): StoryWorldDraft {
  const wc = parsed.worldContext as Partial<StoryWorldContextFields>;
  return {
    title: String(parsed.title).trim(),
    prologue: String(parsed.prologue).trim(),
    setting: String(parsed.setting || wc.place).trim(),
    premise: String(parsed.premise).trim(),
    worldContext: {
      framing: wc.framing?.trim() || "Fictional",
      timeline: wc.timeline!.trim(),
      place: wc.place!.trim(),
      yourRole:
        wc.yourRole?.trim() ||
        `You are ${hero}, the protagonist. Read each moment as if you are living it.`,
      mood: wc.mood!.trim(),
    },
  };
}

export function buildMinimalWorldFallback(hero: string, storySeed: string): StoryWorldDraft {
  const e = storyEntropy(storySeed);
  return {
    title: `The Unwritten Chapter of ${hero}`,
    prologue: `${hero} stands at the edge of a story only they can finish — every choice from here shapes who they become.`,
    setting: "A place not yet named, waiting for your decisions to define it",
    premise: "A personal journey where each moment reveals who you truly are",
    worldContext: {
      framing: "Fictional — invented for you",
      timeline: `Unspecified era, run ${e.nonce.slice(0, 8)}, several continuous days`,
      place: "An original setting defined by your path",
      yourRole: `You are ${hero}. Inhabit this story fully and choose what you would do.`,
      mood: "Open, reflective, unknown",
    },
  };
}
