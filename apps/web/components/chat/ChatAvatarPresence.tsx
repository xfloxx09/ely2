"use client";

import Link from "next/link";
import { motion } from "framer-motion";
import { Pencil, Sparkles } from "lucide-react";
import { emotionMotion, type AvatarEmotion } from "@ely/personality";
import { cn } from "@/lib/utils";

type FaceProps = {
  imageUrl: string | null;
  name?: string;
  emotion: AvatarEmotion;
  size?: "sm" | "md" | "lg" | "xl";
  className?: string;
};

const sizeClasses = {
  sm: "h-10 w-10 rounded-xl border",
  md: "h-14 w-14 rounded-2xl border-2",
  lg: "h-24 w-24 rounded-3xl border-2 sm:h-28 sm:w-28",
  xl: "h-36 w-36 rounded-3xl border-2 sm:h-44 sm:w-44",
};

export function ChatAvatarFace({ imageUrl, name = "ELY", emotion, size = "md", className }: FaceProps) {
  const motionProps = emotionMotion(emotion);

  return (
    <motion.div
      className={cn("relative shrink-0", className)}
      animate={{
        scale: motionProps.scale,
        y: motionProps.y,
        rotate: motionProps.rotate,
      }}
      transition={{ duration: emotion === "thinking" ? 1.2 : 2.4, repeat: Infinity, ease: "easeInOut" }}
    >
      <div
        className={cn(
          "relative overflow-hidden shadow-lg",
          sizeClasses[size],
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
            <Sparkles size={size === "sm" ? 16 : size === "md" ? 22 : size === "lg" ? 32 : 36} className="text-white/90" />
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
    </motion.div>
  );
}

type Props = {
  imageUrl: string | null;
  name?: string;
  emotion: AvatarEmotion;
  className?: string;
  showEdit?: boolean;
  compact?: boolean;
  expanded?: boolean;
};

/** Inline chat header, empty-state hero, or expanded left panel. */
export function ChatAvatarPresence({
  imageUrl,
  name = "ELY",
  emotion,
  className,
  showEdit = true,
  compact = false,
  expanded = false,
}: Props) {
  const status = emotion === "idle" ? "online" : emotion;

  if (expanded) {
    return (
      <div className={cn("relative flex flex-col items-center", className)}>
        {showEdit && (
          <Link
            href="/boutique"
            className="absolute -right-1 -top-1 z-10 flex h-8 w-8 items-center justify-center rounded-full border border-white/20 bg-black/60 text-white/80 shadow-lg backdrop-blur-sm transition hover:bg-ely-primary/30 hover:text-white"
            title="Edit avatar in boutique"
          >
            <Pencil size={14} />
          </Link>
        )}

        <ChatAvatarFace imageUrl={imageUrl} name={name} emotion={emotion} size="xl" />

        <p className="mt-4 text-sm font-medium text-white">{name}</p>
        <p className="text-[11px] capitalize text-ely-muted">{status}</p>
      </div>
    );
  }

  if (compact) {
    return (
      <div className={cn("flex items-center gap-3", className)}>
        <ChatAvatarFace imageUrl={imageUrl} name={name} emotion={emotion} size="sm" />
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-medium text-white">{name}</p>
          <p className="text-[11px] capitalize text-ely-muted">{status}</p>
        </div>
        {showEdit && (
          <Link
            href="/boutique"
            className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-white/10 text-ely-muted transition hover:bg-white/5 hover:text-white"
            title="Edit avatar in boutique"
          >
            <Pencil size={14} />
          </Link>
        )}
      </div>
    );
  }

  return (
    <div className={cn("relative flex flex-col items-center", className)}>
      {showEdit && (
        <Link
          href="/boutique"
          className="absolute right-0 top-0 z-10 flex h-8 w-8 items-center justify-center rounded-full border border-white/20 bg-black/60 text-white/80 shadow-lg backdrop-blur-sm transition hover:bg-ely-primary/30 hover:text-white"
          title="Edit avatar in boutique"
        >
          <Pencil size={14} />
        </Link>
      )}

      <ChatAvatarFace imageUrl={imageUrl} name={name} emotion={emotion} size="lg" />

      <p className="mt-3 text-sm font-medium text-white">{name}</p>
      <p className="text-[11px] capitalize text-ely-muted">{status}</p>
    </div>
  );
}
