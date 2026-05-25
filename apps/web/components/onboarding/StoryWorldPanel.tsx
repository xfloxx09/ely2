"use client";

import { BookOpen, Clock, MapPin, Sparkles, User } from "lucide-react";
import type { StoryWorldContext } from "@ely/personality";

export function StoryWorldPanel({
  title,
  worldContext,
  compact = false,
  className = "",
}: {
  title: string;
  worldContext: StoryWorldContext;
  compact?: boolean;
  className?: string;
}) {
  const rows = [
    { icon: BookOpen, label: "Framing", value: worldContext.framing },
    { icon: MapPin, label: "Where", value: worldContext.place },
    { icon: Clock, label: "When", value: worldContext.timeline },
    { icon: User, label: "You", value: worldContext.yourRole },
    { icon: Sparkles, label: "Mood", value: worldContext.mood },
  ];

  return (
    <aside
      className={`glass rounded-2xl border border-white/10 ${compact ? "p-4" : "p-5"} ${className}`}
      aria-label="Story world context"
    >
      <p className="mb-1 text-[10px] uppercase tracking-[0.25em] text-ely-accent">World context</p>
      <h2 className={`font-serif leading-snug text-white ${compact ? "text-base" : "text-lg"}`}>{title}</h2>
      <p className="mt-2 text-xs leading-relaxed text-ely-muted">
        Place yourself here before you answer — this is the reality of your journey.
      </p>

      <dl className={`mt-4 space-y-3 ${compact ? "text-xs" : "text-sm"}`}>
        {rows.map(({ icon: Icon, label, value }) => (
          <div key={label}>
            <dt className="mb-1 flex items-center gap-1.5 text-[10px] font-medium uppercase tracking-wider text-ely-muted">
              <Icon size={12} className="text-ely-primary" />
              {label}
            </dt>
            <dd className="leading-relaxed text-white/85">{value}</dd>
          </div>
        ))}
      </dl>
    </aside>
  );
}
