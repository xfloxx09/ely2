import { Navbar, Footer } from "@/components/ui";

export default function RefundPage() {
  return (
    <>
      <Navbar />
      <main className="pt-24 pb-16 px-4 max-w-3xl mx-auto prose prose-invert">
        <h1>Refund Policy</h1>
        <p>We offer a 30-day money-back guarantee on your first subscription purchase. Contact support@ely.ai to request a refund within 30 days of your initial payment.</p>
      </main>
      <Footer />
    </>
  );
}
