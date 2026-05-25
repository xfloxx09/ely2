import {
  generateStorySceneArtSvg,
  getGeminiModel,
  type StorySceneInput,
} from "@ely/personality";

export type SketchGenerationDebug = {
  sketchSource: "replicate" | "gemini" | "svg";
  sketchModel?: string;
  sketchFailureReason?: string;
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

async function replicateSketch(prompt: string, token: string): Promise<{ url: string | null; error?: string }> {
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

    if (!response.ok) {
      const detail = await response.text();
      return { url: null, error: `Replicate ${response.status}: ${detail.slice(0, 120)}` };
    }

    const data = (await response.json()) as {
      status?: string;
      output?: string | string[];
      error?: string;
    };

    if (data.status === "failed") {
      return { url: null, error: data.error || "Replicate prediction failed" };
    }

    const output = data.output;
    const url = Array.isArray(output) ? output[0] ?? null : output ?? null;
    return { url, error: url ? undefined : "Replicate returned no image URL" };
  } catch (err) {
    return { url: null, error: err instanceof Error ? err.message : "Replicate request failed" };
  }
}

async function geminiSketch(
  prompt: string,
  apiKey: string,
  _textModel?: string | null
): Promise<{ url: string | null; error?: string }> {
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

    if (!response.ok) {
      const detail = await response.text();
      return { url: null, error: `Gemini image ${response.status}: ${detail.slice(0, 120)}` };
    }

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
        return { url: `data:${mime};base64,${inline.data}` };
      }
    }

    return { url: null, error: "Gemini returned no image data (model may be unavailable on this key)" };
  } catch (err) {
    return { url: null, error: err instanceof Error ? err.message : "Gemini image request failed" };
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
  const errors: string[] = [];

  if (replicateToken) {
    const result = await replicateSketch(prompt, replicateToken);
    if (result.url) {
      return {
        imageUrl: result.url,
        _debug: { sketchSource: "replicate", sketchModel: REPLICATE_SKETCH_MODEL },
      };
    }
    if (result.error) errors.push(result.error);
  }

  if (geminiKey) {
    const result = await geminiSketch(prompt, geminiKey, keys?.geminiModel ?? getGeminiModel());
    if (result.url) {
      return {
        imageUrl: result.url,
        _debug: { sketchSource: "gemini", sketchModel: GEMINI_IMAGE_MODEL },
      };
    }
    if (result.error) errors.push(result.error);
  }

  return {
    imageUrl: generateStorySceneArtSvg(input),
    _debug: {
      sketchSource: "svg",
      sketchModel: "procedural-svg",
      sketchFailureReason: errors.join(" | ") || "No sketch API key configured",
    },
  };
}
