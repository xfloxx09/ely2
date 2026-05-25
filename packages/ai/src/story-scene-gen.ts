import {
  generateStorySceneArtSvg,
  getGeminiModel,
  type StorySceneInput,
} from "@ely/personality";

export type SketchGenerationDebug = {
  sketchSource: "replicate" | "gemini" | "svg";
  sketchModel?: string;
};

export type StorySceneKeys = {
  replicateToken?: string | null;
  geminiKey?: string | null;
  geminiModel?: string | null;
};

export type StorySceneResult = {
  imageUrl: string;
  _debug: SketchGenerationDebug;
};

const GEMINI_IMAGE_MODEL = "gemini-2.0-flash-preview-image-generation";
const REPLICATE_SKETCH_MODEL = "black-forest-labs/flux-schnell";

function buildSketchPrompt(input: StorySceneInput): string {
  const mood =
    input.answerValue === undefined
      ? "contemplative"
      : input.answerValue >= 4
        ? "hopeful and bright"
        : input.answerValue <= 2
          ? "tense and shadowed"
          : "balanced";

  return [
    "Hand-drawn pencil sketch illustration on textured cream paper.",
    "Graphite crosshatching, storybook concept art, cinematic composition.",
    `Scene: ${input.scenePrompt}.`,
    `Setting: ${input.setting}.`,
    `Chapter ${input.chapter} — ${input.chapterTitle}.`,
    `Story moment: ${input.narrative.slice(0, 200)}.`,
    `Mood: ${mood}.`,
    "Single frame from a continuous adventure, no text, no words, no letters, no watermark, no signature.",
  ].join(" ");
}

async function replicateSketch(prompt: string, token: string): Promise<string | null> {
  try {
    const response = await fetch(
      `https://api.replicate.com/v1/models/${REPLICATE_SKETCH_MODEL}/predictions`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
          Prefer: "wait=60",
        },
        body: JSON.stringify({
          input: {
            prompt,
            aspect_ratio: "4:5",
            output_format: "webp",
            output_quality: 85,
            num_outputs: 1,
          },
        }),
      }
    );

    if (!response.ok) return null;

    const data = (await response.json()) as {
      status?: string;
      output?: string | string[];
    };

    if (data.status === "failed") return null;

    const output = data.output;
    if (Array.isArray(output)) return output[0] ?? null;
    return output ?? null;
  } catch {
    return null;
  }
}

async function geminiSketch(
  prompt: string,
  apiKey: string,
  _textModel?: string | null
): Promise<string | null> {
  void _textModel;
  try {
    const url = `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_IMAGE_MODEL}:generateContent?key=${apiKey}`;

    const response = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        contents: [{ parts: [{ text: prompt }] }],
        generationConfig: {
          responseModalities: ["IMAGE", "TEXT"],
        },
      }),
    });

    if (!response.ok) return null;

    const data = (await response.json()) as {
      candidates?: {
        content?: {
          parts?: { inlineData?: { mimeType?: string; data?: string } }[];
        };
      }[];
    };

    const parts = data.candidates?.[0]?.content?.parts ?? [];
    for (const part of parts) {
      const inline = part.inlineData;
      if (inline?.data) {
        const mime = inline.mimeType || "image/png";
        return `data:${mime};base64,${inline.data}`;
      }
    }

    return null;
  } catch {
    return null;
  }
}

export function resolveSketchCapabilities(keys?: StorySceneKeys): SketchGenerationDebug {
  const replicate = keys?.replicateToken ?? process.env.REPLICATE_API_TOKEN;
  const gemini = keys?.geminiKey ?? process.env.GEMINI_API_KEY;

  if (replicate) {
    return { sketchSource: "replicate", sketchModel: REPLICATE_SKETCH_MODEL };
  }
  if (gemini) {
    return { sketchSource: "gemini", sketchModel: GEMINI_IMAGE_MODEL };
  }
  return { sketchSource: "svg", sketchModel: "procedural-svg" };
}

export async function generateStorySceneImage(
  input: StorySceneInput,
  keys?: StorySceneKeys
): Promise<StorySceneResult> {
  const prompt = buildSketchPrompt(input);
  const replicateToken = keys?.replicateToken ?? process.env.REPLICATE_API_TOKEN;
  const geminiKey = keys?.geminiKey ?? process.env.GEMINI_API_KEY;

  if (replicateToken) {
    const url = await replicateSketch(prompt, replicateToken);
    if (url) {
      return {
        imageUrl: url,
        _debug: { sketchSource: "replicate", sketchModel: REPLICATE_SKETCH_MODEL },
      };
    }
  }

  if (geminiKey) {
    const url = await geminiSketch(prompt, geminiKey, keys?.geminiModel ?? getGeminiModel());
    if (url) {
      return {
        imageUrl: url,
        _debug: { sketchSource: "gemini", sketchModel: GEMINI_IMAGE_MODEL },
      };
    }
  }

  return {
    imageUrl: generateStorySceneArtSvg(input),
    _debug: { sketchSource: "svg", sketchModel: "procedural-svg" },
  };
}
