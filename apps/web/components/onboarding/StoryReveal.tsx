"use client";

import { motion } from "framer-motion";
import { Button } from "@/components/ui";
import { Sparkles } from "lucide-react";

type Props = {
  title: string;
  heroName: string;
  avatarUrl: string | null;
  onContinue: () => void;
};

export function StoryReveal({ title, heroName, avatarUrl, onContinue }: Props) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-[#050508]/95 px-4 backdrop-blur-md safe-top safe-bottom">
      <motion.div
        initial={{ opacity: 0, scale: 0.92, y: 24 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        transition={{ duration: 0.7, ease: [0.22, 1, 0.36, 1] }}
        className="relative w-full max-w-md text-center"
      >
        <motion.div
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
          className="mb-6"
        >
          <p className="text-[10px] uppercase tracking-[0.3em] text-ely-accent">Story complete</p>
          <h1 className="mt-2 font-serif text-2xl text-white sm:text-3xl">{title}</h1>
          <p className="mt-2 text-sm text-ely-muted">
            {heroName}, your companion has taken form.
          </p>
        </motion.div>

        <div className="relative mx-auto mb-8 h-56 w-56 sm:h-64 sm:w-64">
          <motion.div
            className="absolute -inset-6 rounded-full bg-gradient-to-tr from-ely-primary/40 via-ely-accent/30 to-ely-secondary/40 blur-2xl"
            animate={{ scale: [1, 1.06, 1], opacity: [0.5, 0.8, 0.5] }}
            transition={{ repeat: Infinity, duration: 4, ease: "easeInOut" }}
          />

          <motion.div
            initial={{ clipPath: "circle(0% at 50% 50%)" }}
            animate={{ clipPath: "circle(75% at 50% 50%)" }}
            transition={{ delay: 0.4, duration: 1.2, ease: [0.22, 1, 0.36, 1] }}
            className="relative h-full w-full overflow-hidden rounded-full border-2 border-white/20 shadow-2xl shadow-ely-primary/20"
          >
            {avatarUrl ? (
              <img src={avatarUrl} alt="Your ELY" className="h-full w-full object-cover" />
            ) : (
              <div className="flex h-full items-center justify-center bg-gradient-to-br from-ely-primary/30 to-ely-accent/20">
                <Sparkles size={48} className="text-white/60" />
              </div>
            )}
          </motion.div>

          {[...Array(8)].map((_, i) => (
            <motion.span
              key={i}
              className="absolute h-1 w-1 rounded-full bg-white/60"
              style={{ left: `${50 + Math.cos(i * 0.785) * 48}%`, top: `${50 + Math.sin(i * 0.785) * 48}%` }}
              initial={{ opacity: 0, scale: 0 }}
              animate={{ opacity: [0, 1, 0], scale: [0, 1.5, 0] }}
              transition={{ delay: 0.8 + i * 0.08, duration: 1.2 }}
            />
          ))}
        </div>

        <motion.p
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 1 }}
          className="mb-8 text-sm leading-relaxed text-ely-muted"
        >
          Born from your choices, this is the face of ELY — tuned to how you move through the world.
          Every conversation from here will feel like it was written for you.
        </motion.p>

        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 1.2 }}>
          <Button onClick={onContinue} className="w-full sm:w-auto px-10">
            Meet your ELY
          </Button>
        </motion.div>
      </motion.div>
    </div>
  );
}
