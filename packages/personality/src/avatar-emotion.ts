export type AvatarEmotion =
  | "idle"
  | "thinking"
  | "listening"
  | "happy"
  | "curious"
  | "empathetic"
  | "excited"
  | "concerned";

const EMOTION_PATTERNS: [AvatarEmotion, RegExp][] = [
  ["excited", /\b(wonderful|amazing|fantastic|great news|congrat|let's go|awesome)\b/i],
  ["happy", /\b(glad|happy|delighted|smile|joy|love that|perfect)\b/i],
  ["empathetic", /\b(sorry|understand|hear you|tough|difficult|here for you|support)\b/i],
  ["concerned", /\b(worry|caution|careful|risk|problem|issue|unfortunately)\b/i],
  ["curious", /\b(wonder|curious|what if|tell me|how about|interesting question)\b/i],
];

export function inferAvatarEmotion(text: string, state?: string): AvatarEmotion {
  if (state === "thinking") return "thinking";
  if (state === "listening") return "listening";

  const sample = text.slice(0, 500);
  for (const [emotion, pattern] of EMOTION_PATTERNS) {
    if (pattern.test(sample)) return emotion;
  }

  if (text.includes("?")) return "curious";
  if (text.includes("!")) return "excited";
  return "idle";
}

export function emotionMotion(emotion: AvatarEmotion): {
  scale: number[];
  y: number[];
  rotate: number[];
} {
  switch (emotion) {
    case "thinking":
      return { scale: [1, 1.02, 1], y: [0, -2, 0], rotate: [0, -1, 0] };
    case "listening":
      return { scale: [1, 1.03, 1], y: [0, 1, 0], rotate: [0, 1, 0] };
    case "happy":
      return { scale: [1, 1.05, 1], y: [0, -4, 0], rotate: [0, 2, 0] };
    case "excited":
      return { scale: [1, 1.08, 1], y: [0, -6, 0], rotate: [0, -2, 2, 0] };
    case "curious":
      return { scale: [1, 1.04, 1], y: [0, -3, 0], rotate: [0, 3, -3, 0] };
    case "empathetic":
      return { scale: [1, 1.02, 1], y: [0, 2, 0], rotate: [0, -1, 1, 0] };
    case "concerned":
      return { scale: [1, 0.98, 1], y: [0, 3, 0], rotate: [0, -2, 0] };
    default:
      return { scale: [1, 1.01, 1], y: [0, -1, 0], rotate: [0, 0.5, 0] };
  }
}
