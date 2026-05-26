import { sql } from "drizzle-orm";
import { getDb, ensureStorySessionTable } from "@ely/db";
import {
  createStorySeed,
  generateStoryJourney,
  storyRerollLimitForTier,
  type StoryJourney,
} from "@ely/personality";
import type { LlmKeySource } from "@ely/personality";

/** Bump when story generation logic changes — invalidates cached onboarding drafts. */
export const STORY_ENGINE_VERSION = 3;

export type StoryDraft = StoryJourney & {
  id: string;
  createdAt: string;
  engineVersion?: number;
};

export type StoryDraftSummary = {
  id: string;
  title: string;
  prologue: string;
  setting: string;
  framing: string;
  createdAt: string;
};

export type StorySessionMeta = {
  drafts: StoryDraftSummary[];
  selectedDraftId: string | null;
  rerollsUsed: number;
  rerollsRemaining: number;
  maxRerolls: number;
  tier: string;
};

type StorySessionRow = {
  user_id: string;
  rerolls_used: number;
  selected_draft_id: string | null;
  drafts: StoryDraft[];
};

function summarizeDraft(draft: StoryDraft): StoryDraftSummary {
  return {
    id: draft.id,
    title: draft.title,
    prologue: draft.prologue,
    setting: draft.setting,
    framing: draft.worldContext?.framing ?? draft.setting,
    createdAt: draft.createdAt,
  };
}

function sessionMeta(
  tier: string,
  drafts: StoryDraft[],
  rerollsUsed: number,
  selectedDraftId: string | null
): StorySessionMeta {
  const maxRerolls = storyRerollLimitForTier(tier);
  return {
    drafts: drafts.map(summarizeDraft),
    selectedDraftId,
    rerollsUsed,
    rerollsRemaining: Math.max(0, maxRerolls - rerollsUsed),
    maxRerolls,
    tier,
  };
}

async function loadSession(userId: string): Promise<StorySessionRow | null> {
  await ensureStorySessionTable();
  const db = getDb();
  const rows = await db.execute<StorySessionRow>(sql`
    SELECT user_id, rerolls_used, selected_draft_id, drafts
    FROM personality_story_sessions
    WHERE user_id = ${userId}
    LIMIT 1
  `);
  return rows[0] ?? null;
}

async function saveSession(
  userId: string,
  rerollsUsed: number,
  selectedDraftId: string | null,
  drafts: StoryDraft[]
): Promise<void> {
  const db = getDb();
  await db.execute(sql`
    INSERT INTO personality_story_sessions (user_id, rerolls_used, selected_draft_id, drafts, updated_at)
    VALUES (${userId}, ${rerollsUsed}, ${selectedDraftId}, ${JSON.stringify(drafts)}::jsonb, now())
    ON CONFLICT (user_id) DO UPDATE SET
      rerolls_used = EXCLUDED.rerolls_used,
      selected_draft_id = EXCLUDED.selected_draft_id,
      drafts = EXCLUDED.drafts,
      updated_at = now()
  `);
}

function toDraft(story: StoryJourney, draftId: string): StoryDraft {
  const { _debug, ...rest } = story;
  return {
    ...rest,
    id: draftId,
    createdAt: new Date().toISOString(),
    engineVersion: STORY_ENGINE_VERSION,
    _debug,
  };
}

function draftsAreCurrent(drafts: StoryDraft[]): boolean {
  return drafts.length > 0 && drafts.every((d) => (d.engineVersion ?? 0) >= STORY_ENGINE_VERSION);
}

function stripDraftForClient(draft: StoryDraft): StoryJourney {
  const { id: _id, createdAt: _createdAt, ...story } = draft;
  return story;
}

export async function getStorySessionForUser(userId: string, tier: string): Promise<StorySessionMeta> {
  const row = await loadSession(userId);
  const drafts = row?.drafts ?? [];
  return sessionMeta(tier, drafts, row?.rerolls_used ?? 0, row?.selected_draft_id ?? null);
}

export async function selectStoryDraft(userId: string, tier: string, draftId: string) {
  const row = await loadSession(userId);
  if (!row?.drafts?.length) {
    throw new Error("No story drafts found");
  }

  const draft = row.drafts.find((d) => d.id === draftId);
  if (!draft) {
    throw new Error("Story draft not found");
  }

  await saveSession(userId, row.rerolls_used, draftId, row.drafts);
  return {
    story: stripDraftForClient(draft),
    session: sessionMeta(tier, row.drafts, row.rerolls_used, draftId),
  };
}

export async function generateStoryForUser(
  userId: string,
  userName: string | undefined,
  tier: string,
  llmKeys: LlmKeySource | undefined,
  options?: { reroll?: boolean }
): Promise<{ story: StoryJourney; session: StorySessionMeta }> {
  await ensureStorySessionTable();

  const maxRerolls = storyRerollLimitForTier(tier);
  const existing = await loadSession(userId);
  let drafts = existing?.drafts ?? [];
  let rerollsUsed = existing?.rerolls_used ?? 0;

  if (drafts.length > 0 && !draftsAreCurrent(drafts)) {
    drafts = [];
    rerollsUsed = 0;
    await saveSession(userId, 0, null, []);
  }

  if (options?.reroll) {
    if (rerollsUsed >= maxRerolls) {
      const err = new Error("No rerolls remaining") as Error & { session?: StorySessionMeta };
      err.session = sessionMeta(tier, drafts, rerollsUsed, existing?.selected_draft_id ?? null);
      throw err;
    }

    const storySeed = createStorySeed();
    const story = await generateStoryJourney(userId, userName, llmKeys, { storySeed });
    const draft = toDraft(story, storySeed.slice(0, 8));
    const nextDrafts = [...drafts, draft];
    const nextRerollsUsed = rerollsUsed + 1;

    await saveSession(userId, nextRerollsUsed, draft.id, nextDrafts);

    return {
      story,
      session: sessionMeta(tier, nextDrafts, nextRerollsUsed, draft.id),
    };
  }

  if (drafts.length > 0) {
    const selectedId = existing?.selected_draft_id ?? drafts[drafts.length - 1]!.id;
    const draft = drafts.find((d) => d.id === selectedId) ?? drafts[drafts.length - 1]!;
    return {
      story: stripDraftForClient(draft),
      session: sessionMeta(tier, drafts, rerollsUsed, draft.id),
    };
  }

  const storySeed = createStorySeed();
  const story = await generateStoryJourney(userId, userName, llmKeys, { storySeed });
  const draft = toDraft(story, storySeed.slice(0, 8));
  const nextDrafts = [draft];

  await saveSession(userId, 0, draft.id, nextDrafts);

  return {
    story,
    session: sessionMeta(tier, nextDrafts, 0, draft.id),
  };
}
