"use client";

import Link from "next/link";
import { motion } from "framer-motion";
import { Pencil, Sparkles } from "lucide-react";
import { emotionMotion, type AvatarEmotion } from "@ely/personality";
import { cn } from "@/lib/utils";

type Props = {
  imageUrl: string | null;
  name?: string;
  emotion: AvatarEmotion;
  className?: string;
};

export function ChatAvatarPresence({ imageUrl, name = "ELY", emotion, className }: Props) {
  const motionProps = emotionMotion(emotion);

  return (
    <div className={cn("relative flex flex-col items-center", className)}>
      <Link
        href="/boutique"
        className="absolute -right-1 -top-1 z-10 flex h-8 w-8 items-center justify-center rounded-full border border-white/20 bg-black/60 text-white/80 shadow-lg backdrop-blur-sm transition hover:bg-ely-primary/30 hover:text-white"
        title="Edit avatar in boutique"
      >
        <Pencil size={14} />
      </Link>

      <motion.div
        className="relative"
        animate={{
          scale: motionProps.scale,
          y: motionProps.y,
          rotate: motionProps.rotate,
        }}
        transition={{ duration: emotion === "thinking" ? 1.2 : 2.4, repeat: Infinity, ease: "easeInOut" }}
      >
        <div
          className={cn(
            "relative h-36 w-36 overflow-hidden rounded-3xl border-2 shadow-2xl sm:h-44 sm:w-44",
            emotion === "thinking" && "border-ely-accent/50 shadow-ely-accent/20",
            emotion === "listening" && "border-sky-400/40 shadow-sky-400/15",
            emotion === "happy" && "border-emerald-400/40",
            emotion === "excited" && "border-amber-400/50",
            emotion === "concerned" && "border-orange-400/30",
            !["thinking", "listening", "happy", "excited", "concerned"].includes(emotion) &&
              "border-white/15 shadow-ely-primary/15"
          )}
        >
          {imageUrl ? (
            <img src={imageUrl} alt={name} className="h-full w-full object-cover" />
          ) : (
            <div className="flex h-full w-full items-center justify-center bg-gradient-to-br from-ely-primary to-ely-secondary">
              <Sparkles size={36} className="text-white/90" />
            </div>
          )}

          {emotion === "thinking" && (
            <motion.div
              className="pointer-events-none absolute inset-0 bg-gradient-to-t from-ely-accent/25 to-transparent"
              animate={{ opacity: [0.3, 0.7, 0.3] }}
              transition={{ duration: 1.5, repeat: Infinity }}
            />
          )}
        </div>

        <motion.div
          className="pointer-events-none absolute -inset-3 rounded-[1.4rem] border border-white/5"
          animate={{ opacity: emotion === "idle" ? 0.3 : 0.7, scale: [1, 1.02, 1] }}
          transition={{ duration: 2.5, repeat: Infinity }}
        />
      </motion.div>

      <p className="mt-3 text-sm font-medium text-white">{name}</p>
      <p className="text-[11px] capitalize text-ely-muted">{emotion === "idle" ? "online" : emotion}</p>
    </div>
  );
}
