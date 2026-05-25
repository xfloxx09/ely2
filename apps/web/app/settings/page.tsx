"use client";

import { useEffect, useState } from "react";
import { AppShell } from "@/components/app-shell";
import { Card, Button } from "@/components/ui";
import { apiFetch } from "@/lib/utils";

export default function SettingsPage() {
  const [user, setUser] = useState<{ tier?: string }>({});

  useEffect(() => {
    apiFetch("/auth/me").then((d) => setUser(d.user)).catch(() => {});
  }, []);

  async function upgrade(tier: string) {
    try {
      const data = await apiFetch("/billing/checkout", {
        method: "POST",
        body: JSON.stringify({ tier, interval: "monthly" }),
      });
      if (data.url) window.location.href = data.url;
    } catch (err) {
      alert((err as Error).message);
    }
  }

  async function openPortal() {
    try {
      const data = await apiFetch("/billing/portal", { method: "POST" });
      if (data.url) window.location.href = data.url;
    } catch (err) {
      alert((err as Error).message);
    }
  }

  async function saveApiKey(provider: string) {
    const key = prompt(`Enter your ${provider} API key:`);
    if (!key) return;
    await apiFetch("/nexus/keys", {
      method: "POST",
      body: JSON.stringify({ provider, key }),
    });
    alert("API key saved");
  }

  return (
    <AppShell>
      <div className="p-4 md:p-8 max-w-2xl mx-auto">
        <h1 className="text-2xl font-bold mb-8">Settings</h1>

        <Card className="mb-6">
          <h3 className="font-semibold mb-4">Subscription</h3>
          <p className="text-sm text-ely-muted mb-4">Current plan: <span className="text-white font-medium">{user.tier || "FREE"}</span></p>
          <div className="flex flex-wrap gap-3">
            {user.tier !== "PLUS" && user.tier !== "PRO" && (
              <Button onClick={() => upgrade("PLUS")}>Upgrade to Plus ($19/mo)</Button>
            )}
            {user.tier !== "PRO" && (
              <Button onClick={() => upgrade("PRO")}>Upgrade to Pro ($49/mo)</Button>
            )}
            {user.tier !== "FREE" && (
              <Button variant="secondary" onClick={openPortal}>Manage Subscription</Button>
            )}
          </div>
        </Card>

        <Card className="mb-6">
          <h3 className="font-semibold mb-4">Model Nexus — Bring Your Own Keys</h3>
          <p className="text-sm text-ely-muted mb-4">Connect your API keys for unlimited external model access (Pro)</p>
          <div className="flex flex-wrap gap-3">
            <Button variant="secondary" onClick={() => saveApiKey("OPENAI")}>Add OpenAI Key</Button>
            <Button variant="secondary" onClick={() => saveApiKey("ANTHROPIC")}>Add Anthropic Key</Button>
          </div>
        </Card>

        <Card className="mb-6">
          <h3 className="font-semibold mb-2">Persona</h3>
          <p className="text-sm text-ely-muted mb-4">Switch to neutral default persona at any time</p>
          <Button variant="ghost">Use Neutral Persona</Button>
        </Card>

        <Card>
          <h3 className="font-semibold mb-2 text-red-400">Danger Zone</h3>
          <Button variant="ghost" onClick={() => { localStorage.clear(); window.location.href = "/"; }}>
            Log Out
          </Button>
        </Card>
      </div>
    </AppShell>
  );
}
