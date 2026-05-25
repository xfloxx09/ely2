"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { X, Users, Sparkles } from "lucide-react";
import { Button } from "@/components/ui";
import { apiFetch } from "@/lib/utils";

type CommunityUser = {
  id: string;
  name: string | null;
  avatarUrl: string | null;
};

export function GroupCreateModal({ onClose }: { onClose: () => void }) {
  const router = useRouter();
  const [mode, setMode] = useState<"real" | "ai">("real");
  const [users, setUsers] = useState<CommunityUser[]>([]);
  const [topics, setTopics] = useState<string[]>([]);
  const [selected, setSelected] = useState<string[]>([]);
  const [title, setTitle] = useState("");
  const [topic, setTopic] = useState("");
  const [customTopic, setCustomTopic] = useState("");
  const [exchanges, setExchanges] = useState(3);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    Promise.all([apiFetch("/community/users"), apiFetch("/community/topics")])
      .then(([u, t]) => {
        setUsers(u.users || []);
        setTopics(t.topics || []);
        if (t.topics?.[0]) setTopic(t.topics[0]);
      })
      .catch(() => setError("Could not load travelers"));
  }, []);

  function toggleUser(id: string) {
    setSelected((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));
  }

  async function submit() {
    if (selected.length < 2) {
      setError("Pick at least 2 other travelers (3 people total)");
      return;
    }
    setLoading(true);
    setError(null);
    try {
      if (mode === "real") {
        const data = await apiFetch("/community/group-dm", {
          method: "POST",
          body: JSON.stringify({ participantIds: selected, title: title.trim() || undefined }),
        });
        router.push(`/conversations/${data.conversation.id}`);
      } else {
        const finalTopic = customTopic.trim() || topic;
        if (!finalTopic) {
          setError("Choose a topic");
          setLoading(false);
          return;
        }
        const data = await apiFetch("/community/group-ai-battle", {
          method: "POST",
          body: JSON.stringify({ participantIds: selected, topic: finalTopic, exchanges }),
        });
        router.push(`/conversations/${data.conversation.id}`);
      }
      onClose();
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/70 p-4 sm:items-center">
      <div className="max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-2xl border border-white/10 bg-[#12121a] p-5 shadow-2xl">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-lg font-semibold">New group conversation</h2>
          <button onClick={onClose} className="rounded-lg p-2 text-ely-muted hover:bg-white/5">
            <X size={18} />
          </button>
        </div>

        <div className="mb-4 flex gap-2">
          <button
            type="button"
            onClick={() => setMode("real")}
            className={`flex flex-1 items-center justify-center gap-2 rounded-xl py-2 text-sm ${
              mode === "real" ? "bg-ely-primary/20 text-white" : "bg-white/5 text-ely-muted"
            }`}
          >
            <Users size={16} /> Real group chat
          </button>
          <button
            type="button"
            onClick={() => setMode("ai")}
            className={`flex flex-1 items-center justify-center gap-2 rounded-xl py-2 text-sm ${
              mode === "ai" ? "bg-ely-accent/20 text-white" : "bg-white/5 text-ely-muted"
            }`}
          >
            <Sparkles size={16} /> Group AI personas
          </button>
        </div>

        <p className="mb-3 text-xs text-ely-muted">
          Select travelers to include — you&apos;ll be added automatically ({selected.length + 1} total)
        </p>

        <div className="mb-4 max-h-48 space-y-1 overflow-y-auto rounded-xl border border-white/10 p-2">
          {users.map((u) => (
            <label
              key={u.id}
              className="flex cursor-pointer items-center gap-3 rounded-lg px-2 py-2 hover:bg-white/5"
            >
              <input
                type="checkbox"
                checked={selected.includes(u.id)}
                onChange={() => toggleUser(u.id)}
                className="rounded border-white/20"
              />
              <span className="text-sm">{u.name || "Traveler"}</span>
            </label>
          ))}
        </div>

        {mode === "real" && (
          <input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="Group name (optional)"
            className="mb-4 w-full rounded-xl border border-ely-border bg-ely-card px-3 py-2.5 text-sm"
          />
        )}

        {mode === "ai" && (
          <div className="mb-4 space-y-3">
            <select
              value={topic}
              onChange={(e) => setTopic(e.target.value)}
              className="w-full rounded-xl border border-ely-border bg-ely-card px-3 py-2.5 text-sm"
            >
              {topics.map((t) => (
                <option key={t} value={t}>
                  {t}
                </option>
              ))}
            </select>
            <input
              value={customTopic}
              onChange={(e) => setCustomTopic(e.target.value)}
              placeholder="Or custom topic..."
              className="w-full rounded-xl border border-ely-border bg-ely-card px-3 py-2.5 text-sm"
            />
            <div>
              <label className="text-xs text-ely-muted">Rounds per persona: {exchanges}</label>
              <input
                type="range"
                min={2}
                max={6}
                value={exchanges}
                onChange={(e) => setExchanges(Number(e.target.value))}
                className="w-full"
              />
            </div>
          </div>
        )}

        {error && <p className="mb-3 text-sm text-red-400">{error}</p>}

        <Button className="w-full" onClick={submit} disabled={loading}>
          {loading ? "Creating..." : mode === "real" ? "Start group chat" : "Generate group AI dialogue"}
        </Button>
      </div>
    </div>
  );
}
