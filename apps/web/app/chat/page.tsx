"use client";

import { useState, useEffect, useRef } from "react";
import { io, Socket } from "socket.io-client";
import { Send, Sparkles } from "lucide-react";
import { AppShell } from "@/components/app-shell";
import { WS_URL, apiFetch } from "@/lib/utils";

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
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);
  const [userId, setUserId] = useState<string | null>(null);
  const socketRef = useRef<Socket | null>(null);
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const user = JSON.parse(localStorage.getItem("ely_user") || "{}");
    setUserId(user.id);

    apiFetch("/avatar").then((data) => {
      if (data?.imageUrl) setAvatarUrl(data.imageUrl);
    }).catch(() => {});

    const socket = io(WS_URL, { transports: ["websocket", "polling"] });
    socketRef.current = socket;

    socket.on("connect", () => {
      socket.emit("join", { userId: user.id });
    });

    socket.on("history", (history: Message[]) => {
      setMessages(history);
    });

    socket.on("stream", ({ chunk }: { chunk: string }) => {
      setStreaming((prev) => prev + chunk);
    });

    socket.on("done", ({ content }: { content: string }) => {
      setMessages((prev) => [...prev, { role: "ASSISTANT", content }]);
      setStreaming("");
    });

    socket.on("avatar_state", ({ state }: { state: string }) => {
      setAvatarState(state);
    });

    return () => { socket.disconnect(); };
  }, []);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, streaming]);

  function sendMessage() {
    if (!input.trim() || !socketRef.current) return;
    setMessages((prev) => [...prev, { role: "USER", content: input }]);
    socketRef.current.emit("message", { content: input });
    setInput("");
    setStreaming("");
  }

  return (
    <AppShell>
      <div className="flex flex-col h-[calc(100vh-4rem)] md:h-[calc(100vh-2rem)]">
        {/* Avatar header */}
        <div className="flex items-center gap-4 p-4 border-b border-ely-border">
          <div className={`relative w-12 h-12 rounded-full overflow-hidden bg-ely-card ${avatarState === "thinking" ? "animate-pulse" : ""}`}>
            {avatarUrl ? (
              <img src={avatarUrl} alt="ELY" className="w-full h-full object-cover" />
            ) : (
              <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-ely-primary to-ely-secondary">
                <Sparkles size={20} />
              </div>
            )}
            {avatarState === "thinking" && (
              <div className="absolute inset-0 bg-ely-primary/20 animate-pulse" />
            )}
          </div>
          <div>
            <h2 className="font-semibold">ELY</h2>
            <p className="text-xs text-ely-muted capitalize">{avatarState === "idle" ? "Online" : avatarState}</p>
          </div>
        </div>

        {/* Module chips */}
        <div className="flex gap-2 px-4 py-2 overflow-x-auto scrollbar-hide">
          {MODULES.map((m) => (
            <button
              key={m}
              onClick={() => setInput(`Help me with ${m.toLowerCase()}: `)}
              className="px-3 py-1.5 rounded-full text-xs glass whitespace-nowrap min-h-[32px] hover:bg-white/10"
            >
              {m}
            </button>
          ))}
        </div>

        {/* Messages */}
        <div className="flex-1 overflow-y-auto px-4 py-4 space-y-4">
          {messages.length === 0 && !streaming && (
            <div className="text-center py-12">
              <Sparkles className="mx-auto text-ely-primary mb-4" size={32} />
              <p className="text-ely-muted">Start a conversation with ELY</p>
              <p className="text-xs text-ely-muted mt-2">Try /gpt-4o, /claude, or /gemini for Model Nexus</p>
            </div>
          )}
          {messages.map((msg, i) => (
            <div
              key={i}
              className={`flex ${msg.role === "USER" ? "justify-end" : "justify-start"}`}
            >
              <div
                className={`max-w-[85%] px-4 py-3 rounded-2xl text-sm leading-relaxed ${
                  msg.role === "USER"
                    ? "bg-ely-primary text-white rounded-br-md"
                    : "glass rounded-bl-md"
                }`}
              >
                {msg.content}
              </div>
            </div>
          ))}
          {streaming && (
            <div className="flex justify-start">
              <div className="max-w-[85%] px-4 py-3 rounded-2xl text-sm glass rounded-bl-md">
                {streaming}
                <span className="inline-block w-1 h-4 bg-ely-primary animate-pulse ml-1" />
              </div>
            </div>
          )}
          <div ref={bottomRef} />
        </div>

        {/* Input */}
        <div className="p-4 border-t border-ely-border safe-bottom">
          <div className="flex gap-2 max-w-3xl mx-auto">
            <input
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && !e.shiftKey && (e.preventDefault(), sendMessage())}
              placeholder="Message ELY... (/gpt-4o, /claude, /gemini)"
              className="flex-1 px-4 py-3 rounded-full bg-ely-card border border-ely-border focus:border-ely-primary outline-none min-h-[44px] text-sm"
            />
            <button
              onClick={sendMessage}
              disabled={!input.trim()}
              className="w-11 h-11 rounded-full bg-ely-primary flex items-center justify-center disabled:opacity-50 min-h-[44px] min-w-[44px]"
            >
              <Send size={18} />
            </button>
          </div>
        </div>
      </div>
    </AppShell>
  );
}
