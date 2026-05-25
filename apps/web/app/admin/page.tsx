"use client";

import { useEffect, useState } from "react";
import { AppShell } from "@/components/app-shell";
import { Card, Button } from "@/components/ui";
import { apiFetch } from "@/lib/utils";
import { KeyRound, Save, Trash2, CheckCircle2, AlertCircle } from "lucide-react";

type SecretMeta = {
  configured: boolean;
  preview: string | null;
  source: "database" | "environment" | null;
};

type PlatformSettings = {
  llmProvider: string;
  geminiModel: string;
  activeProvider: "openai" | "gemini" | null;
  secrets: Record<string, SecretMeta>;
};

export default function AdminPage() {
  const [users, setUsers] = useState<{ id: string; email: string; tier: string; role: string }[]>([]);
  const [authorized, setAuthorized] = useState<boolean | null>(null);
  const [denyReason, setDenyReason] = useState<string>("");
  const [settings, setSettings] = useState<PlatformSettings | null>(null);
  const [llmProvider, setLlmProvider] = useState("gemini");
  const [geminiModel, setGeminiModel] = useState("gemini-2.0-flash");
  const [geminiApiKey, setGeminiApiKey] = useState("");
  const [openaiApiKey, setOpenaiApiKey] = useState("");
  const [replicateApiToken, setReplicateApiToken] = useState("");
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<{ type: "ok" | "err"; text: string } | null>(null);

  useEffect(() => {
    const token = localStorage.getItem("ely_token");
    if (!token) {
      setAuthorized(false);
      setDenyReason("You are not logged in. Please log in with your admin account first.");
      return;
    }

    apiFetch("/auth/me")
      .then((d) => {
        if (d.user?.role === "ADMIN") {
          setAuthorized(true);
          return Promise.all([apiFetch("/admin/users"), apiFetch("/admin/platform-settings")]);
        }
        setAuthorized(false);
        setDenyReason(
          `Logged in as ${d.user?.email || "unknown"}, but this account does not have the ADMIN role. Run pnpm db:create-admin on production, then log in again.`
        );
        throw new Error("Not admin");
      })
      .then(([userList, platformSettings]) => {
        setUsers(userList);
        setSettings(platformSettings);
        setLlmProvider(platformSettings.llmProvider || "gemini");
        setGeminiModel(platformSettings.geminiModel || "gemini-2.0-flash");
      })
      .catch((err) => {
        setAuthorized((prev) => {
          if (prev === true) return prev;
          return false;
        });
        setDenyReason((prev) => {
          if (prev) return prev;
          const msg = err instanceof Error ? err.message : "";
          if (msg.includes("Unauthorized") || msg.includes("Request failed")) {
            return "Your session expired (common after a deploy). Log out and log back in, then return to /admin.";
          }
          return msg || "Could not verify admin access.";
        });
      });
  }, []);

  async function savePlatformSettings() {
    setSaving(true);
    setMessage(null);
    try {
      const payload: Record<string, string | undefined> = {
        llmProvider,
        geminiModel,
      };
      if (geminiApiKey.trim()) payload.geminiApiKey = geminiApiKey.trim();
      if (openaiApiKey.trim()) payload.openaiApiKey = openaiApiKey.trim();
      if (replicateApiToken.trim()) payload.replicateApiToken = replicateApiToken.trim();

      const updated = await apiFetch("/admin/platform-settings", {
        method: "PUT",
        body: JSON.stringify(payload),
      });
      setSettings(updated);
      setGeminiApiKey("");
      setOpenaiApiKey("");
      setReplicateApiToken("");
      setMessage({ type: "ok", text: "Platform AI keys saved. Changes apply within ~30 seconds." });
    } catch (err) {
      setMessage({ type: "err", text: (err as Error).message || "Failed to save settings" });
    } finally {
      setSaving(false);
    }
  }

  async function clearKey(key: string) {
    setSaving(true);
    setMessage(null);
    try {
      const updated = await apiFetch("/admin/platform-settings", {
        method: "PUT",
        body: JSON.stringify({ clearKeys: [key] }),
      });
      setSettings(updated);
      setMessage({ type: "ok", text: `${key} removed from database.` });
    } catch (err) {
      setMessage({ type: "err", text: (err as Error).message || "Failed to clear key" });
    } finally {
      setSaving(false);
    }
  }

  if (authorized === null) {
    return (
      <AppShell>
        <div className="p-8 text-center text-ely-muted">Checking admin access...</div>
      </AppShell>
    );
  }

  if (!authorized) {
    return (
      <AppShell>
        <div className="mx-auto max-w-lg p-8 text-center">
          <h1 className="text-xl font-semibold mb-3">Admin access required</h1>
          <p className="text-sm text-ely-muted leading-relaxed mb-6">{denyReason}</p>
          <div className="flex flex-col gap-3 sm:flex-row sm:justify-center">
            <Button onClick={() => (window.location.href = "/login")}>Go to login</Button>
            <Button variant="secondary" onClick={() => (window.location.href = "/chat")}>
              Back to chat
            </Button>
          </div>
          <p className="mt-6 text-xs text-ely-muted">
            Admin login: <span className="text-white">admin@ely.ai</span> — password set via{" "}
            <code className="text-ely-accent">pnpm db:create-admin</code>
          </p>
        </div>
      </AppShell>
    );
  }

  return (
    <AppShell>
      <div className="p-4 md:p-8 max-w-6xl mx-auto">
        <h1 className="text-2xl font-bold mb-2">Admin Panel</h1>
        <p className="text-sm text-ely-muted mb-8">Manage platform AI keys without redeploying environment variables.</p>

        <Card className="mb-8 border-ely-primary/20">
          <div className="flex items-start gap-3 mb-6">
            <div className="rounded-xl bg-ely-primary/15 p-2.5">
              <KeyRound size={20} className="text-ely-primary" />
            </div>
            <div>
              <h2 className="text-lg font-semibold">Platform AI Keys</h2>
              <p className="text-sm text-ely-muted mt-1">
                Keys are encrypted in the database. Leave a field blank to keep the current key. Active provider:{" "}
                <span className="text-white font-medium">{settings?.activeProvider || "none configured"}</span>
              </p>
            </div>
          </div>

          {message && (
            <div
              className={`mb-4 flex items-center gap-2 rounded-xl px-4 py-3 text-sm ${
                message.type === "ok"
                  ? "bg-emerald-500/10 text-emerald-300 border border-emerald-500/20"
                  : "bg-red-500/10 text-red-300 border border-red-500/20"
              }`}
            >
              {message.type === "ok" ? <CheckCircle2 size={16} /> : <AlertCircle size={16} />}
              {message.text}
            </div>
          )}

          <div className="grid gap-5 md:grid-cols-2">
            <label className="block">
              <span className="mb-1.5 block text-sm text-ely-muted">Default LLM provider</span>
              <select
                value={llmProvider}
                onChange={(e) => setLlmProvider(e.target.value)}
                className="w-full rounded-xl border border-white/10 bg-black/30 px-4 py-3 text-sm outline-none focus:border-ely-primary/50"
              >
                <option value="gemini">Google Gemini (free tier friendly)</option>
                <option value="openai">OpenAI</option>
              </select>
            </label>

            <label className="block">
              <span className="mb-1.5 block text-sm text-ely-muted">Gemini model</span>
              <input
                value={geminiModel}
                onChange={(e) => setGeminiModel(e.target.value)}
                placeholder="gemini-2.0-flash"
                className="w-full rounded-xl border border-white/10 bg-black/30 px-4 py-3 text-sm outline-none focus:border-ely-primary/50"
              />
            </label>

            <SecretField
              label="Gemini API key"
              placeholder="AIza..."
              value={geminiApiKey}
              onChange={setGeminiApiKey}
              meta={settings?.secrets.GEMINI_API_KEY}
              onClear={() => clearKey("GEMINI_API_KEY")}
            />

            <SecretField
              label="OpenAI API key"
              placeholder="sk-..."
              value={openaiApiKey}
              onChange={setOpenaiApiKey}
              meta={settings?.secrets.OPENAI_API_KEY}
              onClear={() => clearKey("OPENAI_API_KEY")}
            />

            <SecretField
              label="Replicate API token (avatar faces)"
              placeholder="r8_..."
              value={replicateApiToken}
              onChange={setReplicateApiToken}
              meta={settings?.secrets.REPLICATE_API_TOKEN}
              onClear={() => clearKey("REPLICATE_API_TOKEN")}
              className="md:col-span-2"
            />
          </div>

          <div className="mt-6 flex flex-wrap gap-3">
            <Button onClick={savePlatformSettings} disabled={saving}>
              <Save size={16} className="mr-2" />
              {saving ? "Saving..." : "Save platform keys"}
            </Button>
          </div>
        </Card>

        <div className="grid sm:grid-cols-3 gap-4 mb-8">
          <Card>
            <h3 className="font-semibold mb-2">Commission Runs</h3>
            <p className="text-sm text-ely-muted mb-3">Trigger monthly commission calculation</p>
            <Button variant="secondary" className="text-sm">Run Commissions</Button>
          </Card>
          <Card>
            <h3 className="font-semibold mb-2">70% Rule Compliance</h3>
            <p className="text-sm text-ely-muted mb-3">Monitor retail vs affiliate commission ratio</p>
            <Button variant="secondary" className="text-sm">View Dashboard</Button>
          </Card>
          <Card>
            <h3 className="font-semibold mb-2">Income Disclosure</h3>
            <p className="text-sm text-ely-muted mb-3">Update quarterly earnings by rank</p>
            <Button variant="secondary" className="text-sm">Manage</Button>
          </Card>
        </div>

        <h2 className="text-lg font-semibold mb-4">Users ({users.length})</h2>
        <div className="space-y-2">
          {users.map((u) => (
            <Card key={u.id} className="flex justify-between items-center py-3">
              <div>
                <p className="font-medium text-sm">{u.email}</p>
                <p className="text-xs text-ely-muted">{u.role}</p>
              </div>
              <span className="text-xs px-2 py-1 rounded-full bg-ely-primary/20">{u.tier}</span>
            </Card>
          ))}
        </div>
      </div>
    </AppShell>
  );
}

