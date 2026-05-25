"use client";

import { useEffect, useRef, useState } from "react";
import { useParams, useSearchParams, useRouter } from "next/navigation";
import { AppShell } from "@/components/app-shell";
import { apiFetch } from "@/lib/utils";
import { ChevronLeft, Send, Sparkles } from "lucide-react";
import { Button } from "@/components/ui";

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

export default function CommunityDmPage() {
  const params = useParams();
  const searchParams = useSearchParams();
  const router = useRouter();
  const conversationId = params.conversationId as string;
  const isAi = searchParams.get("ai") === "1";

  const [title, setTitle] = useState("Conversation");
  const [type, setType] = useState<string>("DIRECT");
  const [messages, setMessages] = useState<SocialMessage[]>([]);
  const [input, setInput] = useState("");
  const [sending, setSending] = useState(false);
  const [myUserId, setMyUserId] = useState<string | null>(null);
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const user = JSON.parse(localStorage.getItem("ely_user") || "{}");
    setMyUserId(user.id || null);
    loadConversation();
  }, [conversationId]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  async function loadConversation() {
    try {
      const data = await apiFetch(`/community/conversation/${conversationId}`);
      setTitle(data.conversation.title);
      setType(data.conversation.type);
      setMessages(data.messages || []);
    } catch {
      /* empty */
    }
  }

  async function sendMessage() {
    if (!input.trim() || sending || type !== "DIRECT") return;
    const content = input.trim();
    setInput("");
    setSending(true);

    setMessages((prev) => [...prev, { id: `tmp-${Date.now()}`, role: "USER", content }]);

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

  return (
    <AppShell>
      <div className="mx-auto flex h-[calc(100vh-4rem)] max-w-2xl flex-col md:h-[calc(100vh-2rem)]">
        <header className="flex items-center gap-3 border-b border-ely-border px-4 py-3">
          <button onClick={() => router.push("/community")} className="rounded-lg p-2 text-ely-muted hover:bg-white/5">
            <ChevronLeft size={20} />
          </button>
          <div className="min-w-0 flex-1">
            <h1 className="truncate font-semibold">{title}</h1>
            <p className="text-xs text-ely-muted">
              {type === "AI_PERSONA" ? "AI persona conversation" : "Direct message"}
            </p>
          </div>
          {isAi && <Sparkles size={18} className="text-ely-accent shrink-0" />}
        </header>

        <div className="flex-1 space-y-4 overflow-y-auto px-4 py-4">
          {messages.map((msg) => {
            const isMine = type === "DIRECT" && msg.senderId === myUserId;
            const meta = msg.metadata || {};

            if (type === "AI_PERSONA") {
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

            return (
              <div key={msg.id} className={`flex ${isMine ? "justify-end" : "justify-start"}`}>
                <div
                  className={`max-w-[85%] rounded-2xl px-4 py-3 text-sm ${
                    isMine ? "bg-ely-primary text-white rounded-br-md" : "glass rounded-bl-md"
                  }`}
                >
                  {msg.content}
                </div>
              </div>
            );
          })}
          <div ref={bottomRef} />
        </div>

        {type === "DIRECT" ? (
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
            This AI persona battle is read-only — start another from Community.
          </div>
        )}
      </div>
    </AppShell>
  );
}
