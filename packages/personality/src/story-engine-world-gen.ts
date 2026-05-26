import { extractBalancedJson } from "./story-json-parse.js";

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

/** Shared voice rule for world + beat generation. */
export const STORY_PLAIN_LANGUAGE_RULE = `Write in clear, everyday English — like a good TV show or YA novel, not a literature PhD.
Use short sentences and common words (8th-grade reading level). Say what happened plainly.
Avoid: rare words, long metaphors, poetic flourishes, abstract philosophy, academic tone, purple prose.
BAD: "The ephemerality of collective memory erodes the crystalline archive."
GOOD: "The city's shared memories are fading. If the clock hits zero, everyone forgets who they are."`;

export const WORLD_GEN_SYSTEM_PROMPT = `You invent a completely original fictional story world for an interactive personality journey. Return JSON only — no markdown.

${STORY_PLAIN_LANGUAGE_RULE}

Every run must be unique. Invent from scratch: time period, genre, location, conflict, tone, cast.
Valid eras include ANY of: present day, historical (any century), near future, far future, alternate history, mythic, surreal — choose freely and vary it every time.
Do NOT default to medieval Europe, generic fantasy quests, blank maps, mirror pools, or lantern journeys.

Keep every string concise (title ≤6 words; prologue ≤2 short sentences; each worldContext field ≤20 words).
Return compact JSON only — no trailing commentary.

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

function stripMarkdownFences(text: string): string {
  return text
    .trim()
    .replace(/^```(?:json)?\s*/i, "")
    .replace(/\s*```\s*$/i, "")
    .trim();
}

function unescapeJsonString(s: string): string {
  return s.replace(/\\n/g, "\n").replace(/\\"/g, '"').replace(/\\\\/g, "\\");
}

function extractJsonStringField(raw: string, key: string, allowPartial = false): string | undefined {
  const escapedKey = key.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const full = new RegExp(`"${escapedKey}"\\s*:\\s*"((?:[^"\\\\]|\\\\.)*)"`, "s");
  const match = raw.match(full);
  if (match?.[1] !== undefined) {
    try {
      return JSON.parse(`"${match[1]}"`);
    } catch {
      return unescapeJsonString(match[1]);
    }
  }
  if (allowPartial) {
    const partial = new RegExp(`"${escapedKey}"\\s*:\\s*"([^"]*)`, "s");
    const partialMatch = raw.match(partial);
    if (partialMatch?.[1] && partialMatch[1].length > 2) {
      return unescapeJsonString(partialMatch[1]);
    }
  }
  return undefined;
}

function extractWorldContextPartial(raw: string): Partial<StoryWorldContextFields> {
  const wcIdx = raw.indexOf('"worldContext"');
  if (wcIdx < 0) return {};

  const braceIdx = raw.indexOf("{", wcIdx);
  if (braceIdx >= 0) {
    const obj = extractBalancedJson(raw, "{", "}", braceIdx);
    if (obj) {
      try {
        return JSON.parse(obj) as Partial<StoryWorldContextFields>;
      } catch {
        /* fall through to field salvage */
      }
    }
  }

  const slice = raw.slice(wcIdx);
  return {
    framing: extractJsonStringField(slice, "framing", true),
    timeline: extractJsonStringField(slice, "timeline", true),
    place: extractJsonStringField(slice, "place", true),
    yourRole: extractJsonStringField(slice, "yourRole", true),
    mood: extractJsonStringField(slice, "mood", true),
  };
}

export type ParsedWorldResponse = {
  draft: StoryWorldDraft | null;
  recovered: boolean;
};

/** Parse LLM world JSON — tolerates truncated responses and missing nested fields. */
export function parseWorldResponse(raw: string, hero: string): ParsedWorldResponse {
  const cleaned = stripMarkdownFences(raw);
  if (!cleaned) return { draft: null, recovered: false };

  const fromObject = (parsed: Record<string, unknown>, recovered: boolean): ParsedWorldResponse | null => {
    if (isValidWorldDraft(parsed, hero)) {
      return { draft: draftFromParsed(parsed, hero), recovered };
    }
    const title = typeof parsed.title === "string" ? parsed.title : undefined;
    const prologue = typeof parsed.prologue === "string" ? parsed.prologue : undefined;
    if (title && title.length > 3 && prologue && prologue.length > 15) {
      return { draft: draftFromPartial(parsed, hero), recovered: true };
    }
    return null;
  };

  const strategies: (() => ParsedWorldResponse | null)[] = [
    () => {
      try {
        return fromObject(JSON.parse(cleaned) as Record<string, unknown>, false);
      } catch {
        return null;
      }
    },
    () => {
      try {
        const obj = extractBalancedJson(cleaned, "{", "}");
        if (!obj) return null;
        return fromObject(JSON.parse(obj) as Record<string, unknown>, true);
      } catch {
        return null;
      }
    },
    () => {
      const title = extractJsonStringField(cleaned, "title", true);
      const prologue = extractJsonStringField(cleaned, "prologue", true);
      if (!title || title.length <= 3 || !prologue || prologue.length <= 15) return null;

      const wc = extractWorldContextPartial(cleaned);
      return {
        draft: draftFromPartial(
          {
            title,
            prologue,
            setting: extractJsonStringField(cleaned, "setting", true),
            premise: extractJsonStringField(cleaned, "premise", true),
            worldContext: wc,
          },
          hero
        ),
        recovered: true,
      };
    },
  ];

  for (const strategy of strategies) {
    const result = strategy();
    if (result?.draft) return result;
  }

  return { draft: null, recovered: false };
}

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
The hero "${hero}" is the protagonist. Make worldContext.yourRole about them.
Keep all text simple and easy to read — no fancy vocabulary.`;
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

export function draftFromPartial(parsed: Record<string, unknown>, hero: string): StoryWorldDraft {
  const wc = (parsed.worldContext as Partial<StoryWorldContextFields> | undefined) ?? {};
  const title = String(parsed.title || "").trim();
  const prologue = String(parsed.prologue || "").trim();
  const setting = String(parsed.setting || wc.place || "An original setting").trim();
  const premise = String(parsed.premise || "A journey where every choice reveals who you are").trim();

  return {
    title: title.length > 3 ? title : `The Story of ${hero}`,
    prologue:
      prologue.length > 15
        ? prologue
        : `${hero} enters a world only they can navigate — every choice from here shapes who they become.`,
    setting,
    premise,
    worldContext: {
      framing: wc.framing?.trim() || "Fictional",
      timeline: wc.timeline?.trim() || "Present day, several continuous days",
      place: wc.place?.trim() || setting,
      yourRole:
        wc.yourRole?.trim() ||
        `You are ${hero}, the protagonist. Read each moment as if you are living it.`,
      mood: wc.mood?.trim() || "Reflective, uncertain",
    },
  };
}

export function buildMinimalWorldFallback(hero: string, storySeed: string): StoryWorldDraft {
  const e = storyEntropy(storySeed);
  return {
    title: `The Unwritten Chapter of ${hero}`,
    prologue: `${hero} is about to start a story only they can finish. Every choice from here shapes what happens next.`,
    setting: "A place waiting for your decisions to define it",
    premise: "A personal journey where each choice shows who you really are",
    worldContext: {
      framing: "Fictional — invented for you",
      timeline: `Unspecified era, run ${e.nonce.slice(0, 8)}, several continuous days`,
      place: "An original setting defined by your path",
      yourRole: `You are ${hero}. Inhabit this story fully and choose what you would do.`,
      mood: "Open, reflective, unknown",
    },
  };
}
