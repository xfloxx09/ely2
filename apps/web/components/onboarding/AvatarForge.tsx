"use client";

import { motion } from "framer-motion";
import { cn } from "@/lib/utils";
import { Sparkles } from "lucide-react";

type Props = {
  previewUrl: string | null;
  progress: number;
  blur: number;
  className?: string;
};

export function AvatarForge({ previewUrl, progress, blur, className }: Props) {
  const clarity = Math.min(1, progress);
  const ringProgress = Math.round(progress * 100);

  return (
    <div className={cn("relative flex flex-col items-center", className)}>
      <div className="relative mb-3 text-center">
        <p className="text-[10px] uppercase tracking-[0.25em] text-ely-muted">Your ELY is forming</p>
        <p className="mt-1 text-sm text-white/80">{ringProgress}% revealed</p>
      </div>

      <div className="relative">
        <motion.div
          className="absolute -inset-3 rounded-full bg-gradient-to-tr from-ely-primary/30 via-ely-accent/20 to-ely-secondary/30 blur-xl"
          animate={{ opacity: 0.35 + clarity * 0.45, scale: 0.95 + clarity * 0.08 }}
          transition={{ duration: 0.6 }}
        />

        <svg className="absolute -inset-1 h-[calc(100%+8px)] w-[calc(100%+8px)] -rotate-90" viewBox="0 0 120 120">
          <circle cx="60" cy="60" r="54" fill="none" stroke="rgba(255,255,255,0.08)" strokeWidth="3" />
          <motion.circle
            cx="60"
            cy="60"
            r="54"
            fill="none"
            stroke="url(#forgeGrad)"
            strokeWidth="3"
            strokeLinecap="round"
            strokeDasharray={339.292}
            animate={{ strokeDashoffset: 339.292 * (1 - progress) }}
            transition={{ duration: 0.5, ease: "easeOut" }}
          />
          <defs>
            <linearGradient id="forgeGrad" x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stopColor="#6366f1" />
              <stop offset="50%" stopColor="#a855f7" />
              <stop offset="100%" stopColor="#ec4899" />
            </linearGradient>
          </defs>
        </svg>

        <div className="relative h-36 w-36 overflow-hidden rounded-full border border-white/15 bg-[#14141f] shadow-inner sm:h-44 sm:w-44">
          {previewUrl ? (
            <motion.img
              src={previewUrl}
              alt="ELY forming"
              className="h-full w-full object-cover"
              animate={{
                filter: `blur(${Math.max(0, blur * 0.25)}px) brightness(${0.7 + clarity * 0.35})`,
                scale: 1.05 - clarity * 0.05,
              }}
              transition={{ duration: 0.7, ease: "easeOut" }}
            />
          ) : (
            <div className="flex h-full items-center justify-center">
              <motion.div
                animate={{ opacity: [0.3, 0.7, 0.3] }}
                transition={{ repeat: Infinity, duration: 2 }}
                className="h-20 w-20 rounded-full bg-white/5"
              />
            </div>
          )}

          <div
            className="pointer-events-none absolute inset-0"
            style={{
              background: `radial-gradient(circle at 50% 35%, transparent ${20 + clarity * 35}%, rgba(10,10,15,${0.55 - clarity * 0.35}) 100%)`,
            }}
          />

          {clarity < 0.95 && (
            <motion.div
              className="absolute inset-0 flex items-center justify-center backdrop-blur-[2px]"
              animate={{ opacity: 0.5 - clarity * 0.4 }}
            >
              <Sparkles className="text-white/30" size={28} />
            </motion.div>
          )}
        </div>
      </div>

      <p className="mt-4 max-w-[11rem] text-center text-xs leading-relaxed text-ely-muted">
        Each choice shapes the face of your companion. The portrait sharpens as your story unfolds.
      </p>
    </div>
  );
}
