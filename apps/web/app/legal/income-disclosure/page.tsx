import { Navbar, Footer } from "@/components/ui";

export default function IncomeDisclosurePage() {
  return (
    <>
      <Navbar />
      <main className="pt-24 pb-16 px-4 max-w-3xl mx-auto">
        <h1 className="text-3xl font-bold mb-8">Income Disclosure Statement</h1>
        <p className="text-ely-muted mb-8">
          ELY publishes average earnings by rank quarterly. Past performance does not guarantee future results.
          Most affiliates earn modest supplemental income. Income varies based on effort, market conditions, and team building.
        </p>
        <div className="glass rounded-2xl p-6">
          <p className="text-sm text-ely-muted">
            Detailed quarterly income disclosure data will be published here as the affiliate program grows.
            Updated figures are calculated from actual commission payments across all active affiliates.
          </p>
        </div>
      </main>
      <Footer />
    </>
  );
}
