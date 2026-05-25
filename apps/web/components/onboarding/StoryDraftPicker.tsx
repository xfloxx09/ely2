"use client";

import { motion } from "framer-motion";
import { Check, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui";

export type StoryDraftSummary = {
  id: string;
  title: string;
  prologue: string;
  setting: string;
  framing: string;
  createdAt: string;
};

export type StorySessionMeta = {
  drafts: StoryDraftSummary[];
  selectedDraftId: string | null;
  rerollsUsed: number;
  rerollsRemaining: number;
  maxRerolls: number;
  tier: string;
};

export function StoryDraftPicker({
  session,
  selectedDraftId,
  onSelect,
  onReroll,
  rerolling = false,
}: {
  session: StorySessionMeta;
  selectedDraftId: string | null;
  onSelect: (draftId: string) => void;
  onReroll: () => void;
  rerolling?: boolean;
}) {
  const { drafts, rerollsRemaining, maxRerolls, tier } = session;
  const activeId = selectedDraftId ?? drafts[drafts.length - 1]?.id ?? null;

  return (
    <div className="mt-8 space-y-4">
      {drafts.length > 1 && (
        <div>
          <p className="mb-3 text-[10px] uppercase tracking-[0.25em] text-ely-muted">Choose your story</p>
          <div className="grid gap-2 sm:grid-cols-2">
            {drafts.map((draft, index) => {
              const selected = draft.id === activeId;
              return (
                <button
                  key={draft.id}
                  type="button"
                  onClick={() => onSelect(draft.id)}
                  className={`rounded-xl border px-4 py-3 text-left transition-all ${
                    selected
                      ? "border-ely-primary bg-ely-primary/10 shadow-lg shadow-ely-primary/10"
                      : "border-white/10 bg-white/[0.03] hover:border-ely-primary/30"
                  }`}
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <p className="text-[10px] uppercase tracking-wider text-ely-muted">Story {index + 1}</p>
                      <p className="truncate font-serif text-sm text-white">{draft.title}</p>
                      <p className="mt-1 line-clamp-2 text-xs text-ely-muted">{draft.framing}</p>
                    </div>
                    {selected && <Check size={16} className="mt-1 shrink-0 text-ely-accent" />}
                  </div>
                </button>
              );
            })}
          </div>
        </div>
      )}

      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <p className="text-xs text-ely-muted">
          {rerollsRemaining > 0 ? (
            <>
              <span className="text-white/80">{rerollsRemaining}</span> reroll{rerollsRemaining === 1 ? "" : "s"} left
              <span className="text-ely-muted/70"> · {tier} plan ({maxRerolls} max)</span>
            </>
          ) : (
            <span className="text-amber-200/90">No rerolls left — pick one of your stories above.</span>
          )}
        </p>

        {rerollsRemaining > 0 && (
          <Button
            type="button"
            variant="ghost"
            onClick={onReroll}
            disabled={rerolling}
            className="w-full sm:w-auto"
          >
            <RefreshCw size={16} className={`mr-2 ${rerolling ? "animate-spin" : ""}`} />
            {rerolling ? "Weaving a new tale..." : "Try another story"}
          </Button>
        )}
      </div>

      {rerolling && (
        <motion.p
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="text-center text-xs text-ely-muted"
        >
          Creating a fresh story — this can take a minute.
        </motion.p>
      )}
    </div>
  );
}
