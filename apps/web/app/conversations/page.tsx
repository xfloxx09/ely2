"use client";

import { useEffect, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { AppShell } from "@/components/app-shell";
import { apiFetch } from "@/lib/utils";
import { MessageSquare, Sparkles, User } from "lucide-react";

type InboxItem = {
  id: string;
  type: "DIRECT" | "AI_PERSONA";
  title: string;
  subtitle: string;
  lastMessage: string | null;
  lastMessageAt: string | null;
  unreadCount: number;
  peerName?: string | null;
  peerAvatarUrl?: string | null;
  topic?: string;
};

function formatWhen(iso: string | null) {
  if (!iso) return "";
  const d = new Date(iso);
  const now = new Date();
  const diff = now.getTime() - d.getTime();
  if (diff < 86400000) {
    return d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
  }
  if (diff < 604800000) {
    return d.toLocaleDateString([], { weekday: "short" });
  }
  return d.toLocaleDateString([], { month: "short", day: "numeric" });
}

function ConversationRow({ item, onClick }: { item: InboxItem; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="flex w-full items-start gap-3 rounded-xl border border-transparent px-3 py-3 text-left transition hover:border-white/10 hover:bg-white/[0.04]"
    >
      <div className="relative h-12 w-12 shrink-0 overflow-hidden rounded-xl border border-white/10">
        {item.peerAvatarUrl ? (
          <img src={item.peerAvatarUrl} alt="" className="h-full w-full object-cover" />
        ) : item.type === "AI_PERSONA" ? (
          <div className="flex h-full w-full items-center justify-center bg-ely-accent/20">
            <Sparkles size={18} className="text-ely-accent" />
          </div>
        ) : (
          <div className="flex h-full w-full items-center justify-center bg-ely-primary/20">
            <User size={18} />
          </div>
        )}
        {item.unreadCount > 0 && (
          <span className="absolute -right-1 -top-1 flex h-5 min-w-5 items-center justify-center rounded-full bg-ely-primary px-1 text-[10px] font-bold text-white">
            {item.unreadCount > 9 ? "9+" : item.unreadCount}
          </span>
        )}
      </div>
      <div className="min-w-0 flex-1">
        <div className="flex items-baseline justify-between gap-2">
          <p className={`truncate text-sm ${item.unreadCount ? "font-semibold text-white" : "font-medium text-white/90"}`}>
            {item.title}
          </p>
          <span className="shrink-0 text-[10px] text-ely-muted">{formatWhen(item.lastMessageAt)}</span>
        </div>
        <p className="mt-0.5 truncate text-xs text-ely-muted">{item.lastMessage || item.subtitle}</p>
      </div>
    </button>
  );
}

export default function ConversationsPage() {
  const router = useRouter();
  const [direct, setDirect] = useState<InboxItem[]>([]);
  const [avatar, setAvatar] = useState<InboxItem[]>([]);
  const [totalUnread, setTotalUnread] = useState(0);
  const [loading, setLoading] = useState(true);

  const loadInbox = useCallback(async () => {
    try {
      const data = await apiFetch("/conversations/inbox");
      setDirect(data.direct || []);
      setAvatar(data.avatar || []);
      setTotalUnread(data.totalUnread ?? 0);
    } catch {
      /* empty */
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadInbox();
    const t = setInterval(loadInbox, 20000);
    return () => clearInterval(t);
  }, [loadInbox]);

  return (
    <AppShell unreadConversations={totalUnread}>
      <div className="mx-auto max-w-2xl px-4 py-6 safe-top">
        <header className="mb-6">
          <h1 className="text-2xl font-bold text-white">Conversations</h1>
          <p className="mt-1 text-sm text-ely-muted">
            {totalUnread > 0 ? `${totalUnread} unread` : "All caught up"}
          </p>
        </header>

        {loading ? (
          <p className="text-sm text-ely-muted">Loading conversations...</p>
        ) : (
          <div className="space-y-8">
            <section>
              <div className="mb-3 flex items-center gap-2 text-sm font-medium text-white/80">
                <MessageSquare size={16} className="text-ely-primary" />
                Real conversations
              </div>
              {direct.length === 0 ? (
                <p className="rounded-xl border border-dashed border-white/10 px-4 py-8 text-center text-sm text-ely-muted">
                  No direct messages yet. Find someone in Community and send a DM.
                </p>
              ) : (
                <div className="space-y-1">
                  {direct.map((item) => (
                    <ConversationRow
                      key={item.id}
                      item={item}
                      onClick={() => router.push(`/conversations/${item.id}`)}
                    />
                  ))}
                </div>
              )}
            </section>

            <section>
              <div className="mb-3 flex items-center gap-2 text-sm font-medium text-white/80">
                <Sparkles size={16} className="text-ely-accent" />
                Avatar conversations
              </div>
              <p className="mb-3 text-xs text-ely-muted">AI-generated dialogues between travelers&apos; personas</p>
              {avatar.length === 0 ? (
                <p className="rounded-xl border border-dashed border-white/10 px-4 py-8 text-center text-sm text-ely-muted">
                  No avatar battles yet. Start one from a profile in Community.
                </p>
              ) : (
                <div className="space-y-1">
                  {avatar.map((item) => (
                    <ConversationRow
                      key={item.id}
                      item={item}
                      onClick={() => router.push(`/conversations/${item.id}`)}
                    />
                  ))}
                </div>
              )}
            </section>
          </div>
        )}
      </div>
    </AppShell>
  );
}
