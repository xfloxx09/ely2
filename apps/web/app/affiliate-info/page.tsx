import Link from "next/link";
import { Navbar, Footer, Button, Card } from "@/components/ui";

const ranks = [
  { name: "Explorer", levels: 1, pct: "5%", req: "Active Pro member" },
  { name: "Builder", levels: 3, pct: "5%, 3%, 2%", req: "2 personal sponsors + $100 GV" },
  { name: "Innovator", levels: 5, pct: "5%, 4%, 3%, 2%, 1%", req: "4 sponsors + $500 GV" },
  { name: "Visionary", levels: 7, pct: "5% down to 1%", req: "8 sponsors + $2,000 GV" },
  { name: "Mastermind", levels: 9, pct: "5% down to 1%", req: "12 sponsors + $10,000 GV" },
];

export default function AffiliateInfoPage() {
  return (
    <>
      <Navbar />
      <main className="pt-24 pb-16 px-4 min-h-screen">
        <div className="max-w-4xl mx-auto">
          <div className="text-center mb-16">
            <h1 className="text-4xl font-bold mb-4">Share ELY, <span className="gradient-text">Build Together</span></h1>
            <p className="text-ely-muted max-w-2xl mx-auto">
              A product-first compensation plan. Every commission comes from real subscription payments — not recruitment.
            </p>
          </div>

          <div className="grid sm:grid-cols-2 gap-6 mb-12">
            <Card>
              <h3 className="font-semibold text-lg mb-2">Fast-Start Bonus</h3>
              <p className="text-3xl font-bold text-ely-primary mb-2">30%</p>
              <p className="text-sm text-ely-muted">Of first month&apos;s subscription for every personally enrolled customer</p>
            </Card>
            <Card>
              <h3 className="font-semibold text-lg mb-2">Residual Commission</h3>
              <p className="text-3xl font-bold text-ely-primary mb-2">20%</p>
              <p className="text-sm text-ely-muted">Monthly from all personally enrolled active subscribers</p>
            </Card>
            <Card>
              <h3 className="font-semibold text-lg mb-2">Team Commissions</h3>
              <p className="text-3xl font-bold text-ely-primary mb-2">Up to 9 levels</p>
              <p className="text-sm text-ely-muted">Unilevel commissions based on your rank</p>
            </Card>
            <Card>
              <h3 className="font-semibold text-lg mb-2">70% Retail Rule</h3>
              <p className="text-3xl font-bold text-ely-accent mb-2">Built-in</p>
              <p className="text-sm text-ely-muted">At least 70% of commissions must come from non-affiliate customers</p>
            </Card>
          </div>

          <h2 className="text-2xl font-bold mb-6">Rank Ladder</h2>
          <div className="space-y-4 mb-12">
            {ranks.map((rank) => (
              <Card key={rank.name} className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div>
                  <h3 className="font-semibold">{rank.name}</h3>
                  <p className="text-sm text-ely-muted">{rank.req}</p>
                </div>
                <div className="text-right">
                  <p className="text-sm">{rank.levels} levels</p>
                  <p className="text-sm text-ely-accent">{rank.pct}</p>
                </div>
              </Card>
            ))}
          </div>

          <div className="glass rounded-2xl p-8 text-center">
            <p className="text-sm text-ely-muted mb-4">
              Pro subscription ($49/mo) required. Income varies. See our{" "}
              <Link href="/legal/income-disclosure" className="text-ely-accent underline">Income Disclosure</Link>.
            </p>
            <Link href="/signup?tier=PRO">
              <Button>Join as Pro Affiliate</Button>
            </Link>
          </div>
        </div>
      </main>
      <Footer />
    </>
  );
}
