import Link from "next/link";
import { Navbar, Footer, Button, Card } from "@/components/ui";
import {
  Brain,
  Sparkles,
  MessageCircle,
  Calendar,
  PenTool,
  ChefHat,
  Target,
  Search,
  Wallet,
  Zap,
  Shield,
} from "lucide-react";

const features = [
  { icon: Brain, title: "Personality-Driven", desc: "BFI-2 assessment shapes how ELY communicates, prioritizes, and remembers." },
  { icon: Sparkles, title: "Visual Companion", desc: "A unique animated avatar that embodies your personality traits." },
  { icon: MessageCircle, title: "Model Nexus", desc: "Access GPT-4, Claude, Gemini and more — with ELY's personal touch." },
  { icon: Calendar, title: "Concierge", desc: "Schedules, reminders, and day planning adapted to your personality." },
  { icon: PenTool, title: "Scribe", desc: "Drafts emails and posts in your tone with adjustable personality intensity." },
  { icon: ChefHat, title: "Kitchen Brain", desc: "Meal planning, recipes, and shopping lists from what's in your fridge." },
  { icon: Target, title: "Habit Architect", desc: "Goal tracking and coaching styled to your extraversion level." },
  { icon: Search, title: "Researcher", desc: "Summarize articles and learn at a depth suited to your openness." },
  { icon: Wallet, title: "Money Scout", desc: "Spending analysis and budget suggestions without judgment." },
];

const tiers = [
  { name: "Free", price: "$0", features: ["20 messages/day", "Basic task modules", "Neutral persona"], cta: "Start Free" },
  { name: "Plus", price: "$19/mo", features: ["Unlimited chat", "Full task suite", "Personality adaptation", "100 Nexus requests/mo"], cta: "Go Plus", highlight: false },
  { name: "Pro", price: "$49/mo", features: ["Everything in Plus", "Custom animated avatar", "Deep memory", "Unlimited Nexus (BYOK)", "Affiliate eligibility"], cta: "Go Pro", highlight: true },
];

