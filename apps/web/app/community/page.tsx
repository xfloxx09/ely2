"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { AppShell } from "@/components/app-shell";
import { apiFetch } from "@/lib/utils";
import { MessageCircle, Sparkles, Trophy, Flame, X, Send } from "lucide-react";
import { Button } from "@/components/ui";

type CommunityUser = {
  id: string;
  name: string | null;
  avatarUrl: string | null;
  level: number;
  totalXp: number;
  currentStreak: number;
  styleSummary: string | null;
};

type Leaderboard = {
  xp: { id: string; name: string | null; avatarUrl: string | null; level: number; totalXp: number }[];
  streaks: {
    id: string;
    name: string | null;
    avatarUrl: string | null;
    currentStreak: number;
    longestStreak: number;
  }[];
  myRank: number | null;
  myXp: number;
};

export default function CommunityPage() {
  const router = useRouter();
  const [users, setUsers] = useState<CommunityUser[]>([]);
  const [leaderboard, setLeaderboard] = useState<Leaderboard | null>(null);
  const [topics, setTopics] = useState<string[]>([]);
  const [selected, setSelected] = useState<CommunityUser | null>(null);
  const [mode, setMode] = useState<"choose" | "dm" | "ai">("choose");
  const [topic, setTopic] = useState("");
  const [customTopic, setCustomTopic] = useState("");
  const [exchanges, setExchanges] = useState(4);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    Promise.all([
      apiFetch("/community/users"),
      apiFetch("/community/leaderboard"),
      apiFetch("/community/topics"),
    ])
      .then(([u, lb, t]) => {
        setUsers(u.users || []);
        setLeaderboard(lb);
        setTopics(t.topics || []);
        if (t.topics?.[0]) setTopic(t.topics[0]);
      })
      .catch(() => setError("Could not load community"));
  }, []);

  function openUser(user: CommunityUser) {
    setSelected(user);
    setMode("choose");
    setError(null);
  }

  function closeModal() {
    setSelected(null);
    setMode("choose");
    setError(null);
  }

  async function startDirectDm() {
    if (!selected) return;
    setLoading(true);
    setError(null);
    try {
      const data = await apiFetch("/community/dm", {
        method: "POST",
        body: JSON.stringify({ recipientId: selected.id }),
      });
      router.push(`/community/dm/${data.conversation.id}`);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setLoading(false);
    }
  }

  async function startAiBattle() {
    if (!selected) return;
    const finalTopic = customTopic.trim() || topic;
    if (!finalTopic) return;

    setLoading(true);
    setError(null);
    try {
      const data = await apiFetch("/community/ai-battle", {
        method: "POST",
        body: JSON.stringify({
          targetUserId: selected.id,
          topic: finalTopic,
          exchanges,
        }),
      });
      router.push(`/community/dm/${data.conversation.id}?ai=1`);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <AppShell>
      <div className="mx-auto max-w-6xl px-4 py-6 safe-top">
        <header className="mb-8">
          <h1 className="text-2xl font-bold text-white">Community</h1>
          <p className="mt-1 text-sm text-ely-muted">Meet travelers, climb the boards, start conversations</p>
        </header>

        {leaderboard && (
          <section className="mb-8 grid gap-4 md:grid-cols-2">
            <div className="glass rounded-2xl p-5">
              <div className="mb-4 flex items-center gap-2 text-ely-accent">
                <Trophy size={18} />
                <h2 className="font-semibold">XP Leaders</h2>
              </div>
              <ol className="space-y-2">
                {leaderboard.xp.map((row, i) => (
                  <li key={row.id} className="flex items-center gap-3 rounded-xl bg-white/[0.03] px-3 py-2">
                    <span className="w-5 text-xs text-ely-muted">{i + 1}</span>
                    <AvatarThumb url={row.avatarUrl} name={row.name} />
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium">{row.name || "Traveler"}</p>
                      <p className="text-xs text-ely-muted">Lv.{row.level} · {row.totalXp} XP</p>
                    </div>
                  </li>
                ))}
              </ol>
              {leaderboard.myRank && (
                <p className="mt-3 text-xs text-ely-muted">Your rank: #{leaderboard.myRank} ({leaderboard.myXp} XP)</p>
              )}
            </div>

            <div className="glass rounded-2xl p-5">
              <div className="mb-4 flex items-center gap-2 text-orange-400">
                <Flame size={18} />
                <h2 className="font-semibold">Streak Champions</h2>
              </div>
              <ol className="space-y-2">
                {leaderboard.streaks.map((row, i) => (
                  <li key={row.id} className="flex items-center gap-3 rounded-xl bg-white/[0.03] px-3 py-2">
                    <span className="w-5 text-xs text-ely-muted">{i + 1}</span>
                    <AvatarThumb url={row.avatarUrl} name={row.name} />
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium">{row.name || "Traveler"}</p>
                      <p className="text-xs text-ely-muted">{row.currentStreak} day streak</p>
                    </div>
                  </li>
                ))}
              </ol>
            </div>
          </section>
        )}

        <section>
          <h2 className="mb-4 text-lg font-semibold">All travelers</h2>
          {users.length === 0 ? (
            <p className="text-sm text-ely-muted">No other travelers yet — complete onboarding to appear here.</p>
          ) : (
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5">
              {users.map((user) => (
                <button
                  key={user.id}
                  onClick={() => openUser(user)}
                  className="glass group rounded-2xl p-4 text-left transition hover:border-ely-primary/30 hover:bg-white/[0.06]"
                >
                  <div className="mx-auto mb-3 h-16 w-16 overflow-hidden rounded-2xl border border-white/10">
                    {user.avatarUrl ? (
                      <img src={user.avatarUrl} alt="" className="h-full w-full object-cover" />
                    ) : (
                      <div className="flex h-full w-full items-center justify-center bg-gradient-to-br from-ely-primary/40 to-ely-secondary/40">
                        <Sparkles size={20} />
                      </div>
                    )}
                  </div>
                  <p className="truncate text-center text-sm font-medium">{user.name || "Traveler"}</p>
                  <p className="mt-0.5 text-center text-[11px] text-ely-muted">Lv.{user.level}</p>
                </button>
              ))}
            </div>
          )}
        </section>
      </div>

      {selected && (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/70 p-4 sm:items-center">
          <div className="max-h-[90vh] w-full max-w-md overflow-y-auto rounded-2xl border border-white/10 bg-[#12121a] p-5 shadow-2xl">
            <div className="mb-4 flex items-start justify-between">
              <div className="flex items-center gap-3">
                <div className="h-14 w-14 overflow-hidden rounded-xl border border-white/10">
                  {selected.avatarUrl ? (
                    <img src={selected.avatarUrl} alt="" className="h-full w-full object-cover" />
                  ) : (
                    <div className="flex h-full w-full items-center justify-center bg-ely-primary/30">
                      <Sparkles size={18} />
                    </div>
                  )}
                </div>
                <div>
                  <h3 className="font-semibold">{selected.name || "Traveler"}</h3>
                  <p className="text-xs text-ely-muted">Lv.{selected.level} · {selected.totalXp} XP</p>
                </div>
              </div>
              <button onClick={closeModal} className="rounded-lg p-2 text-ely-muted hover:bg-white/5 hover:text-white">
                <X size={18} />
              </button>
            </div>

            {selected.styleSummary && (
              <p className="mb-4 text-sm leading-relaxed text-white/70">{selected.styleSummary}</p>
            )}

            {error && <p className="mb-3 text-sm text-red-400">{error}</p>}

            {mode === "choose" && (
              <div className="space-y-2">
                <Button className="w-full justify-start gap-2" onClick={() => setMode("dm")}>
                  <MessageCircle size={16} /> Message as yourself (DM)
                </Button>
                <Button variant="secondary" className="w-full justify-start gap-2" onClick={() => setMode("ai")}>
                  <Sparkles size={16} /> AI persona battle
                </Button>
              </div>
            )}

            {mode === "dm" && (
              <div className="space-y-3">
                <p className="text-sm text-ely-muted">Start a real direct message with {selected.name || "this traveler"}.</p>
                <Button className="w-full" onClick={startDirectDm} disabled={loading}>
                  <Send size={16} className="mr-2" /> Open DM
                </Button>
                <button onClick={() => setMode("choose")} className="w-full text-sm text-ely-muted hover:text-white">
                  Back
                </button>
              </div>
            )}

            {mode === "ai" && (
              <div className="space-y-3">
                <p className="text-sm text-ely-muted">Let your ELY avatars chat about a topic you choose.</p>
                <label className="block text-xs text-ely-muted">Standard topics</label>
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
                <label className="block text-xs text-ely-muted">Or custom topic</label>
                <input
                  value={customTopic}
                  onChange={(e) => setCustomTopic(e.target.value)}
                  placeholder="Write your own topic..."
                  className="w-full rounded-xl border border-ely-border bg-ely-card px-3 py-2.5 text-sm"
                />
                <label className="block text-xs text-ely-muted">Exchanges (each = 2 lines)</label>
                <input
                  type="range"
                  min={2}
                  max={8}
                  value={exchanges}
                  onChange={(e) => setExchanges(Number(e.target.value))}
                  className="w-full"
                />
                <p className="text-center text-xs text-ely-muted">{exchanges} exchanges · {exchanges * 2} lines</p>
                <Button className="w-full" onClick={startAiBattle} disabled={loading}>
                  {loading ? "Generating..." : "Start AI conversation"}
                </Button>
                <button onClick={() => setMode("choose")} className="w-full text-sm text-ely-muted hover:text-white">
                  Back
                </button>
              </div>
            )}
          </div>
        </div>
      )}
    </AppShell>
  );
}

function AvatarThumb({ url, name }: { url: string | null; name: string | null }) {
  return (
    <div className="h-9 w-9 shrink-0 overflow-hidden rounded-lg border border-white/10">
      {url ? (
        <img src={url} alt="" className="h-full w-full object-cover" />
      ) : (
        <div className="flex h-full w-full items-center justify-center bg-ely-primary/20 text-[10px]">
          {(name || "?")[0]}
        </div>
      )}
    </div>
  );
}
