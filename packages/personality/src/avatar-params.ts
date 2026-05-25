import type { TraitScores } from "./bfi2.js";

export type AvatarVisualParams = {
  smileFrequency: number;
  eyeSparkle: number;
  hairColorFlair: string;
  artisticAccessories: string[];
  facialSoftness: number;
  symmetry: number;
  cleanLines: boolean;
  calmPosture: boolean;
  steadyGaze: boolean;
  backgroundStyle: string;
  colorPalette: string[];
  prompt: string;
};

export function mapTraitsToAvatarParams(scores: TraitScores): AvatarVisualParams {
  const extraversion = scores.extraversion / 100;
  const openness = scores.openness / 100;
  const agreeableness = scores.agreeableness / 100;
  const conscientiousness = scores.conscientiousness / 100;
  const neuroticism = scores.neuroticism / 100;

  const hairColors = ["natural brown", "warm auburn", "creative purple", "artistic teal", "sunset orange"];
  const hairIndex = Math.min(Math.floor(openness * hairColors.length), hairColors.length - 1);

  const accessories: string[] = [];
  if (openness > 0.6) accessories.push("artistic ear cuff", "creative pendant");
  if (conscientiousness > 0.6) accessories.push("minimalist watch");
  if (agreeableness > 0.6) accessories.push("soft scarf");

  const bgStyles = ["abstract gradient", "cosmic nebula", "zen garden", "geometric patterns", "warm studio"];
  const bgIndex = Math.min(Math.floor(openness * bgStyles.length), bgStyles.length - 1);

  const params: AvatarVisualParams = {
    smileFrequency: 0.3 + extraversion * 0.5,
    eyeSparkle: extraversion * 0.8,
    hairColorFlair: hairColors[hairIndex]!,
    artisticAccessories: accessories,
    facialSoftness: 0.3 + agreeableness * 0.5,
    symmetry: 0.5 + conscientiousness * 0.4,
    cleanLines: conscientiousness > 0.5,
    calmPosture: neuroticism > 0.5,
    steadyGaze: neuroticism > 0.4,
    backgroundStyle: bgStyles[bgIndex]!,
    colorPalette: openness > 0.6
      ? ["#6366f1", "#8b5cf6", "#06b6d4"]
      : ["#1e293b", "#334155", "#475569"],
    prompt: "",
  };

  params.prompt = buildAvatarPrompt(params, scores);
  return params;
}

function buildAvatarPrompt(params: AvatarVisualParams, scores: TraitScores): string {
  const features: string[] = [
    "portrait of a friendly AI companion avatar",
    "upper body visible",
    "digital art style",
    "soft lighting",
  ];

  if (params.facialSoftness > 0.6) features.push("soft kind facial features");
  if (params.smileFrequency > 0.6) features.push("warm expressive smile");
  if (params.eyeSparkle > 0.5) features.push("sparkling expressive eyes");
  if (params.cleanLines) features.push("symmetrical clean appearance");
  if (params.calmPosture) features.push("calm relaxed posture");
  if (params.steadyGaze) features.push("steady confident gaze");

  features.push(`${params.hairColorFlair} hair`);
  if (params.artisticAccessories.length) {
    features.push(`wearing ${params.artisticAccessories.join(" and ")}`);
  }
  features.push(`${params.backgroundStyle} background`);
  features.push("high quality, professional, approachable");

  return features.join(", ");
}

export function getEvolutionChanges(milestone: string): Record<string, unknown> {
  const changes: Record<string, Record<string, unknown>> = {
    "100_conversations": { newExpression: "knowing_smile", evolutionLevel: 2 },
    "500_tasks": { backgroundDetail: "memory_orbs", evolutionLevel: 3 },
    "30_day_streak": { accessory: "streak_glow", evolutionLevel: 2 },
    "level_10": { refinement: "enhanced_details", evolutionLevel: 4 },
  };
  return changes[milestone] ?? { evolutionLevel: 1 };
}
