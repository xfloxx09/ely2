"use client";

import { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { ChevronLeft, ChevronRight, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";

type Phase = "idle" | "drawing" | "erasing";

type Props = {
  imageUrl: string | null;
  loading?: boolean;
  beatKey: string;
  sceneIndex: number;
  maxSceneIndex: number;
  chapter: number;
  chapterTitle: string;
  narrative: string;
  totalBeats: number;
  choiceLabel?: string;
  onPrev?: () => void;
  onNext?: () => void;
  animate?: boolean;
  className?: string;
};

export function PencilScene({
  imageUrl,
  loading = false,
  beatKey,
  sceneIndex,
  maxSceneIndex,
  chapter,
  chapterTitle,
  narrative,
  totalBeats,
  choiceLabel,
  onPrev,
  onNext,
  animate = true,
  className,
}: Props) {
  const [phase, setPhase] = useState<Phase>("idle");
  const [displayUrl, setDisplayUrl] = useState(imageUrl);

  const canPrev = sceneIndex > 0;
  const canNext = sceneIndex < maxSceneIndex;

  useEffect(() => {
    if (!imageUrl) return;

    if (!animate) {
      setDisplayUrl(imageUrl);
      setPhase("idle");
      return;
    }

    if (displayUrl && displayUrl !== imageUrl) {
      setPhase("erasing");
      const eraseTimer = setTimeout(() => {
        setDisplayUrl(imageUrl);
        setPhase("drawing");
      }, 900);
      return () => clearTimeout(eraseTimer);
    }

    setDisplayUrl(imageUrl);
    setPhase("drawing");
  }, [imageUrl, beatKey, animate]);

  useEffect(() => {
    if (phase !== "drawing") return;
    const t = setTimeout(() => setPhase("idle"), 1400);
    return () => clearTimeout(t);
  }, [phase, displayUrl]);

  return (
    <div
      className={cn(
        "overflow-hidden rounded-2xl border border-white/10 bg-[#12121a] shadow-2xl shadow-black/40",
        className
      )}
    >
      <div className="relative aspect-[5/4] w-full overflow-hidden">
        <div
          className="absolute inset-0 opacity-30"
          style={{
            backgroundImage: `url("data:image/svg+xml,${encodeURIComponent(
              '<svg xmlns="http://www.w3.org/2000/svg" width="120" height="120"><filter id="n"><feTurbulence type="fractalNoise" baseFrequency="0.8" numOctaves="4"/></filter><rect width="120" height="120" filter="url(#n)" opacity="0.08"/></svg>'
            )}")`,
          }}
        />

        {loading && !displayUrl && (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 bg-[#12121a]">
            <Loader2 className="h-8 w-8 animate-spin text-ely-primary/70" />
            <p className="text-xs text-white/50">Sketching this moment…</p>
          </div>
        )}

        <AnimatePresence mode="wait">
          {displayUrl && (
            <motion.div
              key={beatKey}
              className="absolute inset-0"
              initial={{ opacity: animate ? 0 : 1 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: animate ? 0.3 : 0.15 }}
            >
              <motion.div
                className="absolute inset-0 bg-cover bg-center"
                style={{
                  backgroundImage: `url("${displayUrl}")`,
                  filter: "contrast(1.05) grayscale(0.12) sepia(0.1)",
                }}
                initial={animate ? { clipPath: "inset(0 100% 0 0 round 1rem)" } : false}
                animate={{
                  clipPath:
                    !animate || phase === "idle"
                      ? "inset(0 0% 0 0 round 1rem)"
                      : phase === "erasing"
                        ? "inset(0 100% 0 0 round 1rem)"
                        : "inset(0 0% 0 0 round 1rem)",
                }}
                transition={{
                  duration: !animate ? 0.2 : phase === "erasing" ? 0.85 : 1.35,
                  ease: [0.22, 1, 0.36, 1],
                }}
              />

              {animate && (
                <svg className="pointer-events-none absolute inset-0 h-full w-full" aria-hidden>
                  {[...Array(18)].map((_, i) => (
                    <motion.line
                      key={i}
                      x1={20 + i * 18}
                      y1={0}
                      x2={40 + i * 16}
                      y2={320}
                      stroke="rgba(255,255,255,0.06)"
                      strokeWidth={0.6}
                      initial={{ pathLength: 0, opacity: 0 }}
                      animate={{
                        pathLength: phase === "drawing" ? 1 : phase === "erasing" ? 0 : 1,
                        opacity: phase === "idle" ? 0.35 : 0.7,
                      }}
                      transition={{ delay: i * 0.04, duration: 0.8 }}
                    />
                  ))}
                </svg>
              )}
            </motion.div>
          )}
        </AnimatePresence>

        {loading && displayUrl && (
          <div className="absolute right-3 top-3 z-20 flex items-center gap-1.5 rounded-full border border-white/10 bg-black/50 px-2.5 py-1 text-[10px] text-white/60 backdrop-blur-sm">
            <Loader2 className="h-3 w-3 animate-spin" />
            Updating
          </div>
        )}

        <button
          type="button"
          onClick={onPrev}
          disabled={!canPrev}
          aria-label="Previous story illustration"
          className="absolute left-3 top-1/2 z-20 flex h-10 w-10 -translate-y-1/2 items-center justify-center rounded-full border border-white/15 bg-black/50 text-white backdrop-blur-sm transition-all hover:bg-black/70 disabled:pointer-events-none disabled:opacity-25"
        >
          <ChevronLeft size={20} />
        </button>

        <button
          type="button"
          onClick={onNext}
          disabled={!canNext}
          aria-label="Next story illustration"
          className="absolute right-3 top-1/2 z-20 flex h-10 w-10 -translate-y-1/2 items-center justify-center rounded-full border border-white/15 bg-black/50 text-white backdrop-blur-sm transition-all hover:bg-black/70 disabled:pointer-events-none disabled:opacity-25"
        >
          <ChevronRight size={20} />
        </button>

        <div className="pointer-events-none absolute left-3 top-3 flex items-center gap-2">
          <span className="rounded-full border border-white/10 bg-black/40 px-3 py-1 text-[10px] uppercase tracking-[0.2em] text-white/50">
            Story sketch
          </span>
          <span className="rounded-full border border-white/10 bg-black/40 px-2.5 py-1 text-[10px] text-white/40">
            {sceneIndex + 1} / {maxSceneIndex + 1}
          </span>
        </div>
      </div>

      <div className="border-t border-white/10 bg-[#0a0a0f] px-4 py-3 sm:px-5 sm:py-4">
        <p className="text-[10px] uppercase tracking-[0.14em] text-white/45">
          Ch. {chapter} — {chapterTitle}
        </p>
        <p className="mt-1.5 break-words font-serif text-[13px] leading-relaxed text-white/78 sm:text-sm">
          {narrative}
        </p>
        {choiceLabel ? (
          <p className="mt-2 break-words text-xs italic text-ely-accent/90">You chose: {choiceLabel}</p>
        ) : (
          <p className="mt-2 text-[11px] text-white/35">
            Moment {sceneIndex + 1} of {totalBeats}
          </p>
        )}
      </div>
    </div>
  );
}
