"use client";

import { useEffect, useState } from "react";
import { AppShell } from "@/components/app-shell";
import { Card, Button } from "@/components/ui";
import { apiFetch } from "@/lib/utils";
import { Copy, Users, TrendingUp, DollarSign } from "lucide-react";

export default function AffiliatePage() {
  const [dashboard, setDashboard] = useState<{
    affiliate?: {
      rank: string;
      personallySponsoredCount: number;
      groupVolume: string;
      retailCustomerCount: number;
    };
    progress?: { nextRank: string | null; sponsoredNeeded: number; gvNeeded: number; progress: number };
    referralLink?: string;
    recentCommissions?: { type: string; amount: string; periodMonth: string; status: string }[];
  } | null>(null);
  const [enrolled, setEnrolled] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    apiFetch("/affiliate/dashboard")
      .then((data) => {
        if (data) {
          setDashboard(data);
          setEnrolled(true);
        }
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, []);

  async function enroll() {
    try {
      await apiFetch("/affiliate/enroll", { method: "POST" });
      const data = await apiFetch("/affiliate/dashboard");
      setDashboard(data);
      setEnrolled(true);
    } catch (err) {
      alert((err as Error).message);
    }
  }

  async function connectStripe() {
    try {
      const data = await apiFetch("/affiliate/connect", { method: "POST" });
      if (data.url) window.location.href = data.url;
    } catch (err) {
      alert((err as Error).message);
    }
  }

  function copyLink() {
    if (dashboard?.referralLink) {
      navigator.clipboard.writeText(dashboard.referralLink);
    }
  }

  if (loading) {
    return (
      <AppShell>
        <div className="p-8 text-center text-ely-muted">Loading...</div>
      </AppShell>
    );
  }

  if (!enrolled) {
    return (
      <AppShell>
        <div className="p-4 md:p-8 max-w-lg mx-auto text-center">
          <Card>
            <Users className="mx-auto text-ely-primary mb-4" size={48} />
            <h1 className="text-2xl font-bold mb-2">Join the Affiliate Program</h1>
            <p className="text-ely-muted mb-6">
              Pro subscription required. Share ELY and earn commissions from real product sales.
            </p>
            <Button onClick={enroll}>Enroll as Affiliate</Button>
          </Card>
        </div>
      </AppShell>
    );
  }

  return (
    <AppShell>
      <div className="p-4 md:p-8 max-w-4xl mx-auto">
        <h1 className="text-2xl font-bold mb-8">Affiliate Dashboard</h1>

        <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
          <Card>
            <p className="text-sm text-ely-muted">Rank</p>
            <p className="text-xl font-bold text-ely-primary">{dashboard?.affiliate?.rank}</p>
          </Card>
          <Card>
            <p className="text-sm text-ely-muted">Personal Sponsors</p>
            <p className="text-xl font-bold">{dashboard?.affiliate?.personallySponsoredCount || 0}</p>
          </Card>
          <Card>
            <p className="text-sm text-ely-muted">Group Volume</p>
            <p className="text-xl font-bold">${dashboard?.affiliate?.groupVolume || "0"}</p>
          </Card>
          <Card>
            <p className="text-sm text-ely-muted">Retail Customers</p>
            <p className="text-xl font-bold">{dashboard?.affiliate?.retailCustomerCount || 0}</p>
          </Card>
        </div>

        {dashboard?.progress?.nextRank && (
          <Card className="mb-8">
            <div className="flex items-center justify-between mb-2">
              <h3 className="font-semibold">Progress to {dashboard.progress.nextRank}</h3>
              <span className="text-sm text-ely-accent">{dashboard.progress.progress}%</span>
            </div>
            <div className="h-2 bg-ely-border rounded-full overflow-hidden">
              <div className="h-full bg-ely-primary rounded-full" style={{ width: `${dashboard.progress.progress}%` }} />
            </div>
            <div className="flex gap-4 mt-3 text-sm text-ely-muted">
              <span>{dashboard.progress.sponsoredNeeded} sponsors needed</span>
              <span>${dashboard.progress.gvNeeded} GV needed</span>
            </div>
          </Card>
        )}

        <Card className="mb-8">
          <h3 className="font-semibold mb-3">Your Referral Link</h3>
          <div className="flex gap-2">
            <input
              readOnly
              value={dashboard?.referralLink || ""}
              className="flex-1 px-4 py-2 rounded-xl bg-ely-bg border border-ely-border text-sm"
            />
            <Button onClick={copyLink} variant="secondary">
              <Copy size={16} />
            </Button>
          </div>
        </Card>

        <div className="flex gap-4 mb-8">
          <Button onClick={connectStripe}>
            <DollarSign size={16} className="mr-2" /> Connect Stripe for Payouts
          </Button>
        </div>

        <h2 className="text-lg font-semibold mb-4">Recent Commissions</h2>
        <div className="space-y-2">
          {(dashboard?.recentCommissions || []).map((c, i) => (
            <Card key={i} className="flex justify-between items-center py-3">
              <div>
                <p className="font-medium text-sm">{c.type.replace(/_/g, " ")}</p>
                <p className="text-xs text-ely-muted">{c.periodMonth}</p>
              </div>
              <div className="text-right">
                <p className="font-semibold text-ely-accent">${c.amount}</p>
                <p className="text-xs text-ely-muted">{c.status}</p>
              </div>
            </Card>
          ))}
          {(dashboard?.recentCommissions || []).length === 0 && (
            <p className="text-ely-muted text-center py-8">No commissions yet — start sharing!</p>
          )}
        </div>
      </div>
    </AppShell>
  );
}
