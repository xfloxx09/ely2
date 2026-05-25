"use client";

import { useEffect, useRef, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { AppShell } from "@/components/app-shell";
import { apiFetch } from "@/lib/utils";
import { ChevronLeft, Send, Sparkles, Users, UserPlus } from "lucide-react";
import { Button } from "@/components/ui";
import { ConversationActions } from "@/components/conversations/ConversationActions";

type SocialMessage = {
  id: string;
  role: string;
  content: string;
  senderId?: string | null;
  metadata?: {
    speakerName?: string;
    avatarUrl?: string;
    personaSide?: string;
  };
};

type Participant = { id: string; name: string; avatarUrl?: string | null };

function isRealType(type: string) {
  return type === "DIRECT" || type === "GROUP";
}

function isAvatarType(type: string) {
  return type === "AI_PERSONA" || type === "GROUP_AI";
}

export default function ConversationThreadPage() {
  const params = useParams();
  const router = useRouter();
  const conversationId = params.conversationId as string;

  const [title, setTitle] = useState("Conversation");
  const [type, setType] = useState<string>("DIRECT");
  const [messages, setMessages] = useState<SocialMessage[]>([]);
  const [participants, setParticipants] = useState<Participant[]>([]);
  const [folders, setFolders] = useState<{ id: string; name: string; kind: "real" | "avatar" }[]>([]);
  const [input, setInput] = useState("");
  const [sending, setSending] = useState(false);
  const [myUserId, setMyUserId] = useState<string | null>(null);
  const [showAddPeople, setShowAddPeople] = useState(false);
  const [communityUsers, setCommunityUsers] = useState<Participant[]>([]);
  const [addSelected, setAddSelected] = useState<string[]>([]);
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const user = JSON.parse(localStorage.getItem("ely_user") || "{}");
    setMyUserId(user.id || null);
    loadConversation();
    loadFolders();
  }, [conversationId]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  async function loadFolders() {
    try {
      const data = await apiFetch("/conversations/inbox");
      setFolders(data.folders || []);
    } catch {
      /* empty */
    }
  }

  async function loadConversation() {
    try {
      const data = await apiFetch(`/community/conversation/${conversationId}`);
      setTitle(data.conversation.title);
      setType(data.conversation.type);
      setMessages(data.messages || []);
      setParticipants(data.participants || []);
    } catch {
      /* empty */
    }
  }

  async function sendMessage() {
    if (!input.trim() || sending || !isRealType(type)) return;
    const content = input.trim();
    setInput("");
    setSending(true);

    setMessages((prev) => [
      ...prev,
      { id: `tmp-${Date.now()}`, role: "USER", content, senderId: myUserId },
    ]);

    try {
      await apiFetch(`/community/conversation/${conversationId}/message`, {
        method: "POST",
        body: JSON.stringify({ content }),
      });
      await loadConversation();
    } catch {
      /* keep optimistic */
    } finally {
      setSending(false);
    }
  }

  async function openAddPeople() {
    setShowAddPeople(true);
    try {
      const data = await apiFetch("/community/users");
      const existing = new Set(participants.map((p) => p.id));
      setCommunityUsers(
        (data.users || [])
          .filter((u: Participant) => !existing.has(u.id))
          .map((u: { id: string; name: string | null; avatarUrl: string | null }) => ({
            id: u.id,
            name: u.name || "Traveler",
            avatarUrl: u.avatarUrl,
          }))
      );
    } catch {
      /* empty */
    }
  }

  async function addPeople() {
    if (!addSelected.length) return;
    await apiFetch(`/community/conversation/${conversationId}/participants`, {
      method: "POST",
      body: JSON.stringify({ participantIds: addSelected }),
    });
    setShowAddPeople(false);
    setAddSelected([]);
    loadConversation();
  }

  const kind = isAvatarType(type) ? "avatar" : "real";
  const typeLabel =
    type === "GROUP"
      ? "Group chat"
      : type === "GROUP_AI"
        ? "Group avatar dialogue"
        : type === "AI_PERSONA"
          ? "Avatar conversation"
          : "Direct message";

  return (
    <AppShell>
      <div className="mx-auto flex h-[calc(100vh-4rem)] max-w-2xl flex-col md:h-[calc(100vh-2rem)]">
        <header className="flex items-center gap-2 border-b border-ely-border px-4 py-3">
          <button
            onClick={() => router.push("/conversations")}
            className="rounded-lg p-2 text-ely-muted hover:bg-white/5"
          >
            <ChevronLeft size={20} />
          </button>
          <div className="min-w-0 flex-1">
            <h1 className="truncate font-semibold">{title}</h1>
            <p className="text-xs text-ely-muted">{typeLabel}</p>
            {participants.length > 0 && (
              <p className="mt-0.5 truncate text-[10px] text-ely-muted">
                {participants.map((p) => p.name).join(" · ")}
              </p>
            )}
          </div>
          {type === "GROUP" && (
            <button
              type="button"
              onClick={openAddPeople}
              className="rounded-lg p-2 text-ely-muted hover:bg-white/5"
              title="Add people"
            >
              <UserPlus size={18} />
            </button>
          )}
          {isAvatarType(type) && <Sparkles size={18} className="shrink-0 text-ely-accent" />}
          {type === "GROUP" && <Users size={18} className="shrink-0 text-ely-primary" />}
          <ConversationActions
            conversationId={conversationId}
            kind={kind}
            folders={folders}
            onChanged={() => router.push("/conversations")}
          />
        </header>

        <div className="flex-1 space-y-4 overflow-y-auto px-4 py-4">
          {messages.map((msg) => {
            const isMine = isRealType(type) && msg.senderId === myUserId;
            const meta = msg.metadata || {};

            if (isAvatarType(type)) {
              return (
                <div key={msg.id} className="flex gap-3">
                  <div className="h-10 w-10 shrink-0 overflow-hidden rounded-xl border border-white/10">
                    {meta.avatarUrl ? (
                      <img src={meta.avatarUrl} alt="" className="h-full w-full object-cover" />
                    ) : (
                      <div className="flex h-full w-full items-center justify-center bg-ely-primary/20 text-xs">
                        {meta.personaSide || "?"}
                      </div>
                    )}
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="mb-1 text-xs font-medium text-ely-accent">{meta.speakerName || "Persona"}</p>
                    <div className="rounded-2xl rounded-tl-md glass px-4 py-3 text-sm leading-relaxed">{msg.content}</div>
                  </div>
                </div>
              );
            }

            const senderName =
              type === "GROUP" && !isMine
                ? participants.find((p) => p.id === msg.senderId)?.name
                : null;

            return (
              <div key={msg.id} className={`flex flex-col ${isMine ? "items-end" : "items-start"}`}>
                {senderName && <span className="mb-1 px-1 text-[10px] text-ely-muted">{senderName}</span>}
                <div
                  className={`max-w-[85%] rounded-2xl px-4 py-3 text-sm ${
                    isMine ? "rounded-br-md bg-ely-primary text-white" : "glass rounded-bl-md"
                  }`}
                >
                  {msg.content}
                </div>
              </div>
            );
          })}
          <div ref={bottomRef} />
        </div>

        {isRealType(type) ? (
          <div className="safe-bottom border-t border-ely-border p-4">
            <div className="flex gap-2">
              <input
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && (e.preventDefault(), sendMessage())}
                placeholder="Type a message..."
                className="min-h-[44px] flex-1 rounded-full border border-ely-border bg-ely-card px-4 py-3 text-sm outline-none focus:border-ely-primary"
                disabled={sending}
              />
              <Button onClick={sendMessage} disabled={!input.trim() || sending} className="h-11 w-11 rounded-full p-0">
                <Send size={18} />
              </Button>
            </div>
          </div>
        ) : (
          <div className="safe-bottom border-t border-ely-border p-4 text-center text-sm text-ely-muted">
            Read-only avatar dialogue — start a new one from Community or Conversations.
          </div>
        )}
      </div>

      {showAddPeople && (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/70 p-4 sm:items-center">
          <div className="w-full max-w-md rounded-2xl border border-white/10 bg-[#12121a] p-5">
            <h3 className="mb-3 font-semibold">Add people to group</h3>
            <div className="mb-4 max-h-48 space-y-1 overflow-y-auto">
              {communityUsers.map((u) => (
                <label key={u.id} className="flex cursor-pointer items-center gap-2 rounded-lg px-2 py-2 hover:bg-white/5">
                  <input
                    type="checkbox"
                    checked={addSelected.includes(u.id)}
                    onChange={() =>
                      setAddSelected((prev) =>
                        prev.includes(u.id) ? prev.filter((x) => x !== u.id) : [...prev, u.id]
                      )
                    }
                  />
                  <span className="text-sm">{u.name}</span>
                </label>
              ))}
              {communityUsers.length === 0 && (
                <p className="text-sm text-ely-muted">No more travelers to add.</p>
              )}
            </div>
            <div className="flex gap-2">
              <Button variant="secondary" className="flex-1" onClick={() => setShowAddPeople(false)}>
                Cancel
              </Button>
              <Button className="flex-1" onClick={addPeople} disabled={!addSelected.length}>
                Add
              </Button>
            </div>
          </div>
        </div>
      )}
    </AppShell>
  );
}
