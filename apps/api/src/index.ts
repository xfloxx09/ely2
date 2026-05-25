import Fastify from "fastify";
import cors from "@fastify/cors";
import { eq } from "drizzle-orm";
import { getDb, users, subscriptions, elyCredits, creditTransactions, affiliates } from "@ely/db";
import { BFI2_SHORT, BFI2_LONG } from "@ely/personality";
import { checkRateLimit } from "./redis.js";
import {
  registerUser,
  loginUser,
  getUserById,
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

const app = Fastify({ logger: true });

await app.register(cors, { origin: true, credentials: true });

const sessions = new Map<string, { userId: string; expires: number }>();

function createSession(userId: string): string {
  const token = crypto.randomUUID();
  sessions.set(token, { userId, expires: Date.now() + 7 * 86400000 });
  return token;
}

function getSessionUser(token: string | undefined): string | null {
  if (!token) return null;
  const session = sessions.get(token);
  if (!session || session.expires < Date.now()) {
    sessions.delete(token!);
    return null;
  }
  return session.userId;
}

app.addHook("preHandler", async (req, reply) => {
  const publicPaths = ["/health", "/auth/register", "/auth/login", "/personality/questions", "/legal/income-disclosure"];
  if (publicPaths.some((p) => req.url.startsWith(p))) return;

  const token = req.headers.authorization?.replace("Bearer ", "");
  const userId = getSessionUser(token);
  if (!userId && !req.url.startsWith("/webhooks")) {
    return reply.status(401).send({ error: "Unauthorized" });
  }
  (req as unknown as { userId: string }).userId = userId!;
});

app.get("/health", async () => ({ status: "ok", service: "ely-api" }));

app.post("/auth/register", async (req, reply) => {
  const { email, password, name, referralCode } = req.body as {
    email: string;
    password: string;
    name?: string;
    referralCode?: string;
  };
  try {
    const user = await registerUser(email, password, name, referralCode);
    const token = createSession(user.id);
    return { user, token };
  } catch (err) {
    return reply.status(400).send({ error: (err as Error).message });
  }
});

app.post("/auth/login", async (req, reply) => {
  const { email, password } = req.body as { email: string; password: string };
  try {
    const user = await loginUser(email, password);
    const token = createSession(user.id);
    return { user, token };
  } catch {
    return reply.status(401).send({ error: "Invalid credentials" });
  }
});

app.get("/auth/me", async (req) => {
  const userId = (req as unknown as { userId: string }).userId;
  const user = await getUserById(userId);
  return { user };
});

app.get("/personality/questions", async (req) => {
  const type = (req.query as { type?: string }).type || "short";
  return { questions: type === "long" ? BFI2_LONG : BFI2_SHORT };
});

app.post("/personality/submit", async (req, reply) => {
  const userId = (req as unknown as { userId: string }).userId;
  const { responses, formType } = req.body as {
    responses: Record<number, number>;
    formType: "short" | "long";
  };
  try {
    const result = await submitPersonalityTest(userId, responses, formType);
    return result;
  } catch (err) {
    return reply.status(400).send({ error: (err as Error).message });
  }
});

app.get("/personality/profile", async (req) => {
  const userId = (req as unknown as { userId: string }).userId;
  return getPersonalityProfile(userId);
});

app.get("/avatar", async (req) => {
  const userId = (req as unknown as { userId: string }).userId;
  return getUserAvatar(userId);
});

app.post("/avatar/generate", async (req, reply) => {
  const userId = (req as unknown as { userId: string }).userId;
  const user = await getUserById(userId);
  if (user?.tier !== "PRO") return reply.status(403).send({ error: "Pro subscription required" });
  const avatar = await generateUserAvatar(userId);
  return { avatar };
});

app.get("/avatar/boutique", async (req) => {
  const userId = (req as unknown as { userId: string }).userId;
  return getAvatarBoutique(userId);
});

app.get("/chat/conversation", async (req) => {
  const userId = (req as unknown as { userId: string }).userId;
  const conv = await getOrCreateConversation(userId);
  const msgs = await getConversationMessages(conv.id);
  return { conversation: conv, messages: msgs };
});

app.get("/gamification/stats", async (req) => {
  const userId = (req as unknown as { userId: string }).userId;
  return getGamificationStats(userId);
});

app.get("/affiliate/dashboard", async (req) => {
  const userId = (req as unknown as { userId: string }).userId;
  return getAffiliateDashboard(userId);
});

app.post("/affiliate/enroll", async (req, reply) => {
  const userId = (req as unknown as { userId: string }).userId;
  try {
    const affiliate = await enrollUserAsAffiliate(userId);
    return { affiliate };
  } catch (err) {
    return reply.status(400).send({ error: (err as Error).message });
  }
});

app.post("/affiliate/connect", async (req, reply) => {
  const userId = (req as unknown as { userId: string }).userId;
  const user = await getUserById(userId);
  if (!user) return reply.status(404).send({ error: "User not found" });

  const db = getDb();
  const [affiliate] = await db.select().from(affiliates).where(eq(affiliates.userId, userId)).limit(1);
  if (!affiliate) return reply.status(400).send({ error: "Not enrolled as affiliate" });

  let accountId = affiliate.stripeConnectId;
  if (!accountId) {
    const account = await createConnectAccount(user.email);
    accountId = account.id;
    await db.update(affiliates).set({ stripeConnectId: accountId }).where(eq(affiliates.id, affiliate.id));
  }

  const link = await createConnectOnboardingLink(
    accountId,
    `${process.env.NEXTAUTH_URL}/affiliate?refresh=true`,
    `${process.env.NEXTAUTH_URL}/affiliate?connected=true`
  );
  return { url: link.url };
});

app.post("/billing/checkout", async (req, reply) => {
  const userId = (req as unknown as { userId: string }).userId;
  const { tier, interval } = req.body as { tier: string; interval: string };
  const user = await getUserById(userId);
  if (!user) return reply.status(404).send({ error: "User not found" });

  let priceId = STRIPE_PRICES.PLUS_MONTHLY;
  if (tier === "PLUS" && interval === "annual") priceId = STRIPE_PRICES.PLUS_ANNUAL;
  if (tier === "PRO") priceId = STRIPE_PRICES.PRO_MONTHLY;

  const session = await createCheckoutSession(
    userId,
    user.email,
    priceId,
    `${process.env.NEXTAUTH_URL}/billing/success`,
    `${process.env.NEXTAUTH_URL}/pricing`
  );
  return { url: session.url };
});

app.post("/billing/credits", async (req, reply) => {
  const userId = (req as unknown as { userId: string }).userId;
  const { packId } = req.body as { packId: string };
  const user = await getUserById(userId);
  if (!user) return reply.status(404).send({ error: "User not found" });

  const session = await createCreditCheckout(
    userId,
    user.email,
    packId,
    `${process.env.NEXTAUTH_URL}/billing/success`,
    `${process.env.NEXTAUTH_URL}/settings`
  );
  return { url: session.url };
});

app.post("/billing/portal", async (req, reply) => {
  const userId = (req as unknown as { userId: string }).userId;
  const user = await getUserById(userId);
  if (!user?.stripeCustomerId) return reply.status(400).send({ error: "No subscription" });

  const session = await createPortalSession(user.stripeCustomerId, `${process.env.NEXTAUTH_URL}/settings`);
  return { url: session.url };
});

app.get("/billing/credit-packs", async () => ({ packs: CREDIT_PACKS }));

app.post("/nexus/keys", async (req) => {
  const userId = (req as unknown as { userId: string }).userId;
  const { provider, key, label } = req.body as {
    provider: "OPENAI" | "ANTHROPIC" | "GOOGLE" | "COHERE";
    key: string;
    label?: string;
  };
  await saveApiKey(userId, provider, key, label);
  return { success: true };
});

app.get("/legal/income-disclosure", async () => getIncomeDisclosures());

app.post("/webhooks/stripe", async (req, reply) => {
  const sig = req.headers["stripe-signature"] as string;
  const s = getStripe();
  let event;

  try {
    event = s.webhooks.constructEvent(JSON.stringify(req.body), sig, process.env.STRIPE_WEBHOOK_SECRET || "");
  } catch {
    return reply.status(400).send({ error: "Invalid signature" });
  }

  const db = getDb();

  if (event.type === "checkout.session.completed") {
    const session = event.data.object;
    const userId = session.metadata?.userId;

    if (session.mode === "subscription" && userId) {
      const tier = session.metadata?.tier || "PLUS";
      await db
        .insert(subscriptions)
        .values({
          userId,
          stripeSubscriptionId: session.subscription as string,
          tier: tier as "PLUS" | "PRO",
          status: "ACTIVE",
          firstPaymentAt: new Date(),
        })
        .onConflictDoUpdate({
          target: subscriptions.userId,
          set: { tier: tier as "PLUS" | "PRO", status: "ACTIVE", updatedAt: new Date() },
        });

      await db.update(users).set({ tier: tier as "FREE" | "PLUS" | "PRO" }).where(eq(users.id, userId));

      if (tier === "PLUS") {
        await db
          .insert(elyCredits)
          .values({ userId, balance: 100, monthlyAllowance: 100 })
          .onConflictDoUpdate({
            target: elyCredits.userId,
            set: { balance: 100, monthlyAllowance: 100 },
          });
      }
    }

    if (session.mode === "payment" && userId) {
      const credits = parseInt(session.metadata?.credits || "0");
      if (credits > 0) {
        await db
          .update(elyCredits)
          .set({ balance: credits })
          .where(eq(elyCredits.userId, userId));
        await db.insert(creditTransactions).values({
          userId,
          amount: credits,
          type: "purchase",
          description: `Purchased ${credits} credits`,
          stripePaymentId: session.payment_intent as string,
        });
      }
    }
  }

  return { received: true };
});

app.get("/admin/users", async (req) => {
  const userId = (req as unknown as { userId: string }).userId;
  const user = await getUserById(userId);
  if (user?.role !== "ADMIN") return { error: "Forbidden" };

  const db = getDb();
  return db.select().from(users).limit(100);
});

const port = parseInt(process.env.PORT || "3001");
app.listen({ port, host: "0.0.0.0" }, (err) => {
  if (err) {
    app.log.error(err);
    process.exit(1);
  }
  console.log(`ELY API running on port ${port}`);
});
