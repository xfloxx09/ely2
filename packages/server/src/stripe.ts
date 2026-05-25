import Stripe from "stripe";

let stripe: Stripe | null = null;

export function getStripe(): Stripe {
  if (!stripe) {
    stripe = new Stripe(process.env.STRIPE_SECRET_KEY || "");
  }
  return stripe;
}

export const STRIPE_PRICES = {
  PLUS_MONTHLY: process.env.STRIPE_PLUS_MONTHLY_PRICE_ID || "price_plus_monthly",
  PLUS_ANNUAL: process.env.STRIPE_PLUS_ANNUAL_PRICE_ID || "price_plus_annual",
  PRO_MONTHLY: process.env.STRIPE_PRO_MONTHLY_PRICE_ID || "price_pro_monthly",
};

export const CREDIT_PACKS = [
  { id: "credits_100", credits: 100, priceCents: 999 },
  { id: "credits_500", credits: 500, priceCents: 3999 },
  { id: "credits_1000", credits: 1000, priceCents: 6999 },
];

export async function createCheckoutSession(
  userId: string,
  email: string,
  priceId: string,
  successUrl: string,
  cancelUrl: string
) {
  const s = getStripe();
  return s.checkout.sessions.create({
    mode: "subscription",
    customer_email: email,
    line_items: [{ price: priceId, quantity: 1 }],
    success_url: successUrl,
    cancel_url: cancelUrl,
    metadata: { userId },
    subscription_data: { metadata: { userId } },
  });
}

export async function createCreditCheckout(
  userId: string,
  email: string,
  packId: string,
  successUrl: string,
  cancelUrl: string
) {
  const pack = CREDIT_PACKS.find((p) => p.id === packId);
  if (!pack) throw new Error("Invalid credit pack");

  const s = getStripe();
  return s.checkout.sessions.create({
    mode: "payment",
    customer_email: email,
    line_items: [{
      price_data: {
        currency: "usd",
        product_data: { name: `${pack.credits} ELY Credits` },
        unit_amount: pack.priceCents,
      },
      quantity: 1,
    }],
    success_url: successUrl,
    cancel_url: cancelUrl,
    metadata: { userId, packId, credits: String(pack.credits) },
  });
}

export async function createPortalSession(customerId: string, returnUrl: string) {
  const s = getStripe();
  return s.billingPortal.sessions.create({ customer: customerId, return_url: returnUrl });
}

export async function createConnectAccount(email: string) {
  const s = getStripe();
  return s.accounts.create({
    type: "express",
    email,
    capabilities: { transfers: { requested: true } },
  });
}

export async function createConnectOnboardingLink(accountId: string, refreshUrl: string, returnUrl: string) {
  const s = getStripe();
  return s.accountLinks.create({
    account: accountId,
    refresh_url: refreshUrl,
    return_url: returnUrl,
    type: "account_onboarding",
  });
}

export async function processRefund(paymentIntentId: string) {
  const s = getStripe();
  return s.refunds.create({ payment_intent: paymentIntentId });
}
