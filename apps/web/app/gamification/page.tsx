"use client";

import { useEffect, useState } from "react";
import { AppShell } from "@/components/app-shell";
import { Card } from "@/components/ui";
import { apiFetch } from "@/lib/utils";
import { Flame, Star, Trophy } from "lucide-react";

export default function GamificationPage() {
  const [stats, setStats] = useState<{
    xp?: { totalXp: number; level: number };
    streak?: { currentStreak: number; longestStreak: number; streakFreezes: number };
    badges?: { name: string; description: string; icon: string }[];
    dailyQuests?: { id: string; title: string; description: string; xpReward: number; completed: boolean }[];
  }>({});

  useEffect(() => {
    apiFetch("/gamification/stats").then(setStats).catch(() => {});
  }, []);

  return (
    <AppShell>
      <div className="p-4 md:p-8 max-w-4xl mx-auto">
        <h1 className="text-2xl font-bold mb-8">Quests & Progress</h1>

        <div className="grid sm:grid-cols-3 gap-4 mb-8">
          <Card className="text-center">
            <Star className="mx-auto text-ely-accent mb-2" size={24} />
            <p className="text-2xl font-bold">{stats.xp?.level || 1}</p>
            <p className="text-xs text-ely-muted">Level</p>
            <p className="text-sm text-ely-muted mt-1">{stats.xp?.totalXp || 0} XP</p>
          </Card>
          <Card className="text-center">
            <Flame className="mx-auto text-orange-400 mb-2" size={24} />
            <p className="text-2xl font-bold">{stats.streak?.currentStreak || 0}</p>
            <p className="text-xs text-ely-muted">Day Streak</p>
            <p className="text-sm text-ely-muted mt-1">Best: {stats.streak?.longestStreak || 0}</p>
          </Card>
          <Card className="text-center">
            <Trophy className="mx-auto text-ely-primary mb-2" size={24} />
            <p className="text-2xl font-bold">{stats.badges?.length || 0}</p>
            <p className="text-xs text-ely-muted">Badges</p>
          </Card>
        </div>

        <h2 className="text-lg font-semibold mb-4">Daily Quests</h2>
        <div className="space-y-3 mb-8">
          {(stats.dailyQuests || []).map((q) => (
            <Card key={q.id} className={`flex items-center justify-between ${q.completed ? "opacity-60" : ""}`}>
              <div>
                <h3 className="font-medium">{q.title}</h3>
                <p className="text-sm text-ely-muted">{q.description}</p>
              </div>
              <div className="text-right">
                <span className="text-sm text-ely-accent">+{q.xpReward} XP</span>
                {q.completed && <p className="text-xs text-green-400">Done</p>}
              </div>
            </Card>
          ))}
        </div>

        <h2 className="text-lg font-semibold mb-4">Badges</h2>
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
          {(stats.badges || []).map((b, i) => (
            <Card key={i} className="text-center py-4">
              <span className="text-2xl">{b.icon}</span>
              <p className="font-medium text-sm mt-2">{b.name}</p>
            </Card>
          ))}
          {(stats.badges || []).length === 0 && (
            <p className="text-ely-muted col-span-full text-center py-8">Complete quests to earn badges</p>
          )}
        </div>
      </div>
    </AppShell>
  );
}
