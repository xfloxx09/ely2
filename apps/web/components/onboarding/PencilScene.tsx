"use client";

import { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { cn } from "@/lib/utils";

type Phase = "idle" | "drawing" | "erasing";

type Props = {
  imageUrl: string | null;
  beatKey: string;
  className?: string;
};

export function PencilScene({ imageUrl, beatKey, className }: Props) {
  const [phase, setPhase] = useState<Phase>("idle");
  const [displayUrl, setDisplayUrl] = useState(imageUrl);

  useEffect(() => {
    if (!imageUrl) return;
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
  }, [imageUrl, beatKey]);

  useEffect(() => {
    if (phase !== "drawing") return;
    const t = setTimeout(() => setPhase("idle"), 1400);
    return () => clearTimeout(t);
  }, [phase, displayUrl]);

  return (
    <div
      className={cn(
        "relative aspect-[5/4] w-full overflow-hidden rounded-2xl border border-white/10 bg-[#12121a] shadow-2xl shadow-black/40",
        className
      )}
    >
      <div
        className="absolute inset-0 opacity-30"
        style={{
          backgroundImage: `url("data:image/svg+xml,${encodeURIComponent(
            '<svg xmlns="http://www.w3.org/2000/svg" width="120" height="120"><filter id="n"><feTurbulence type="fractalNoise" baseFrequency="0.8" numOctaves="4"/></filter><rect width="120" height="120" filter="url(#n)" opacity="0.08"/></svg>'
          )}")`,
        }}
      />

      <AnimatePresence mode="wait">
        {displayUrl && (
          <motion.div
            key={beatKey}
            className="absolute inset-0"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.3 }}
          >
            <motion.div
              className="absolute inset-0 bg-cover bg-center"
              style={{
                backgroundImage: `url("${displayUrl}")`,
                filter: "contrast(1.05) grayscale(0.15) sepia(0.12)",
              }}
              initial={{ clipPath: "inset(0 100% 0 0 round 1rem)" }}
              animate={{
                clipPath:
                  phase === "erasing"
                    ? "inset(0 100% 0 0 round 1rem)"
                    : phase === "drawing"
                      ? "inset(0 0% 0 0 round 1rem)"
                      : "inset(0 0% 0 0 round 1rem)",
              }}
              transition={{
                duration: phase === "erasing" ? 0.85 : 1.35,
                ease: [0.22, 1, 0.36, 1],
              }}
            />

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
          </motion.div>
        )}
      </AnimatePresence>

      <motion.div
        className="pointer-events-none absolute z-10"
        animate={
          phase === "drawing"
            ? { left: ["0%", "92%"], top: ["8%", "75%"], opacity: [0, 1, 1, 0] }
            : phase === "erasing"
              ? { left: ["92%", "0%"], top: ["75%", "8%"], opacity: [0, 1, 1, 0] }
              : { opacity: 0 }
        }
        transition={{ duration: phase === "erasing" ? 0.85 : 1.35, ease: "easeInOut" }}
      >
        <div
          className={cn(
            "flex h-8 w-8 items-center justify-center rounded-full border border-white/20 bg-black/50 backdrop-blur-sm",
            phase === "erasing" && "bg-white/10"
          )}
        >
          {phase === "erasing" ? (
            <span className="text-[10px] font-medium uppercase tracking-wider text-white/70">⌫</span>
          ) : (
            <span className="h-3 w-0.5 rotate-45 rounded-full bg-white/80" />
          )}
        </div>
      </motion.div>

      <div className="pointer-events-none absolute inset-x-0 bottom-0 h-16 bg-gradient-to-t from-[#0a0a0f] to-transparent" />
      <div className="pointer-events-none absolute left-3 top-3 rounded-full border border-white/10 bg-black/40 px-3 py-1 text-[10px] uppercase tracking-[0.2em] text-white/50">
        Sketch
      </div>
    </div>
  );
}
