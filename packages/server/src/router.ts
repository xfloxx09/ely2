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
      const story = await generateStoryJourney(userId!, user?.name || undefined, llmKeys);
      const sketchConfigured = resolveSketchCapabilities({
        replicateToken: platformConfig.replicateApiToken,
        geminiKey: platformConfig.geminiApiKey,
        geminiModel: platformConfig.geminiModel,
      });
      return {
        status: 200,
        body: {
          ...story,
          _debug: {
            ...story._debug,
            sketchConfigured,
          },
        },
      };
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

    if (method === "POST" && path === "/community/dm") {
      const { recipientId } = body as { recipientId: string };
      const result = await startDirectMessage(userId!, recipientId);
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

    if (method === "GET" && path.startsWith("/community/conversation/")) {
      const convId = path.replace("/community/conversation/", "");
      return { status: 200, body: await getSocialConversation(convId, userId!) };
    }

    if (method === "POST" && path.startsWith("/community/conversation/") && path.endsWith("/message")) {
      const convId = path.replace("/community/conversation/", "").replace("/message", "");
      const { content } = body as { content: string };
      const message = await sendDirectMessage(convId, userId!, content);
      return { status: 200, body: { message } };
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
