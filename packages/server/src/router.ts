import { eq } from "drizzle-orm";
import { getDb, users, subscriptions, elyCredits, creditTransactions, affiliates } from "@ely/db";
import { BFI2_SHORT, BFI2_LONG } from "@ely/personality";
import {
  generateStoryJourney,
  partialScoresFromResponses,
  generateAvatarSilhouetteSvg,
} from "@ely/personality";
import { generateStorySceneImage, resolveSketchCapabilities } from "@ely/ai";
import {
  registerUser,
  loginUser,
  getUserById,
  toPublicUser,
  submitPersonalityTest,
  getPersonalityProfile,
  getOrCreateConversation,
  getConversationMessages,
  getAffiliateDashboard,
  enrollUserAsAffiliate,
  getGamificationStats,
  getAvatarBoutique,
  getUserAvatar,
  saveApiKey,
  getIncomeDisclosures,
  generateUserAvatar,
} from "./services.js";
import {
  generateStoryForUser,
  getStorySessionForUser,
  selectStoryDraft,
} from "./story-session.js";
import {
  createCheckoutSession,
  createCreditCheckout,
  createPortalSession,
  createConnectAccount,
  createConnectOnboardingLink,
  STRIPE_PRICES,
  CREDIT_PACKS,
  getStripe,
} from "./stripe.js";
import { createSession, getSessionUser, getAuthToken, getAppUrl } from "./session.js";
import { handleChatMessage } from "./chat-handler.js";
import {
  getAdminPlatformSettings,
  updateAdminPlatformSettings,
  getPlatformConfig,
  toLlmKeySource,
} from "./platform-config.js";
import {
  getCommunityUsers,
  getCommunityLeaderboard,
  startDirectMessage,
  listMySocialConversations,
  getSocialConversation,
  sendDirectMessage,
  startAiPersonaBattle,
  getUserPublicCard,
  AI_BATTLE_TOPICS,
  getConversationInbox,
  getUnreadConversationCount,
  markConversationRead,
  archiveConversation,
  unarchiveConversation,
  deleteConversationForUser,
  setConversationFolder,
  listConversationFolders,
  createConversationFolder,
  updateConversationFolder,
  deleteConversationFolder,
  exportConversationTxt,
  startGroupDirectMessage,
  addGroupParticipants,
  startGroupAiPersonaBattle,
} from "./social-service.js";

type ApiRequest = {
  method: string;
  path: string;
  body?: unknown;
  authHeader?: string | null;
};

const PUBLIC_PATHS = [
  "/health",
  "/auth/register",
  "/auth/login",
  "/personality/questions",
  "/legal/income-disclosure",
];

function pathOnly(fullPath: string): string {
  return fullPath.split("?")[0] || fullPath;
}

function queryParams(fullPath: string): URLSearchParams {
  const q = fullPath.includes("?") ? fullPath.slice(fullPath.indexOf("?") + 1) : "";
  return new URLSearchParams(q);
}

function parseConversationPath(fullPath: string): { id: string; action: string | null } | null {
  const base = pathOnly(fullPath);
  const m = base.match(/^\/community\/conversation\/([^/]+)(?:\/(.+))?$/);
  if (!m) return null;
  return { id: m[1]!, action: m[2] || null };
}

