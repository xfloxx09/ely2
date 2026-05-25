"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { MessageCircle, LayoutGrid, User, Users, Trophy, Settings, Globe, MessagesSquare } from "lucide-react";
import { cn, apiFetch } from "@/lib/utils";

const navItems = [
  { href: "/chat", icon: MessageCircle, label: "Chat" },
  { href: "/conversations", icon: MessagesSquare, label: "Conversations", badgeKey: "conversations" as const },
  { href: "/community", icon: Globe, label: "Community" },
  { href: "/tasks", icon: LayoutGrid, label: "Tasks" },
  { href: "/gamification", icon: Trophy, label: "Quests" },
  { href: "/profile", icon: User, label: "Profile" },
];

const mobileNavItems = navItems.filter((item) => item.href !== "/tasks");

const desktopExtraItems = [{ href: "/affiliate", icon: Users, label: "Affiliate" }];

export function AppShell({
  children,
  unreadConversations: unreadProp,
}: {
  children: React.ReactNode;
  unreadConversations?: number;
}) {
  const pathname = usePathname();
  const router = useRouter();
  const [unread, setUnread] = useState(unreadProp ?? 0);

  useEffect(() => {
    if (unreadProp !== undefined) setUnread(unreadProp);
  }, [unreadProp]);

  useEffect(() => {
    let active = true;

    async function poll() {
      try {
        const data = await apiFetch("/conversations/unread-count");
        if (active) setUnread(data.count ?? 0);
      } catch {
        /* not logged in */
      }
    }

    poll();
    const t = setInterval(poll, 25000);
    return () => {
      active = false;
      clearInterval(t);
    };
  }, [pathname]);

  function isActive(href: string) {
    return pathname === href || pathname.startsWith(href + "/");
  }

  function NavLink({
    href,
    icon: Icon,
    label,
    showBadge,
  }: {
    href: string;
    icon: typeof MessageCircle;
    label: string;
    showBadge?: boolean;
  }) {
    return (
      <Link
        href={href}
        className={cn(
          "flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm transition-colors min-h-[44px]",
          isActive(href) ? "bg-ely-primary/20 text-white" : "text-ely-muted hover:text-white hover:bg-white/5"
        )}
      >
        <span className="relative">
          <Icon size={20} />
          {showBadge && unread > 0 && (
            <span className="absolute -right-2 -top-2 flex h-4 min-w-4 items-center justify-center rounded-full bg-ely-primary px-0.5 text-[9px] font-bold text-white">
              {unread > 9 ? "9+" : unread}
            </span>
          )}
        </span>
        {label}
        {showBadge && unread > 0 && (
          <span className="ml-auto rounded-full bg-ely-primary/20 px-2 py-0.5 text-[10px] font-medium text-ely-primary">
            {unread} new
          </span>
        )}
      </Link>
    );
  }

  return (
    <div className="min-h-screen bg-ely-bg">
      <aside className="hidden md:flex fixed left-0 top-0 bottom-0 w-64 border-r border-ely-border flex-col p-4">
        <Link href="/" className="text-2xl font-bold gradient-text mb-8 px-2">
          ELY
        </Link>
        <nav className="space-y-1 flex-1">
          {navItems.map((item) => (
            <NavLink
              key={item.href}
              href={item.href}
              icon={item.icon}
              label={item.label}
              showBadge={item.badgeKey === "conversations"}
            />
          ))}
          {desktopExtraItems.map((item) => (
            <NavLink key={item.href} href={item.href} icon={item.icon} label={item.label} />
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

      <main className="md:ml-64 pb-20 md:pb-0">{children}</main>

      <nav className="md:hidden fixed bottom-0 left-0 right-0 glass border-t border-ely-border safe-bottom z-50">
        <div className="flex justify-around py-2">
          {mobileNavItems.map((item) => (
            <button
              key={item.href}
              onClick={() => router.push(item.href)}
              className={cn(
                "relative flex flex-col items-center gap-0.5 px-2 py-1 min-h-[44px] min-w-[44px] justify-center",
                isActive(item.href) ? "text-ely-primary" : "text-ely-muted"
              )}
            >
              <item.icon size={20} />
              {item.badgeKey === "conversations" && unread > 0 && (
                <span className="absolute right-1 top-0 flex h-4 min-w-4 items-center justify-center rounded-full bg-ely-primary px-0.5 text-[9px] font-bold text-white">
                  {unread > 9 ? "9+" : unread}
                </span>
              )}
              <span className="text-[9px]">{item.label}</span>
            </button>
          ))}
        </div>
      </nav>
    </div>
  );
}
