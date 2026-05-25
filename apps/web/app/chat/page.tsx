"use client";

import { useEffect, useRef, useState } from "react";
import { io, Socket } from "socket.io-client";
import { Send, Sparkles } from "lucide-react";
import { AppShell } from "@/components/app-shell";
import { ChatAvatarPresence } from "@/components/chat/ChatAvatarPresence";
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

export default function ChatPage() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [streaming, setStreaming] = useState("");
  const [avatarState, setAvatarState] = useState("idle");
  const [emotion, setEmotion] = useState<AvatarEmotion>("idle");
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);
  const [heroName, setHeroName] = useState("ELY");
  const [sending, setSending] = useState(false);
  const socketRef = useRef<Socket | null>(null);
  const useHttpRef = useRef(false);
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const user = JSON.parse(localStorage.getItem("ely_user") || "{}");
    if (user.name) setHeroName(user.name.split(" ")[0] || "ELY");

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
      setAvatarState("idle");
      setEmotion(inferAvatarEmotion(content));
      setSending(false);
    });

    socket.on("avatar_state", ({ state }: { state: string }) => {
      setAvatarState(state);
      if (state === "thinking") setEmotion("thinking");
      if (state === "listening") setEmotion("listening");
    });

    socket.on("error", () => {
      setSending(false);
      setAvatarState("idle");
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
    setAvatarState("thinking");
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
      setAvatarState("idle");
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
    setAvatarState("thinking");
    setEmotion("thinking");
    socketRef.current.emit("message", { content });
  }

  return (
    <AppShell>
      <div className="mx-auto flex h-[calc(100vh-4rem)] max-w-6xl flex-col md:h-[calc(100vh-2rem)] md:flex-row md:gap-6 md:p-4">
        <aside className="flex shrink-0 items-center justify-center border-b border-ely-border bg-[#0c0c12]/80 px-4 py-5 md:w-56 md:flex-col md:border-b-0 md:border-r md:py-8 lg:w-64">
          <ChatAvatarPresence imageUrl={avatarUrl} name={heroName} emotion={emotion} />
        </aside>

        <div className="flex min-h-0 flex-1 flex-col">
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
              <div className="py-12 text-center">
                <Sparkles className="mx-auto mb-4 text-ely-primary" size={32} />
                <p className="text-ely-muted">Start a conversation with ELY</p>
                <p className="mt-2 text-xs text-ely-muted">Type or tap the mic · /gpt-4o, /claude, /gemini</p>
              </div>
            )}
            {messages.map((msg, i) => (
              <div key={i} className={`flex ${msg.role === "USER" ? "justify-end" : "justify-start"}`}>
                <div
                  className={`max-w-[85%] rounded-2xl px-4 py-3 text-sm leading-relaxed ${
                    msg.role === "USER" ? "rounded-br-md bg-ely-primary text-white" : "glass rounded-bl-md"
                  }`}
                >
                  {msg.content}
                </div>
              </div>
            ))}
            {streaming && (
              <div className="flex justify-start">
                <div className="max-w-[85%] rounded-2xl rounded-bl-md px-4 py-3 text-sm glass">
                  {streaming}
                  <span className="ml-1 inline-block h-4 w-1 animate-pulse bg-ely-primary" />
                </div>
              </div>
            )}
            <div ref={bottomRef} />
          </div>

          <div className="safe-bottom border-t border-ely-border p-4">
            <div className="mx-auto flex max-w-3xl gap-2">
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
      </div>
    </AppShell>
  );
}