export async function handleApiRequest(req: ApiRequest): Promise<{ status: number; body: unknown }> {
  const { method, path, body, authHeader } = req;
  const token = getAuthToken(authHeader ?? null);
  const userId = await getSessionUser(token);
  const isPublic = PUBLIC_PATHS.some((p) => path === p || path.startsWith(p + "?"));

  if (!isPublic && !path.startsWith("/webhooks") && !userId) {
    return { status: 401, body: { error: "Unauthorized" } };
  }

  const appUrl = getAppUrl();

  try {
    if (method === "GET" && path === "/health") {
      return { status: 200, body: { status: "ok", service: "ely-api" } };
    }

    if (method === "POST" && path === "/auth/register") {
      const { email, password, name, referralCode } = body as {
        email: string;
        password: string;
        name?: string;
        referralCode?: string;
      };
      const user = await registerUser(email, password, name, referralCode);
      const sessionToken = await createSession(user.id);
      return { status: 200, body: { user, token: sessionToken } };
    }

    if (method === "POST" && path === "/auth/login") {
      const { email, password } = body as { email: string; password: string };
      const user = await loginUser(email, password);
      const sessionToken = await createSession(user.id);
      return { status: 200, body: { user, token: sessionToken } };
    }

    if (method === "GET" && path === "/auth/me") {
      const user = await getUserById(userId!);
      if (!user) return { status: 404, body: { error: "User not found" } };
      return { status: 200, body: { user: toPublicUser(user) } };
    }

    if (method === "POST" && path === "/personality/story/generate") {
      const user = await getUserById(userId!);
      const platformConfig = await getPlatformConfig();
      const llmKeys = toLlmKeySource(platformConfig);
      const reroll = (body as { reroll?: boolean } | undefined)?.reroll === true;

      try {
        const { story, session } = await generateStoryForUser(
          userId!,
          user?.name || undefined,
          user?.tier ?? "FREE",
          llmKeys,
          { reroll }
        );
        const sketchConfigured = resolveSketchCapabilities({
          replicateToken: platformConfig.replicateApiToken,
          geminiKey: platformConfig.geminiApiKey,
          geminiModel: platformConfig.geminiModel,
        });
        return {
          status: 200,
          body: {
            ...story,
            session,
            _debug: {
              ...story._debug,
              sketchConfigured,
            },
          },
        };
      } catch (err) {
        const message = err instanceof Error ? err.message : "Story generation failed";
        if (message === "No rerolls remaining") {
          const session = (err as Error & { session?: Awaited<ReturnType<typeof getStorySessionForUser>> }).session
            ?? (await getStorySessionForUser(userId!, user?.tier ?? "FREE"));
          return { status: 403, body: { error: message, session } };
        }
        throw err;
      }
    }

    if (method === "GET" && path === "/personality/story/session") {
      const user = await getUserById(userId!);
      const session = await getStorySessionForUser(userId!, user?.tier ?? "FREE");
      return { status: 200, body: session };
    }

    if (method === "POST" && path === "/personality/story/select") {
      const user = await getUserById(userId!);
      const { draftId } = body as { draftId: string };
      if (!draftId) return { status: 400, body: { error: "draftId required" } };
      try {
        const result = await selectStoryDraft(userId!, user?.tier ?? "FREE", draftId);
        return { status: 200, body: result };
      } catch (err) {
        const message = err instanceof Error ? err.message : "Could not select story";
        return { status: 404, body: { error: message } };
      }
    }

    if (method === "POST" && path === "/personality/story/preview") {
      const { responses, beats, beatIndex } = body as {
        responses: Record<number, number>;
        beats: { bfiId: number; trait: string }[];
        beatIndex: number;
      };
      const partial = partialScoresFromResponses(responses, beats as import("@ely/personality").StoryBeat[]);
      const progress = beats.length ? (beatIndex + 1) / beats.length : 0;
      const blur = Math.max(4, 40 - progress * 36);
      const avatarPreview = generateAvatarSilhouetteSvg(partial, blur);
      return { status: 200, body: { avatarPreview, partial, blur, progress } };
    }

    if (method === "POST" && path === "/personality/story/scene") {
      const bodyData = body as {
        scenePrompt: string;
        seed: number;
        answerValue?: number;
        choiceLabel?: string;
        beatIndex?: number;
        totalBeats?: number;
        chapter?: number;
        chapterTitle?: string;
        narrative?: string;
        setting?: string;
        heroName?: string;
      };
      const platformConfig = await getPlatformConfig();
      const sceneInput = {
        beatIndex: bodyData.beatIndex ?? 0,
        totalBeats: bodyData.totalBeats ?? 30,
        chapter: bodyData.chapter ?? 1,
        chapterTitle: bodyData.chapterTitle ?? "The Journey",
        narrative: bodyData.narrative ?? bodyData.scenePrompt,
        setting: bodyData.setting ?? bodyData.scenePrompt,
        heroName: bodyData.heroName ?? "Traveler",
        scenePrompt: bodyData.scenePrompt,
        answerValue: bodyData.answerValue,
        choiceLabel: bodyData.choiceLabel,
        seed: bodyData.seed ?? Date.now(),
      };
      const result = await generateStorySceneImage(sceneInput, {
        replicateToken: platformConfig.replicateApiToken,
        geminiKey: platformConfig.geminiApiKey,
        geminiModel: platformConfig.geminiModel,
      });
      return { status: 200, body: { imageUrl: result.imageUrl, _debug: result._debug } };
    }

    if (method === "GET" && path.startsWith("/personality/questions")) {
      const type = path.includes("type=long") ? "long" : "short";
      return { status: 200, body: { questions: type === "long" ? BFI2_LONG : BFI2_SHORT } };
    }

    if (method === "POST" && path === "/personality/submit") {
      const { responses, formType } = body as { responses: Record<number, number>; formType: "short" | "long" };
      const result = await submitPersonalityTest(userId!, responses, formType);
      return { status: 200, body: result };
    }

    if (method === "GET" && path === "/personality/profile") {
      return { status: 200, body: await getPersonalityProfile(userId!) };
    }

    if (method === "GET" && path === "/avatar") {
      return { status: 200, body: await getUserAvatar(userId!) };
    }

    if (method === "POST" && path === "/avatar/generate") {
      const user = await getUserById(userId!);
      if (user?.tier !== "PRO") return { status: 403, body: { error: "Pro subscription required" } };
      const avatar = await generateUserAvatar(userId!);
      return { status: 200, body: { avatar } };
    }

    if (method === "GET" && path === "/avatar/boutique") {
      return { status: 200, body: await getAvatarBoutique(userId!) };
    }

    if (method === "GET" && path === "/chat/conversation") {
      const conv = await getOrCreateConversation(userId!);
      const msgs = await getConversationMessages(conv.id);
      return { status: 200, body: { conversation: conv, messages: msgs } };
    }

    if (method === "POST" && path === "/chat/message") {
      const { content } = body as { content: string };
      const result = await handleChatMessage(userId!, content);
      return { status: 200, body: result };
    }

    if (method === "GET" && path === "/community/users") {
      return { status: 200, body: { users: await getCommunityUsers(userId!) } };
    }

    if (method === "GET" && path === "/community/leaderboard") {
      return { status: 200, body: await getCommunityLeaderboard(userId!) };
    }

    if (method === "GET" && path === "/community/topics") {
      return { status: 200, body: { topics: AI_BATTLE_TOPICS } };
    }

    if (method === "GET" && path.startsWith("/community/user/")) {
      const targetId = path.replace("/community/user/", "");
      return { status: 200, body: await getUserPublicCard(targetId, userId!) };
    }

    if (method === "GET" && path === "/community/conversations") {
      return { status: 200, body: { conversations: await listMySocialConversations(userId!) } };
    }

    if (method === "GET" && pathOnly(path) === "/conversations/inbox") {
      const q = queryParams(path);
      const view = q.get("view") === "archived" ? "archived" : "active";
      const folderParam = q.get("folderId");
      const folderId = folderParam === "none" ? null : folderParam || undefined;
      return { status: 200, body: await getConversationInbox(userId!, { view, folderId }) };
    }

    if (method === "GET" && pathOnly(path) === "/conversations/folders") {
      return { status: 200, body: { folders: await listConversationFolders(userId!) } };
    }

    if (method === "POST" && pathOnly(path) === "/conversations/folders") {
      const { name, kind } = body as { name: string; kind: "real" | "avatar" };
      return { status: 200, body: await createConversationFolder(userId!, name, kind) };
    }

    if (method === "POST" && pathOnly(path).match(/^\/conversations\/folders\/[^/]+\/rename$/)) {
      const folderId = pathOnly(path).replace("/conversations/folders/", "").replace("/rename", "");
      const { name } = body as { name: string };
      return { status: 200, body: await updateConversationFolder(userId!, folderId, name) };
    }

    if (method === "DELETE" && pathOnly(path).startsWith("/conversations/folders/")) {
      const folderId = pathOnly(path).replace("/conversations/folders/", "");
      return { status: 200, body: await deleteConversationFolder(userId!, folderId) };
    }

    if (method === "GET" && pathOnly(path) === "/conversations/unread-count") {
      const count = await getUnreadConversationCount(userId!);
      return { status: 200, body: { count } };
    }

    if (method === "POST" && path === "/community/dm") {
      const { recipientId } = body as { recipientId: string };
      const result = await startDirectMessage(userId!, recipientId);
      return { status: 200, body: result };
    }

    if (method === "POST" && pathOnly(path) === "/community/group-dm") {
      const { participantIds, title } = body as { participantIds: string[]; title?: string };
      const result = await startGroupDirectMessage(userId!, participantIds, title);
      return { status: 200, body: result };
    }

    if (method === "POST" && pathOnly(path) === "/community/group-ai-battle") {
      const { participantIds, topic, exchanges } = body as {
        participantIds: string[];
        topic: string;
        exchanges: number;
      };
      const result = await startGroupAiPersonaBattle({
        initiatorId: userId!,
        participantIds,
        topic,
        exchanges: exchanges ?? 4,
      });
      return { status: 200, body: result };
    }

    if (method === "POST" && path === "/community/ai-battle") {
      const { targetUserId, topic, exchanges } = body as {
        targetUserId: string;
        topic: string;
        exchanges: number;
      };
      const result = await startAiPersonaBattle({
        initiatorId: userId!,
        targetUserId,
        topic,
        exchanges: exchanges ?? 4,
      });
      return { status: 200, body: result };
    }

    const convPath = parseConversationPath(path);
    if (convPath) {
      const { id: convId, action } = convPath;

      if (method === "GET" && action === "export") {
        return { status: 200, body: await exportConversationTxt(convId, userId!) };
      }

      if (method === "POST" && action === "archive") {
        return { status: 200, body: await archiveConversation(convId, userId!) };
      }

      if (method === "POST" && action === "unarchive") {
        return { status: 200, body: await unarchiveConversation(convId, userId!) };
      }

      if (method === "DELETE" && !action) {
        return { status: 200, body: await deleteConversationForUser(convId, userId!) };
      }

      if (method === "POST" && action === "folder") {
        const { folderId } = body as { folderId: string | null };
        return { status: 200, body: await setConversationFolder(convId, userId!, folderId ?? null) };
      }

      if (method === "POST" && action === "participants") {
        const { participantIds } = body as { participantIds: string[] };
        return { status: 200, body: await addGroupParticipants(convId, userId!, participantIds) };
      }

      if (method === "GET" && !action) {
        return { status: 200, body: await getSocialConversation(convId, userId!) };
      }

      if (method === "POST" && action === "read") {
        return { status: 200, body: await markConversationRead(convId, userId!) };
      }

      if (method === "POST" && action === "message") {
        const { content } = body as { content: string };
        const message = await sendDirectMessage(convId, userId!, content);
        return { status: 200, body: { message } };
      }
    }

    if (method === "GET" && path === "/gamification/stats") {
      return { status: 200, body: await getGamificationStats(userId!) };
    }

    if (method === "GET" && path === "/affiliate/dashboard") {
      return { status: 200, body: await getAffiliateDashboard(userId!) };
    }

    if (method === "POST" && path === "/affiliate/enroll") {
      const affiliate = await enrollUserAsAffiliate(userId!);
      return { status: 200, body: { affiliate } };
    }

    if (method === "POST" && path === "/affiliate/connect") {
      const user = await getUserById(userId!);
      if (!user) return { status: 404, body: { error: "User not found" } };
      const db = getDb();
      const [affiliate] = await db.select().from(affiliates).where(eq(affiliates.userId, userId!)).limit(1);
      if (!affiliate) return { status: 400, body: { error: "Not enrolled as affiliate" } };
      let accountId = affiliate.stripeConnectId;
      if (!accountId) {
        const account = await createConnectAccount(user.email);
        accountId = account.id;
        await db.update(affiliates).set({ stripeConnectId: accountId }).where(eq(affiliates.id, affiliate.id));
      }
      const link = await createConnectOnboardingLink(
        accountId,
        `${appUrl}/affiliate?refresh=true`,
        `${appUrl}/affiliate?connected=true`
      );
      return { status: 200, body: { url: link.url } };
    }

    if (method === "POST" && path === "/billing/checkout") {
      const { tier, interval } = body as { tier: string; interval: string };
      const user = await getUserById(userId!);
      if (!user) return { status: 404, body: { error: "User not found" } };
      let priceId = STRIPE_PRICES.PLUS_MONTHLY;
      if (tier === "PLUS" && interval === "annual") priceId = STRIPE_PRICES.PLUS_ANNUAL;
      if (tier === "PRO") priceId = STRIPE_PRICES.PRO_MONTHLY;
      const session = await createCheckoutSession(userId!, user.email, priceId, `${appUrl}/billing/success`, `${appUrl}/pricing`);
      return { status: 200, body: { url: session.url } };
    }

    if (method === "POST" && path === "/billing/credits") {
      const { packId } = body as { packId: string };
      const user = await getUserById(userId!);
      if (!user) return { status: 404, body: { error: "User not found" } };
      const session = await createCreditCheckout(userId!, user.email, packId, `${appUrl}/billing/success`, `${appUrl}/settings`);
      return { status: 200, body: { url: session.url } };
    }

    if (method === "POST" && path === "/billing/portal") {
      const user = await getUserById(userId!);
      if (!user?.stripeCustomerId) return { status: 400, body: { error: "No subscription" } };
      const session = await createPortalSession(user.stripeCustomerId, `${appUrl}/settings`);
      return { status: 200, body: { url: session.url } };
    }

    if (method === "GET" && path === "/billing/credit-packs") {
      return { status: 200, body: { packs: CREDIT_PACKS } };
    }

    if (method === "POST" && path === "/nexus/keys") {
      const { provider, key, label } = body as {
        provider: "OPENAI" | "ANTHROPIC" | "GOOGLE" | "COHERE";
        key: string;
        label?: string;
      };
      await saveApiKey(userId!, provider, key, label);
      return { status: 200, body: { success: true } };
    }

    if (method === "GET" && path === "/legal/income-disclosure") {
      return { status: 200, body: await getIncomeDisclosures() };
    }

    if (method === "GET" && path === "/admin/users") {
      const user = await getUserById(userId!);
      if (user?.role !== "ADMIN") return { status: 403, body: { error: "Forbidden" } };
      const db = getDb();
      return { status: 200, body: await db.select().from(users).limit(100) };
    }

    if (method === "GET" && path === "/admin/platform-settings") {
      const user = await getUserById(userId!);
      if (user?.role !== "ADMIN") return { status: 403, body: { error: "Forbidden" } };
      return { status: 200, body: await getAdminPlatformSettings() };
    }

    if (method === "PUT" && path === "/admin/platform-settings") {
      const user = await getUserById(userId!);
      if (user?.role !== "ADMIN") return { status: 403, body: { error: "Forbidden" } };
      const payload = body as {
        llmProvider?: string;
        geminiModel?: string;
        geminiApiKey?: string;
        openaiApiKey?: string;
        replicateApiToken?: string;
        clearKeys?: string[];
      };
      const updated = await updateAdminPlatformSettings(userId!, payload);
      return { status: 200, body: updated };
    }

    if (method === "POST" && path === "/webhooks/stripe") {
      const sig = (body as { stripeSignature?: string }).stripeSignature;
      const rawBody = (body as { rawBody?: string }).rawBody;
      const s = getStripe();
      const event = s.webhooks.constructEvent(rawBody || "{}", sig || "", process.env.STRIPE_WEBHOOK_SECRET || "");
      const db = getDb();
      if (event.type === "checkout.session.completed") {
        const session = event.data.object as { metadata?: Record<string, string>; mode?: string; subscription?: string; payment_intent?: string };
        const uid = session.metadata?.userId;
        if (session.mode === "subscription" && uid) {
          const tier = session.metadata?.tier || "PLUS";
          await db.insert(subscriptions).values({
            userId: uid,
            stripeSubscriptionId: session.subscription as string,
            tier: tier as "PLUS" | "PRO",
            status: "ACTIVE",
            firstPaymentAt: new Date(),
          }).onConflictDoUpdate({
            target: subscriptions.userId,
            set: { tier: tier as "PLUS" | "PRO", status: "ACTIVE", updatedAt: new Date() },
          });
          await db.update(users).set({ tier: tier as "FREE" | "PLUS" | "PRO" }).where(eq(users.id, uid));
          if (tier === "PLUS") {
            await db.insert(elyCredits).values({ userId: uid, balance: 100, monthlyAllowance: 100 }).onConflictDoUpdate({
              target: elyCredits.userId,
              set: { balance: 100, monthlyAllowance: 100 },
            });
          }
        }
      }
      return { status: 200, body: { received: true } };
    }

    return { status: 404, body: { error: "Not found" } };
  } catch (err) {
    const message = (err as Error).message || "Internal error";
    const status = message === "Invalid credentials" ? 401 : message.includes("required") ? 400 : 500;
    return { status, body: { error: message } };
  }
}
