import { Navbar, Footer } from "@/components/ui";

export default function PrivacyPage() {
  return (
    <>
      <Navbar />
      <main className="pt-24 pb-16 px-4 max-w-3xl mx-auto prose prose-invert">
        <h1>Privacy Policy</h1>
        <p>Last updated: {new Date().toLocaleDateString()}</p>
        <h2>Personality Data</h2>
        <p>Personality scores are encrypted at rest (AES-256-GCM). They are never sold, shared, or used for external marketing.</p>
        <h2>Model Nexus</h2>
        <p>For external model calls, only a high-level communication style summary is sent — never raw BFI scores — unless you explicitly opt in.</p>
        <h2>GDPR/CCPA Compliance</h2>
        <p>You may request data export or deletion at any time by contacting support@ely.ai.</p>
        <h2>Anti-Discrimination</h2>
        <p>The personality test is for personalization only. No feature or access is gated by one&apos;s results.</p>
      </main>
      <Footer />
    </>
  );
}
