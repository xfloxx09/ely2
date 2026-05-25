"use client";

import { useEffect, useRef, useState } from "react";
import { io, Socket } from "socket.io-client";
import { Send, PanelLeftClose, PanelLeftOpen } from "lucide-react";
import { AppShell } from "@/components/app-shell";
import { ChatAvatarFace, ChatAvatarPresence } from "@/components/chat/ChatAvatarPresence";
import { VoiceInputButton } from "@/components/chat/VoiceInputButton";
import { getWsUrl, apiFetch } from "@/lib/utils";
import { inferAvatarEmotion, type AvatarEmotion } from "@ely/personality";

type Message = {
  id?: string;
  role: string;
  content: string;
  modelUsed?: string;
};

const MODULES = ["Concierge", "Scribe", "Kitchen", "Habits", "Research", "Money"];
const AVATAR_EXPANDED_KEY = "ely_chat_avatar_expanded";

export default function ChatPage() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [streaming, setStreaming] = useState("");
  const [emotion, setEmotion] = useState<AvatarEmotion>("idle");
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);
  const [sending, setSending] = useState(false);
  const [avatarExpanded, setAvatarExpanded] = useState(false);
  const socketRef = useRef<Socket | null>(null);
  const useHttpRef = useRef(false);
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    try {
      setAvatarExpanded(localStorage.getItem(AVATAR_EXPANDED_KEY) === "1");
    } catch {
      /* ignore */
    }
  }, []);

  function toggleAvatarExpanded() {
    setAvatarExpanded((prev) => {
      const next = !prev;
      try {
        localStorage.setItem(AVATAR_EXPANDED_KEY, next ? "1" : "0");
      } catch {
        /* ignore */
      }
      return next;
    });
  }

  useEffect(() => {
    const user = JSON.parse(localStorage.getItem("ely_user") || "{}");

    apiFetch("/avatar")
      .then((data) => {
        if (data?.imageUrl) setAvatarUrl(data.imageUrl);
      })
      .catch(() => {});

    apiFetch("/chat/conversation")
      .then((data) => {
        if (data?.messages?.length) {
          setMessages(data.messages);
          const lastAssistant = [...data.messages].reverse().find((m: Message) => m.role === "ASSISTANT");
          if (lastAssistant) setEmotion(inferAvatarEmotion(lastAssistant.content));
        }
      })
      .catch(() => {});

    const wsUrl = getWsUrl();
    if (!wsUrl) {
      useHttpRef.current = true;
      return;
    }

    const socket = io(wsUrl, { transports: ["websocket", "polling"], timeout: 8000 });
    socketRef.current = socket;

    socket.on("connect", () => {
      useHttpRef.current = false;
      socket.emit("join", { userId: user.id });
    });

    socket.on("connect_error", () => {
      useHttpRef.current = true;
    });

    socket.on("history", (history: Message[]) => {
      if (history.length) setMessages(history);
    });

    socket.on("stream", ({ chunk }: { chunk: string }) => {
      setStreaming((prev) => prev + chunk);
      setEmotion("thinking");
    });

    socket.on("done", ({ content }: { content: string }) => {
      setMessages((prev) => [...prev, { role: "ASSISTANT", content }]);
      setStreaming("");
      setEmotion(inferAvatarEmotion(content));
      setSending(false);
    });

    socket.on("avatar_state", ({ state }: { state: string }) => {
      if (state === "thinking") setEmotion("thinking");
      if (state === "listening") setEmotion("listening");
    });

    socket.on("error", () => {
      setSending(false);
      setEmotion("idle");
    });

    return () => {
      socket.disconnect();
    };
  }, []);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, streaming]);

  async function sendViaHttp(content: string) {
    setEmotion("thinking");
    setSending(true);
    try {
      const result = await apiFetch("/chat/message", {
        method: "POST",
        body: JSON.stringify({ content }),
      });
      setMessages((prev) => [...prev, { role: "ASSISTANT", content: result.content, modelUsed: result.model }]);
      setEmotion(result.emotion || inferAvatarEmotion(result.content));
    } catch (err) {
      setMessages((prev) => [
        ...prev,
        { role: "ASSISTANT", content: `Sorry, I couldn't respond: ${(err as Error).message}` },
      ]);
      setEmotion("concerned");
    } finally {
      setSending(false);
    }
  }

  function sendMessage(text?: string) {
    const content = (text ?? input).trim();
    if (!content || sending) return;

    setMessages((prev) => [...prev, { role: "USER", content }]);
    setInput("");
    setStreaming("");
    setEmotion("listening");

    if (useHttpRef.current || !socketRef.current?.connected) {
      sendViaHttp(content);
      return;
    }

    setSending(true);
    setEmotion("thinking");
    socketRef.current.emit("message", { content });
  }

  function ElyMessageBubble({ content, streamingText }: { content: string; streamingText?: boolean }) {
    return (
      <div className="flex justify-start">
        <div className={`flex max-w-[88%] ${avatarExpanded ? "" : "gap-2.5"}`}>
          {!avatarExpanded && (
            <ChatAvatarFace imageUrl={avatarUrl} name="ELY" emotion={emotion} size="sm" />
          )}
          <div className="min-w-0">
            <p className="mb-1 text-xs font-medium text-ely-accent">ELY</p>
            <div className="glass rounded-2xl rounded-bl-md px-4 py-3 text-sm leading-relaxed">
              {content}
              {streamingText && <span className="ml-1 inline-block h-4 w-1 animate-pulse bg-ely-primary" />}
            </div>
          </div>
        </div>
      </div>
    );
  }

  const chatColumn = (
    <div className="flex min-h-0 min-w-0 flex-1 flex-col">
      <header className="border-b border-ely-border px-4 py-3">
        <div className="flex items-center gap-2">
          <div className="min-w-0 flex-1">
            <ChatAvatarPresence
              imageUrl={avatarUrl}
              name="ELY"
              emotion={emotion}
              compact
              showEdit={!avatarExpanded}
            />
          </div>
          <button
            type="button"
            onClick={toggleAvatarExpanded}
            className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-white/10 text-ely-muted transition hover:bg-white/5 hover:text-white"
            title={avatarExpanded ? "Minimize avatar" : "Expand avatar"}
            aria-pressed={avatarExpanded}
          >
            {avatarExpanded ? <PanelLeftClose size={16} /> : <PanelLeftOpen size={16} />}
          </button>
        </div>
      </header>

      <div className="flex gap-2 overflow-x-auto px-4 py-2">
        {MODULES.map((m) => (
          <button
            key={m}
            onClick={() => setInput(`Help me with ${m.toLowerCase()}: `)}
            className="min-h-[32px] whitespace-nowrap rounded-full px-3 py-1.5 text-xs glass hover:bg-white/10"
          >
            {m}
          </button>
        ))}
      </div>

      <div className="flex-1 space-y-4 overflow-y-auto px-4 py-4">
        {messages.length === 0 && !streaming && (
          <div className="flex flex-col items-center py-10 text-center">
            {!avatarExpanded && (
              <ChatAvatarPresence imageUrl={avatarUrl} name="ELY" emotion={emotion} showEdit={false} />
            )}
            <p className={`text-ely-muted ${avatarExpanded ? "" : "mt-6"}`}>Start a conversation with ELY</p>
            <p className="mt-2 text-xs text-ely-muted">Type or tap the mic · /gpt-4o, /claude, /gemini</p>
          </div>
        )}

        {messages.map((msg, i) =>
          msg.role === "USER" ? (
            <div key={i} className="flex justify-end">
              <div className="max-w-[85%] rounded-2xl rounded-br-md bg-ely-primary px-4 py-3 text-sm leading-relaxed text-white">
                {msg.content}
              </div>
            </div>
          ) : (
            <ElyMessageBubble key={i} content={msg.content} />
          )
        )}

        {streaming && <ElyMessageBubble content={streaming} streamingText />}

        <div ref={bottomRef} />
      </div>

      <div className="safe-bottom border-t border-ely-border p-4">
        <div className="flex gap-2">
          <VoiceInputButton
            onTranscript={(text) => sendMessage(text)}
            onListeningChange={(listening) => {
              if (listening) setEmotion("listening");
            }}
            disabled={sending}
          />
          <input
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && !e.shiftKey && (e.preventDefault(), sendMessage())}
            placeholder="Message ELY..."
            className="min-h-[44px] flex-1 rounded-full border border-ely-border bg-ely-card px-4 py-3 text-sm outline-none focus:border-ely-primary"
            disabled={sending}
          />
          <button
            onClick={() => sendMessage()}
            disabled={!input.trim() || sending}
            className="flex h-11 min-h-[44px] min-w-[44px] w-11 items-center justify-center rounded-full bg-ely-primary disabled:opacity-50"
          >
            <Send size={18} />
          </button>
        </div>
      </div>
    </div>
  );

  return (
    <AppShell>
      <div
        className={`mx-auto flex h-[calc(100vh-4rem)] flex-col md:h-[calc(100vh-2rem)] ${
          avatarExpanded ? "max-w-6xl md:flex-row md:gap-0" : "max-w-3xl"
        }`}
      >
        {avatarExpanded && (
          <aside className="flex shrink-0 items-center justify-center border-b border-ely-border px-6 py-6 md:w-56 md:flex-col md:border-b-0 md:border-r md:py-10 lg:w-64">
            <ChatAvatarPresence
              imageUrl={avatarUrl}
              name="ELY"
              emotion={emotion}
              expanded
            />
          </aside>
        )}

        {chatColumn}
      </div>
    </AppShell>
  );
}
