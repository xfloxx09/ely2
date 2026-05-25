"use client";

import { useEffect, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { AppShell } from "@/components/app-shell";
import { apiFetch } from "@/lib/utils";
import { MessageSquare, Sparkles, User, FolderPlus, Users, Plus } from "lucide-react";
import { ConversationActions } from "@/components/conversations/ConversationActions";
import { GroupCreateModal } from "@/components/conversations/GroupCreateModal";

type InboxItem = {
  id: string;
  type: "DIRECT" | "GROUP" | "AI_PERSONA" | "GROUP_AI";
  title: string;
  subtitle: string;
  lastMessage: string | null;
  lastMessageAt: string | null;
  unreadCount: number;
  peerAvatarUrl?: string | null;
  topic?: string;
  folderId?: string | null;
  archived?: boolean;
  participantCount?: number;
  participantNames?: string[];
};

type Folder = {
  id: string;
  name: string;
  kind: "real" | "avatar";
  conversationCount: number;
};

function formatWhen(iso: string | null) {
  if (!iso) return "";
  const d = new Date(iso);
  const now = new Date();
  const diff = now.getTime() - d.getTime();
  if (diff < 86400000) return d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
  if (diff < 604800000) return d.toLocaleDateString([], { weekday: "short" });
  return d.toLocaleDateString([], { month: "short", day: "numeric" });
}

function ConversationRow({
  item,
  kind,
  folders,
  onOpen,
  onChanged,
}: {
  item: InboxItem;
  kind: "real" | "avatar";
  folders: Folder[];
  onOpen: () => void;
  onChanged: () => void;
}) {
  const isGroup = item.type === "GROUP" || item.type === "GROUP_AI";

  return (
    <div className="flex items-start gap-1 rounded-xl border border-transparent px-1 py-1 transition hover:border-white/10 hover:bg-white/[0.04]">
      <button type="button" onClick={onOpen} className="flex min-w-0 flex-1 items-start gap-3 px-2 py-2 text-left">
        <div className="relative h-12 w-12 shrink-0 overflow-hidden rounded-xl border border-white/10">
          {item.peerAvatarUrl && !isGroup ? (
            <img src={item.peerAvatarUrl} alt="" className="h-full w-full object-cover" />
          ) : item.type === "AI_PERSONA" || item.type === "GROUP_AI" ? (
            <div className="flex h-full w-full items-center justify-center bg-ely-accent/20">
              <Sparkles size={18} className="text-ely-accent" />
            </div>
          ) : isGroup ? (
            <div className="flex h-full w-full items-center justify-center bg-ely-primary/20">
              <Users size={18} />
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
      <ConversationActions
        conversationId={item.id}
        kind={kind}
        archived={item.archived}
        folders={folders}
        onChanged={onChanged}
      />
    </div>
  );
}

export default function ConversationsPage() {
  const router = useRouter();
  const [direct, setDirect] = useState<InboxItem[]>([]);
  const [avatar, setAvatar] = useState<InboxItem[]>([]);
  const [folders, setFolders] = useState<Folder[]>([]);
  const [totalUnread, setTotalUnread] = useState(0);
  const [loading, setLoading] = useState(true);
  const [view, setView] = useState<"active" | "archived">("active");
  const [folderFilter, setFolderFilter] = useState<string | undefined>(undefined);
  const [showGroupModal, setShowGroupModal] = useState(false);
  const [newFolderName, setNewFolderName] = useState("");
  const [newFolderKind, setNewFolderKind] = useState<"real" | "avatar">("real");
  const [showNewFolder, setShowNewFolder] = useState(false);

  const loadInbox = useCallback(async () => {
    try {
      const params = new URLSearchParams({ view });
      if (folderFilter === "none") params.set("folderId", "none");
      else if (folderFilter) params.set("folderId", folderFilter);

      const data = await apiFetch(`/conversations/inbox?${params.toString()}`);
      setDirect(data.direct || []);
      setAvatar(data.avatar || []);
      setTotalUnread(data.totalUnread ?? 0);
      setFolders(data.folders || []);
    } catch {
      /* empty */
    } finally {
      setLoading(false);
    }
  }, [view, folderFilter]);

  useEffect(() => {
    loadInbox();
    const t = setInterval(loadInbox, 20000);
    return () => clearInterval(t);
  }, [loadInbox]);

  async function createFolder() {
    const name = newFolderName.trim();
    if (!name) return;
    await apiFetch("/conversations/folders", {
      method: "POST",
      body: JSON.stringify({ name, kind: newFolderKind }),
    });
    setNewFolderName("");
    setShowNewFolder(false);
    loadInbox();
  }

  const realFolders = folders.filter((f) => f.kind === "real");
  const avatarFolders = folders.filter((f) => f.kind === "avatar");

  return (
    <AppShell unreadConversations={totalUnread}>
      <div className="mx-auto max-w-2xl px-4 py-6 safe-top">
        <header className="mb-4 flex items-start justify-between gap-3">
          <div>
            <h1 className="text-2xl font-bold text-white">Conversations</h1>
            <p className="mt-1 text-sm text-ely-muted">
              {totalUnread > 0 ? `${totalUnread} unread` : "All caught up"}
            </p>
          </div>
          <button
            type="button"
            onClick={() => setShowGroupModal(true)}
            className="flex items-center gap-1.5 rounded-xl bg-ely-primary/20 px-3 py-2 text-sm font-medium text-white hover:bg-ely-primary/30"
          >
            <Plus size={16} /> Group
          </button>
        </header>

        <div className="mb-4 flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => setView("active")}
            className={`rounded-full px-3 py-1.5 text-xs ${view === "active" ? "bg-white/10 text-white" : "text-ely-muted"}`}
          >
            Active
          </button>
          <button
            type="button"
            onClick={() => setView("archived")}
            className={`rounded-full px-3 py-1.5 text-xs ${view === "archived" ? "bg-white/10 text-white" : "text-ely-muted"}`}
          >
            Archived
          </button>
          <button
            type="button"
            onClick={() => setFolderFilter(undefined)}
            className={`rounded-full px-3 py-1.5 text-xs ${folderFilter === undefined ? "bg-ely-primary/20 text-white" : "text-ely-muted"}`}
          >
            All folders
          </button>
          <button
            type="button"
            onClick={() => setFolderFilter("none")}
            className={`rounded-full px-3 py-1.5 text-xs ${folderFilter === "none" ? "bg-ely-primary/20 text-white" : "text-ely-muted"}`}
          >
            Inbox only
          </button>
          {[...realFolders, ...avatarFolders].map((f) => (
            <button
              key={f.id}
              type="button"
              onClick={() => setFolderFilter(f.id)}
              className={`rounded-full px-3 py-1.5 text-xs ${folderFilter === f.id ? "bg-ely-primary/20 text-white" : "text-ely-muted"}`}
            >
              {f.name} ({f.conversationCount})
            </button>
          ))}
          <button
            type="button"
            onClick={() => setShowNewFolder((v) => !v)}
            className="flex items-center gap-1 rounded-full px-3 py-1.5 text-xs text-ely-muted hover:text-white"
          >
            <FolderPlus size={12} /> New folder
          </button>
        </div>

        {showNewFolder && (
          <div className="mb-4 flex flex-wrap gap-2 rounded-xl border border-white/10 p-3">
            <input
              value={newFolderName}
              onChange={(e) => setNewFolderName(e.target.value)}
              placeholder="Folder name"
              className="min-w-[140px] flex-1 rounded-lg border border-ely-border bg-ely-card px-3 py-2 text-sm"
            />
            <select
              value={newFolderKind}
              onChange={(e) => setNewFolderKind(e.target.value as "real" | "avatar")}
              className="rounded-lg border border-ely-border bg-ely-card px-3 py-2 text-sm"
            >
              <option value="real">Real chats</option>
              <option value="avatar">Avatar chats</option>
            </select>
            <button
              type="button"
              onClick={createFolder}
              className="rounded-lg bg-ely-primary px-4 py-2 text-sm text-white"
            >
              Create
            </button>
          </div>
        )}

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
                  {view === "archived" ? "No archived real conversations." : "No direct messages yet. Find someone in Community or start a group chat."}
                </p>
              ) : (
                <div className="space-y-1">
                  {direct.map((item) => (
                    <ConversationRow
                      key={item.id}
                      item={item}
                      kind="real"
                      folders={folders}
                      onOpen={() => router.push(`/conversations/${item.id}`)}
                      onChanged={loadInbox}
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
                  {view === "archived" ? "No archived avatar conversations." : "No avatar battles yet. Start one from Community or create a group AI chat."}
                </p>
              ) : (
                <div className="space-y-1">
                  {avatar.map((item) => (
                    <ConversationRow
                      key={item.id}
                      item={item}
                      kind="avatar"
                      folders={folders}
                      onOpen={() => router.push(`/conversations/${item.id}`)}
                      onChanged={loadInbox}
                    />
                  ))}
                </div>
              )}
            </section>
          </div>
        )}
      </div>

      {showGroupModal && <GroupCreateModal onClose={() => setShowGroupModal(false)} />}
    </AppShell>
  );
}
