import { createCipheriv, createDecipheriv, randomBytes, scryptSync } from "crypto";
import type { TraitScores } from "./bfi2.js";

function getKey(): Buffer {
  const secret = process.env.PERSONALITY_ENCRYPTION_KEY || "dev-key-change-in-production-32b";
  return scryptSync(secret, "ely-salt", 32);
}

export function encryptScores(scores: TraitScores): string {
  const key = getKey();
  const iv = randomBytes(16);
  const cipher = createCipheriv("aes-256-gcm", key, iv);
  const encrypted = Buffer.concat([
    cipher.update(JSON.stringify(scores), "utf8"),
    cipher.final(),
  ]);
  const tag = cipher.getAuthTag();
  return Buffer.concat([iv, tag, encrypted]).toString("base64");
}

export function decryptScores(encrypted: string): TraitScores {
  const key = getKey();
  const buf = Buffer.from(encrypted, "base64");
  const iv = buf.subarray(0, 16);
  const tag = buf.subarray(16, 32);
  const data = buf.subarray(32);
  const decipher = createDecipheriv("aes-256-gcm", key, iv);
  decipher.setAuthTag(tag);
  const decrypted = Buffer.concat([decipher.update(data), decipher.final()]);
  return JSON.parse(decrypted.toString("utf8")) as TraitScores;
}

export type CommunicationProfile = {
  styleSummary: string;
  systemPromptAddendum: string;
  preferences: Record<string, unknown>;
};

export function buildCommunicationProfile(scores: TraitScores): CommunicationProfile {
  const traits: string[] = [];
  const instructions: string[] = [];

  if (scores.openness >= 60) {
    traits.push("creative and open-minded");
    instructions.push("Use creative, metaphorical language. Suggest novel ideas and unconventional approaches.");
  } else if (scores.openness <= 40) {
    instructions.push("Keep suggestions practical and grounded. Avoid overly abstract language.");
  }

  if (scores.conscientiousness >= 60) {
    traits.push("organized and detail-oriented");
    instructions.push("Provide structured, detailed, and organized responses with clear action steps.");
  } else if (scores.conscientiousness <= 40) {
    instructions.push("Keep responses concise and flexible. Don't overwhelm with too much structure.");
  }

  if (scores.extraversion >= 60) {
    traits.push("warm and energetic");
    instructions.push("Be warm, energetic, and engaging. Include frequent check-ins and enthusiastic encouragement.");
  } else if (scores.extraversion <= 40) {
    instructions.push("Be calm and respectful of their space. Avoid excessive enthusiasm or frequent check-ins.");
  }

  if (scores.agreeableness >= 60) {
    traits.push("empathetic and supportive");
    instructions.push("Be empathetic, supportive, and gentle. Prioritize emotional validation.");
  } else if (scores.agreeableness <= 40) {
    instructions.push("Be direct and honest. Focus on facts over emotional validation.");
  }

  if (scores.neuroticism >= 60) {
    traits.push("needs reassurance");
    instructions.push("Provide extra reassurance. Use calm, stable pacing. Acknowledge concerns without amplifying anxiety. Add buffer time for scheduling.");
  } else if (scores.neuroticism <= 40) {
    instructions.push("They handle stress well. You can be more direct and challenge them appropriately.");
  }

  const styleSummary = traits.length > 0
    ? `This user is ${traits.join(", ")}. Adapt your communication accordingly.`
    : "This user has balanced personality traits. Use a neutral, adaptable communication style.";

  const systemPromptAddendum = instructions.join(" ");

  return {
    styleSummary,
    systemPromptAddendum,
    preferences: {
      bufferTimeMinutes: scores.neuroticism >= 60 ? 15 : 5,
      coachingStyle: scores.extraversion >= 60 ? "cheerleader" : "quiet_accountability",
      researchDepth: scores.openness >= 60 ? "deep" : "practical",
      toneIntensity: 0.7,
    },
  };
}

export function getNeutralProfile(): CommunicationProfile {
  return {
    styleSummary: "Neutral default persona with no personality adaptation.",
    systemPromptAddendum: "Use a friendly, helpful, and neutral tone. Be concise and practical.",
    preferences: { bufferTimeMinutes: 5, coachingStyle: "balanced", researchDepth: "practical", toneIntensity: 0.5 },
  };
}
