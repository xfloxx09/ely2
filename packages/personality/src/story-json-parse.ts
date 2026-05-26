type BeatLike = {
  id?: number;
  bfiId: number;
  trait?: string;
  chapter?: number;
  chapterTitle?: string;
  narrative?: string;
  question?: string;
  choices?: { label: string; value: number }[];
  scenePrompt?: string;
};

function stripMarkdownFences(text: string): string {
  return text
    .trim()
    .replace(/^```(?:json)?\s*/i, "")
    .replace(/\s*```\s*$/i, "")
    .trim();
}

/** Extract a balanced {...} or [...] substring starting at startIdx (or first opener). */
export function extractBalancedJson(
  text: string,
  open: "{" | "[",
  close: "}" | "]",
  startIdx?: number
): string | null {
  const start = startIdx ?? text.indexOf(open);
  if (start < 0) return null;

  let depth = 0;
  let inString = false;
  let escape = false;

  for (let i = start; i < text.length; i++) {
    const c = text[i]!;
    if (inString) {
      if (escape) escape = false;
      else if (c === "\\") escape = true;
      else if (c === '"') inString = false;
      continue;
    }
    if (c === '"') {
      inString = true;
      continue;
    }
    if (c === open) depth++;
    if (c === close) {
      depth--;
      if (depth === 0) return text.slice(start, i + 1);
    }
  }
  return null;
}

function extractBeatsFromParsed(parsed: Record<string, unknown>): BeatLike[] {
  const direct = [parsed.beats, parsed.storyBeats, parsed.items];
  for (const candidate of direct) {
    if (Array.isArray(candidate) && candidate.length) {
      return candidate as BeatLike[];
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
      return val as BeatLike[];
    }
  }
  return [];
}

function salvageBeatObjects(text: string): BeatLike[] {
  const beatsKey = text.indexOf('"beats"');
  const searchFrom = beatsKey >= 0 ? beatsKey : 0;
  const arrStart = text.indexOf("[", searchFrom);
  if (arrStart < 0) return [];

  const beats: BeatLike[] = [];
  let i = arrStart + 1;

  while (i < text.length) {
    while (i < text.length && /[\s,]/.test(text[i]!)) i++;
    if (i >= text.length || text[i] === "]") break;
    if (text[i] !== "{") break;

    const obj = extractBalancedJson(text, "{", "}", i);
    if (!obj) break;

    try {
      const beat = JSON.parse(obj) as BeatLike;
      if (typeof beat.bfiId === "number" && beat.narrative) {
        beats.push(beat);
      }
    } catch {
      /* skip malformed beat object */
    }
    i += obj.length;
  }

  return beats;
}

export type ParsedStoryResponse = {
  beats: BeatLike[];
  recovered: boolean;
};

function beatsFromJsonText(text: string): BeatLike[] | null {
  const parsed = JSON.parse(text) as Record<string, unknown>;
  const beats = extractBeatsFromParsed(parsed);
  return beats.length ? beats : null;
}

/** Parse LLM story JSON — tolerates trailing text, markdown fences, and truncated beat arrays. */
export function parseStoryResponse(raw: string): ParsedStoryResponse {
  const cleaned = stripMarkdownFences(raw);
  if (!cleaned) return { beats: [], recovered: false };

  const attempts: { run: () => BeatLike[] | null; salvaged: boolean }[] = [
    {
      run: () => {
        const obj = extractBalancedJson(cleaned, "{", "}");
        if (!obj) return null;
        return beatsFromJsonText(obj);
      },
      salvaged: false,
    },
    {
      run: () => beatsFromJsonText(cleaned),
      salvaged: false,
    },
    {
      run: () => {
        const salvaged = salvageBeatObjects(cleaned);
        return salvaged.length ? salvaged : null;
      },
      salvaged: true,
    },
  ];

  for (const attempt of attempts) {
    try {
      const beats = attempt.run();
      if (beats?.length) {
        return { beats, recovered: attempt.salvaged };
      }
    } catch {
      /* try next strategy */
    }
  }

  throw new Error(`Invalid story JSON (${cleaned.slice(0, 120).replace(/\s+/g, " ")}…)`);
}
