import type { CommunicationProfile } from "@ely/personality";
import { completeElyCore, buildSystemPrompt } from "./ely-core.js";

export type ModuleContext = {
  userId: string;
  profile: CommunicationProfile;
  preferences?: Record<string, unknown>;
};

export async function handleConcierge(
  message: string,
  ctx: ModuleContext
): Promise<{ response: string; metadata: Record<string, unknown> }> {
  const bufferMinutes = (ctx.preferences?.bufferTimeMinutes as number) || 5;
  const systemPrompt = buildSystemPrompt(ctx.profile) +
    `\n\nYou are in CONCIERGE mode. Help with scheduling, reminders, and day planning. Add ${bufferMinutes} minute buffers between events for this user.`;

  const response = await completeElyCore(
    [{ role: "user", content: message }],
    systemPrompt
  );

  return { response, metadata: { module: "CONCIERGE", bufferMinutes } };
}

export async function handleScribe(
  message: string,
  ctx: ModuleContext,
  toneIntensity = 0.7
): Promise<{ response: string; metadata: Record<string, unknown> }> {
  const systemPrompt = buildSystemPrompt(ctx.profile) +
    `\n\nYou are in SCRIBE mode. Draft emails, posts, and messages. Tone intensity: ${toneIntensity} (0=neutral, 1=full personality).`;

  const response = await completeElyCore(
    [{ role: "user", content: message }],
    systemPrompt
  );

  return { response, metadata: { module: "SCRIBE", toneIntensity } };
}

export async function handleKitchenBrain(
  message: string,
  ctx: ModuleContext
): Promise<{ response: string; metadata: Record<string, unknown> }> {
  const systemPrompt = buildSystemPrompt(ctx.profile) +
    `\n\nYou are in KITCHEN BRAIN mode. Help with meal planning, recipes, and shopping lists. Consider dietary preferences mentioned. Format shopping lists clearly.`;

  const response = await completeElyCore(
    [{ role: "user", content: message }],
    systemPrompt
  );

  return { response, metadata: { module: "KITCHEN_BRAIN" } };
}

export async function handleHabitArchitect(
  message: string,
  ctx: ModuleContext
): Promise<{ response: string; metadata: Record<string, unknown> }> {
  const coachingStyle = ctx.preferences?.coachingStyle || "balanced";
  const systemPrompt = buildSystemPrompt(ctx.profile) +
    `\n\nYou are in HABIT ARCHITECT mode. Coaching style: ${coachingStyle}. Help set goals, track habits, and provide accountability.`;

  const response = await completeElyCore(
    [{ role: "user", content: message }],
    systemPrompt
  );

  return { response, metadata: { module: "HABIT_ARCHITECT", coachingStyle } };
}

export async function handleResearcher(
  message: string,
  ctx: ModuleContext
): Promise<{ response: string; metadata: Record<string, unknown> }> {
  const depth = ctx.preferences?.researchDepth || "practical";
  const systemPrompt = buildSystemPrompt(ctx.profile) +
    `\n\nYou are in RESEARCHER mode. Research depth: ${depth}. Summarize topics, provide citations where possible, and teach micro-lessons.`;

  const response = await completeElyCore(
    [{ role: "user", content: message }],
    systemPrompt
  );

  return { response, metadata: { module: "RESEARCHER", depth } };
}

export async function handleMoneyScout(
  message: string,
  ctx: ModuleContext
): Promise<{ response: string; metadata: Record<string, unknown> }> {
  const systemPrompt = buildSystemPrompt(ctx.profile) +
    `\n\nYou are in MONEY SCOUT mode. Analyze spending patterns without judgment. Suggest budgets and savings opportunities. Be supportive, never shaming.`;

  const response = await completeElyCore(
    [{ role: "user", content: message }],
    systemPrompt
  );

  return { response, metadata: { module: "MONEY_SCOUT" } };
}

export const moduleHandlers: Record<
  string,
  (message: string, ctx: ModuleContext) => Promise<{ response: string; metadata: Record<string, unknown> }>
> = {
  CONCIERGE: handleConcierge,
  SCRIBE: handleScribe,
  KITCHEN_BRAIN: handleKitchenBrain,
  HABIT_ARCHITECT: handleHabitArchitect,
  RESEARCHER: handleResearcher,
  MONEY_SCOUT: handleMoneyScout,
};