export default function HomePage() {
  return (
    <>
      <Navbar />
      <main>
        {/* Hero */}
        <section className="relative min-h-screen flex items-center justify-center px-4 pt-16 overflow-hidden">
          <div className="absolute inset-0 gradient-orb opacity-60" />
          <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-ely-primary/10 rounded-full blur-3xl animate-pulse-slow" />
          <div className="absolute bottom-1/4 right-1/4 w-96 h-96 bg-ely-secondary/10 rounded-full blur-3xl animate-pulse-slow" />

          <div className="relative z-10 text-center max-w-4xl mx-auto">
            <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full glass text-sm mb-8">
              <Sparkles size={16} className="text-ely-accent" />
              AI with a face and soul
            </div>
            <h1 className="text-4xl sm:text-6xl lg:text-7xl font-bold leading-tight mb-6">
              Meet <span className="gradient-text">ELY</span>
              <br />
              Your AI Companion
            </h1>
            <p className="text-lg sm:text-xl text-ely-muted max-w-2xl mx-auto mb-10">
              Not just another chatbot. ELY understands who you are, takes on a unique visual form,
              and grows with you — powered by the world&apos;s best AI models.
            </p>
            <div className="flex flex-col sm:flex-row gap-4 justify-center">
              <Link href="/signup">
                <Button className="w-full sm:w-auto text-lg px-8">Start Your Journey</Button>
              </Link>
              <Link href="/pricing">
                <Button variant="secondary" className="w-full sm:w-auto text-lg px-8">View Pricing</Button>
              </Link>
            </div>
          </div>
        </section>

        {/* Features */}
        <section id="features" className="py-24 px-4">
          <div className="max-w-7xl mx-auto">
            <h2 className="text-3xl sm:text-4xl font-bold text-center mb-4">
              Everything You Need, <span className="gradient-text">One Conversation</span>
            </h2>
            <p className="text-ely-muted text-center max-w-2xl mx-auto mb-16">
              ELY doesn&apos;t just chat — it acts. Six powerful modules, one personality-driven interface.
            </p>
            <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-6">
              {features.map((f) => (
                <Card key={f.title} className="hover:border-ely-primary/30 transition-colors">
                  <f.icon className="text-ely-primary mb-4" size={28} />
                  <h3 className="font-semibold text-lg mb-2">{f.title}</h3>
                  <p className="text-sm text-ely-muted">{f.desc}</p>
                </Card>
              ))}
            </div>
          </div>
        </section>

        {/* Personality */}
        <section className="py-24 px-4 bg-ely-surface/50">
          <div className="max-w-7xl mx-auto grid lg:grid-cols-2 gap-12 items-center">
            <div>
              <h2 className="text-3xl sm:text-4xl font-bold mb-6">
                Shaped by <span className="gradient-text">Science</span>
              </h2>
              <p className="text-ely-muted mb-6">
                Every new user completes the BFI-2 — a scientifically validated personality assessment
                measuring Openness, Conscientiousness, Extraversion, Agreeableness, and Neuroticism.
              </p>
              <ul className="space-y-3 text-sm">
                {[
                  "High Openness → creative, metaphorical language",
                  "High Conscientiousness → structured, detailed responses",
                  "High Extraversion → warm, energetic check-ins",
                  "High Agreeableness → empathetic, gentle support",
                  "High Neuroticism → extra reassurance, calm pacing",
                ].map((item) => (
                  <li key={item} className="flex items-start gap-2">
                    <Zap size={16} className="text-ely-accent mt-0.5 shrink-0" />
                    {item}
                  </li>
                ))}
              </ul>
            </div>
            <div className="relative">
              <div className="aspect-square max-w-md mx-auto rounded-3xl glass flex items-center justify-center animate-float">
                <div className="text-center">
                  <div className="w-32 h-32 mx-auto rounded-full bg-gradient-to-br from-ely-primary to-ely-secondary flex items-center justify-center mb-4">
                    <Sparkles size={48} className="text-white" />
                  </div>
                  <p className="text-sm text-ely-muted">Your unique ELY avatar</p>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* Pricing preview */}
        <section className="py-24 px-4">
          <div className="max-w-7xl mx-auto">
            <h2 className="text-3xl sm:text-4xl font-bold text-center mb-16">
              Choose Your <span className="gradient-text">Experience</span>
            </h2>
            <div className="grid md:grid-cols-3 gap-6 max-w-5xl mx-auto">
              {tiers.map((tier) => (
                <Card
                  key={tier.name}
                  className={tier.highlight ? "border-ely-primary ring-2 ring-ely-primary/20 relative" : ""}
                >
                  {tier.highlight && (
                    <span className="absolute -top-3 left-1/2 -translate-x-1/2 px-3 py-1 bg-ely-primary rounded-full text-xs font-medium">
                      Most Popular
                    </span>
                  )}
                  <h3 className="text-xl font-bold mb-1">{tier.name}</h3>
                  <p className="text-3xl font-bold mb-6">{tier.price}</p>
                  <ul className="space-y-3 mb-8">
                    {tier.features.map((f) => (
                      <li key={f} className="text-sm text-ely-muted flex items-start gap-2">
                        <Shield size={14} className="text-ely-accent mt-0.5 shrink-0" />
                        {f}
                      </li>
                    ))}
                  </ul>
                  <Link href="/signup">
                    <Button variant={tier.highlight ? "primary" : "secondary"} className="w-full">
                      {tier.cta}
                    </Button>
                  </Link>
                </Card>
              ))}
            </div>
          </div>
        </section>

        {/* CTA */}
        <section className="py-24 px-4">
          <div className="max-w-3xl mx-auto text-center glass rounded-3xl p-12">
            <h2 className="text-3xl font-bold mb-4">Ready to meet your ELY?</h2>
            <p className="text-ely-muted mb-8">Start free. No credit card required. Upgrade when you&apos;re ready.</p>
            <Link href="/signup">
              <Button className="text-lg px-10">Get Started Free</Button>
            </Link>
          </div>
        </section>
      </main>
      <Footer />
    </>
  );
}
