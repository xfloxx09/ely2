import Link from "next/link";
import { Navbar, Footer, Button, Card } from "@/components/ui";
import { Check } from "lucide-react";

const plans = [
  {
    name: "Free",
    price: "$0",
    period: "forever",
    description: "Get started with ELY",
    features: [
      "20 messages per day",
      "Basic task modules",
      "Neutral default persona",
      "No personality adaptation",
      "No avatar",
      "No Model Nexus",
    ],
    cta: "Start Free",
    tier: "FREE",
  },
  {
    name: "Plus",
    price: "$19",
    period: "/month",
    altPrice: "$199/year (save $29)",
    description: "Full ELY experience",
    features: [
      "Unlimited ELY chat",
      "Full everyday task suite",
      "Personality test + tone adaptation",
      "100 Model Nexus requests/month",
      "ELY Credits included",
    ],
    cta: "Subscribe to Plus",
    tier: "PLUS",
    highlight: false,
  },
  {
    name: "Pro",
    price: "$49",
    period: "/month",
    description: "The complete ELY companion",
    features: [
      "Everything in Plus",
      "Custom animated avatar",
      "Deep memory",
      "Voice calls with avatar",
      "Unlimited Nexus with BYOK",
      "Priority speed",
      "Custom AI instructions",
      "Affiliate program eligibility",
    ],
    cta: "Subscribe to Pro",
    tier: "PRO",
    highlight: true,
  },
];

export default function PricingPage() {
  return (
    <>
      <Navbar />
      <main className="pt-24 pb-16 px-4 min-h-screen">
        <div className="max-w-7xl mx-auto">
          <div className="text-center mb-16">
            <h1 className="text-4xl font-bold mb-4">Simple, Transparent Pricing</h1>
            <p className="text-ely-muted max-w-xl mx-auto">
              30-day money-back guarantee on your first subscription. Cancel anytime.
            </p>
          </div>

          <div className="grid md:grid-cols-3 gap-8 max-w-5xl mx-auto">
            {plans.map((plan) => (
              <Card
                key={plan.name}
                className={`flex flex-col ${plan.highlight ? "border-ely-primary ring-2 ring-ely-primary/20 relative scale-105" : ""}`}
              >
                {plan.highlight && (
                  <span className="absolute -top-3 left-1/2 -translate-x-1/2 px-3 py-1 bg-ely-primary rounded-full text-xs font-medium">
                    Recommended
                  </span>
                )}
                <h2 className="text-2xl font-bold">{plan.name}</h2>
                <p className="text-sm text-ely-muted mt-1">{plan.description}</p>
                <div className="mt-4 mb-2">
                  <span className="text-4xl font-bold">{plan.price}</span>
                  <span className="text-ely-muted">{plan.period}</span>
                </div>
                {plan.altPrice && <p className="text-xs text-ely-accent mb-4">{plan.altPrice}</p>}
                <ul className="space-y-3 my-6 flex-1">
                  {plan.features.map((f) => (
                    <li key={f} className="flex items-start gap-2 text-sm">
                      <Check size={16} className="text-ely-accent mt-0.5 shrink-0" />
                      {f}
                    </li>
                  ))}
                </ul>
                <Link href={plan.tier === "FREE" ? "/signup" : `/signup?tier=${plan.tier}`}>
                  <Button variant={plan.highlight ? "primary" : "secondary"} className="w-full">
                    {plan.cta}
                  </Button>
                </Link>
              </Card>
            ))}
          </div>

          <div className="mt-16 text-center">
            <h3 className="text-xl font-semibold mb-4">Additional Purchases</h3>
            <div className="grid sm:grid-cols-2 gap-4 max-w-2xl mx-auto">
              <Card>
                <h4 className="font-semibold">ELY Credits</h4>
                <p className="text-sm text-ely-muted mt-1">Use premium models without personal API keys</p>
              </Card>
              <Card>
                <h4 className="font-semibold">Avatar Boutique</h4>
                <p className="text-sm text-ely-muted mt-1">Outfits, environments, and accessories for your ELY</p>
              </Card>
            </div>
          </div>
        </div>
      </main>
      <Footer />
    </>
  );
}
