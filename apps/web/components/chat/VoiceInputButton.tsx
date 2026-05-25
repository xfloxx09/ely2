"use client";

import { useEffect, useRef, useState } from "react";
import { Mic, MicOff } from "lucide-react";
import { cn } from "@/lib/utils";

type SpeechRecognitionLike = {
  continuous: boolean;
  interimResults: boolean;
  lang: string;
  start(): void;
  stop(): void;
  onresult: ((event: { results: { [index: number]: { [index: number]: { transcript: string } } } }) => void) | null;
  onerror: (() => void) | null;
  onend: (() => void) | null;
};

type Props = {
  onTranscript: (text: string) => void;
  onListeningChange?: (listening: boolean) => void;
  disabled?: boolean;
  className?: string;
};

export function VoiceInputButton({ onTranscript, onListeningChange, disabled, className }: Props) {
  const [supported, setSupported] = useState(false);
  const [listening, setListening] = useState(false);
  const recognitionRef = useRef<SpeechRecognitionLike | null>(null);

  useEffect(() => {
    const w = window as unknown as {
      SpeechRecognition?: new () => SpeechRecognitionLike;
      webkitSpeechRecognition?: new () => SpeechRecognitionLike;
    };
    const SR = w.SpeechRecognition || w.webkitSpeechRecognition;
    setSupported(!!SR);
    if (!SR) return;

    const recognition = new SR();
    recognition.continuous = false;
    recognition.interimResults = false;
    recognition.lang = "en-US";

    recognition.onresult = (event) => {
      const text = event.results[0]?.[0]?.transcript?.trim();
      if (text) onTranscript(text);
      setListening(false);
      onListeningChange?.(false);
    };

    recognition.onerror = () => {
      setListening(false);
      onListeningChange?.(false);
    };

    recognition.onend = () => {
      setListening(false);
      onListeningChange?.(false);
    };

    recognitionRef.current = recognition;
  }, [onTranscript, onListeningChange]);

  function toggle() {
    if (!recognitionRef.current || disabled) return;

    if (listening) {
      recognitionRef.current.stop();
      setListening(false);
      onListeningChange?.(false);
      return;
    }

    setListening(true);
    onListeningChange?.(true);
    recognitionRef.current.start();
  }

  if (!supported) return null;

  return (
    <button
      type="button"
      onClick={toggle}
      disabled={disabled}
      aria-label={listening ? "Stop voice input" : "Start voice input"}
      className={cn(
        "flex h-11 w-11 shrink-0 items-center justify-center rounded-full border transition min-h-[44px] min-w-[44px]",
        listening
          ? "border-red-400/50 bg-red-500/20 text-red-200 animate-pulse"
          : "border-ely-border bg-ely-card text-ely-muted hover:border-ely-primary/40 hover:text-white",
        disabled && "opacity-50",
        className
      )}
    >
      {listening ? <MicOff size={18} /> : <Mic size={18} />}
    </button>
  );
}
