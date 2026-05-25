"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { AppShell } from "@/components/app-shell";
import { Card, Button } from "@/components/ui";
import { apiFetch } from "@/lib/utils";
import { Sparkles, Brain } from "lucide-react";

export default function ProfilePage() {
  const [user, setUser] = useState<{ name?: string; email?: string; tier?: string; referralCode?: string }>({});
  const [profile, setProfile] = useState<{ scores?: Record<string, number>; profile?: { styleSummary: string } }>({});
  const [avatar, setAvatar] = useState<{ imageUrl?: string; evolutionLevel?: number } | null>(null);

  useEffect(() => {
    const stored = JSON.parse(localStorage.getItem("ely_user") || "{}");
    setUser(stored);

    apiFetch("/auth/me").then((d) => setUser(d.user)).catch(() => {});
    apiFetch("/personality/profile").then(setProfile).catch(() => {});
    apiFetch("/avatar").then(setAvatar).catch(() => {});
  }, []);

  return (
    <AppShell>
      <div className="p-4 md:p-8 max-w-2xl mx-auto">
        <h1 className="text-2xl font-bold mb-8">Profile</h1>

        <Card className="mb-6">
          <div className="flex items-center gap-4">
            <div className="w-16 h-16 rounded-full overflow-hidden bg-ely-card">
              {avatar?.imageUrl ? (
                <img src={avatar.imageUrl} alt="Avatar" className="w-full h-full object-cover" />
              ) : (
                <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-ely-primary to-ely-secondary">
                  <Sparkles size={24} />
                </div>
              )}
            </div>
            <div>
              <h2 className="font-semibold text-lg">{user.name || "ELY User"}</h2>
              <p className="text-sm text-ely-muted">{user.email}</p>
              <span className="inline-block mt-1 px-2 py-0.5 rounded-full text-xs bg-ely-primary/20 text-ely-primary">
                {user.tier || "FREE"}
              </span>
            </div>
          </div>
        </Card>

        {profile.scores && (
          <Card className="mb-6">
            <div className="flex items-center gap-2 mb-4">
              <Brain size={20} className="text-ely-primary" />
              <h3 className="font-semibold">Personality Profile</h3>
            </div>
            <p className="text-sm text-ely-muted mb-4">{profile.profile?.styleSummary}</p>
            <div className="space-y-3">
              {Object.entries(profile.scores).map(([trait, score]) => (
                <div key={trait}>
                  <div className="flex justify-between text-sm mb-1 capitalize">
                    <span>{trait}</span>
                    <span>{score}%</span>
                  </div>
                  <div className="h-2 bg-ely-border rounded-full overflow-hidden">
                    <div className="h-full bg-gradient-to-r from-ely-primary to-ely-accent rounded-full" style={{ width: `${score}%` }} />
                  </div>
                </div>
              ))}
            </div>
          </Card>
        )}

        <Card className="mb-6">
          <h3 className="font-semibold mb-2">Referral Code</h3>
          <p className="text-ely-accent font-mono">{user.referralCode}</p>
        </Card>

        <div className="flex flex-col sm:flex-row gap-3">
          <Link href="/boutique"><Button variant="secondary" className="w-full">Avatar Boutique</Button></Link>
          <Link href="/settings"><Button variant="secondary" className="w-full">Settings</Button></Link>
        </div>
      </div>
    </AppShell>
  );
}