function SecretField({
  label,
  placeholder,
  value,
  onChange,
  meta,
  onClear,
  className = "",
}: {
  label: string;
  placeholder: string;
  value: string;
  onChange: (v: string) => void;
  meta?: SecretMeta;
  onClear: () => void;
  className?: string;
}) {
  return (
    <label className={`block ${className}`}>
      <div className="mb-1.5 flex items-center justify-between gap-2">
        <span className="text-sm text-ely-muted">{label}</span>
        {meta?.configured && (
          <span className="text-[10px] uppercase tracking-wider text-emerald-400/80">
            {meta.source === "database" ? "Saved in DB" : "From env var"}
            {meta.preview ? ` · ${meta.preview}` : ""}
          </span>
        )}
      </div>
      <div className="flex gap-2">
        <input
          type="password"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={meta?.configured ? "Enter new key to replace" : placeholder}
          className="min-w-0 flex-1 rounded-xl border border-white/10 bg-black/30 px-4 py-3 text-sm outline-none focus:border-ely-primary/50"
        />
        {meta?.source === "database" && (
          <button
            type="button"
            onClick={onClear}
            className="flex h-[46px] w-[46px] shrink-0 items-center justify-center rounded-xl border border-white/10 bg-black/30 text-ely-muted hover:text-red-300 hover:border-red-400/30"
            aria-label={`Clear ${label}`}
          >
            <Trash2 size={16} />
          </button>
        )}
      </div>
    </label>
  );
}
