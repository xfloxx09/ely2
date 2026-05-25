"use client";

import { AppShell } from "@/components/app-shell";
import { Card } from "@/components/ui";
import { Calendar, PenTool, ChefHat, Target, Search, Wallet } from "lucide-react";
import Link from "next/link";

const modules = [
  { name: "Concierge", icon: Calendar, desc: "Schedules, reminders, day planning", prompt: "Plan my day for tomorrow" },
  { name: "Scribe", icon: PenTool, desc: "Draft emails, posts, messages", prompt: "Draft a professional email" },
  { name: "Kitchen Brain", icon: ChefHat, desc: "Meal plans and shopping lists", prompt: "Plan meals for this week" },
  { name: "Habit Architect", icon: Target, desc: "Goals, streaks, accountability", prompt: "Help me build a morning routine" },
  { name: "Researcher", icon: Search, desc: "Summarize and learn", prompt: "Research the latest in AI" },
  { name: "Money Scout", icon: Wallet, desc: "Spending analysis, budgets", prompt: "Analyze my spending habits" },
];

export default function TasksPage() {
  return (
    <AppShell>
      <div className="p-4 md:p-8 max-w-4xl mx-auto">
        <h1 className="text-2xl font-bold mb-2">Task Modules</h1>
        <p className="text-ely-muted mb-8">Use any module through chat — tap to start</p>

        <div className="grid sm:grid-cols-2 gap-4">
          {modules.map((mod) => (
            <Link key={mod.name} href={`/chat?q=${encodeURIComponent(mod.prompt)}`}>
              <Card className="hover:border-ely-primary/30 transition-colors cursor-pointer h-full">
                <mod.icon className="text-ely-primary mb-3" size={24} />
                <h3 className="font-semibold mb-1">{mod.name}</h3>
                <p className="text-sm text-ely-muted">{mod.desc}</p>
              </Card>
            </Link>
          ))}
        </div>
      </div>
    </AppShell>
  );
}
