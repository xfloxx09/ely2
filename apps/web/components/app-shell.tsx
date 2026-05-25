"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { MessageCircle, LayoutGrid, User, Users, Trophy, Settings, Globe } from "lucide-react";
import { cn } from "@/lib/utils";

const navItems = [
  { href: "/chat", icon: MessageCircle, label: "Chat" },
  { href: "/community", icon: Globe, label: "Community" },
  { href: "/tasks", icon: LayoutGrid, label: "Tasks" },
  { href: "/gamification", icon: Trophy, label: "Quests" },
  { href: "/profile", icon: User, label: "Profile" },
];

const desktopExtraItems = [{ href: "/affiliate", icon: Users, label: "Affiliate" }];

export function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();

  return (
    <div className="min-h-screen bg-ely-bg">
      {/* Desktop sidebar */}
      <aside className="hidden md:flex fixed left-0 top-0 bottom-0 w-64 border-r border-ely-border flex-col p-4">
        <Link href="/" className="text-2xl font-bold gradient-text mb-8 px-2">ELY</Link>
        <nav className="space-y-1 flex-1">
          {navItems.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                "flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm transition-colors min-h-[44px]",
                pathname === item.href || pathname.startsWith(item.href + "/")
                  ? "bg-ely-primary/20 text-white"
                  : "text-ely-muted hover:text-white hover:bg-white/5"
              )}
            >
              <item.icon size={20} />
              {item.label}
            </Link>
          ))}
          {desktopExtraItems.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                "flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm transition-colors min-h-[44px]",
                pathname === item.href
                  ? "bg-ely-primary/20 text-white"
                  : "text-ely-muted hover:text-white hover:bg-white/5"
              )}
            >
              <item.icon size={20} />
              {item.label}
            </Link>
          ))}
        </nav>
        <Link
          href="/settings"
          className="flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm text-ely-muted hover:text-white min-h-[44px]"
        >
          <Settings size={20} />
          Settings
        </Link>
      </aside>

      {/* Main content */}
      <main className="md:ml-64 pb-20 md:pb-0">
        {children}
      </main>

      {/* Mobile bottom nav */}
      <nav className="md:hidden fixed bottom-0 left-0 right-0 glass border-t border-ely-border safe-bottom z-50">
        <div className="flex justify-around py-2">
          {navItems.map((item) => (
            <button
              key={item.href}
              onClick={() => router.push(item.href)}
              className={cn(
                "flex flex-col items-center gap-0.5 px-3 py-1 min-h-[44px] min-w-[44px] justify-center",
                pathname === item.href || pathname.startsWith(item.href + "/")
                  ? "text-ely-primary"
                  : "text-ely-muted"
              )}
            >
              <item.icon size={20} />
              <span className="text-[10px]">{item.label}</span>
            </button>
          ))}
        </div>
      </nav>
    </div>
  );
}
