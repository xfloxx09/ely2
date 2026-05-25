import { Navbar, Footer } from "@/components/ui";

export default function TermsPage() {
  return (
    <>
      <Navbar />
      <main className="pt-24 pb-16 px-4 max-w-3xl mx-auto prose prose-invert">
        <h1>Terms of Service</h1>
        <p>Last updated: {new Date().toLocaleDateString()}</p>
        <h2>1. Service Description</h2>
        <p>ELY (ely.ai) provides an AI companion service with personality-driven interactions, task modules, and optional affiliate business opportunities.</p>
        <h2>2. Subscriptions</h2>
        <p>Free, Plus ($19/mo), and Pro ($49/mo) tiers are available. 30-day money-back guarantee on first subscription.</p>
        <h2>3. Affiliate Program</h2>
        <p>Pro members may opt into the affiliate program. Commissions are paid solely on real product sales. Income is not guaranteed.</p>
        <h2>4. Acceptable Use</h2>
        <p>ELY is not a replacement for therapy or professional medical advice. Users must not use the service for illegal activities.</p>
        <h2>5. Psychological Well-being</h2>
        <p>ELY encourages real human connection and is not positioned as a replacement for therapy or relationships.</p>
      </main>
      <Footer />
    </>
  );
}
