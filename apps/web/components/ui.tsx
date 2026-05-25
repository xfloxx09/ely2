"use client";

import Link from "next/link";
import { useState } from "react";
import { Menu, X } from "lucide-react";
import { cn } from "@/lib/utils";

export function Navbar() {
  const [open, setOpen] = useState(false);

  const links = [
    { href: "/#features", label: "Features" },
    { href: "/pricing", label: "Pricing" },
    { href: "/affiliate-info", label: "Affiliate" },
    { href: "/login", label: "Login" },
  ];

  return (
    <nav className="fixed top-0 left-0 right-0 z-50 glass safe-top">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          <Link href="/" className="text-2xl font-bold gradient-text">
            ELY
          </Link>

          <div className="hidden md:flex items-center gap-8">
            {links.slice(0, 3).map((l) => (
              <Link key={l.href} href={l.href} className="text-sm text-ely-muted hover:text-white transition-colors">
                {l.label}
              </Link>
            ))}
            <Link
              href="/signup"
              className="px-5 py-2.5 bg-ely-primary hover:bg-ely-primary/90 rounded-full text-sm font-medium transition-colors min-h-[44px] flex items-center"
            >
              Get Started
            </Link>
          </div>

          <button
            className="md:hidden p-2 min-h-[44px] min-w-[44px] flex items-center justify-center"
            onClick={() => setOpen(!open)}
            aria-label="Toggle menu"
          >
            {open ? <X size={24} /> : <Menu size={24} />}
          </button>
        </div>
      </div>

      {open && (
        <div className="md:hidden glass border-t border-white/10 px-4 py-4 space-y-2">
          {links.map((l) => (
            <Link
              key={l.href}
              href={l.href}
              className="block py-3 text-ely-muted hover:text-white min-h-[44px]"
              onClick={() => setOpen(false)}
            >
              {l.label}
            </Link>
          ))}
          <Link
            href="/signup"
            className="block text-center py-3 bg-ely-primary rounded-full font-medium min-h-[44px]"
            onClick={() => setOpen(false)}
          >
            Get Started
          </Link>
        </div>
      )}
    </nav>
  );
}

export function Footer() {
  return (
    <footer className="border-t border-ely-border py-12 px-4 safe-bottom">
      <div className="max-w-7xl mx-auto grid grid-cols-2 md:grid-cols-4 gap-8">
        <div className="col-span-2 md:col-span-1">
          <span className="text-xl font-bold gradient-text">ELY</span>
          <p className="mt-2 text-sm text-ely-muted">AI with a face and soul.</p>
        </div>
        <div>
          <h4 className="font-semibold mb-3 text-sm">Product</h4>
          <div className="space-y-2 text-sm text-ely-muted">
            <Link href="/pricing" className="block hover:text-white">Pricing</Link>
            <Link href="/#features" className="block hover:text-white">Features</Link>
          </div>
        </div>
        <div>
          <h4 className="font-semibold mb-3 text-sm">Business</h4>
          <div className="space-y-2 text-sm text-ely-muted">
            <Link href="/affiliate-info" className="block hover:text-white">Affiliate Program</Link>
            <Link href="/legal/income-disclosure" className="block hover:text-white">Income Disclosure</Link>
          </div>
        </div>
        <div>
          <h4 className="font-semibold mb-3 text-sm">Legal</h4>
          <div className="space-y-2 text-sm text-ely-muted">
            <Link href="/legal/terms" className="block hover:text-white">Terms</Link>
            <Link href="/legal/privacy" className="block hover:text-white">Privacy</Link>
            <Link href="/legal/refund" className="block hover:text-white">Refund Policy</Link>
          </div>
        </div>
      </div>
      <div className="max-w-7xl mx-auto mt-8 pt-8 border-t border-ely-border text-center text-sm text-ely-muted">
        &copy; {new Date().getFullYear()} ELY.ai. All rights reserved.
      </div>
    </footer>
  );
}

export function Button({
  children,
  variant = "primary",
  className,
  ...props
}: React.ButtonHTMLAttributes<HTMLButtonElement> & { variant?: "primary" | "secondary" | "ghost" }) {
  return (
    <button
      className={cn(
        "px-6 py-3 rounded-full font-medium transition-all min-h-[44px] inline-flex items-center justify-center",
        variant === "primary" && "bg-ely-primary hover:bg-ely-primary/90 text-white",
        variant === "secondary" && "glass hover:bg-white/10",
        variant === "ghost" && "hover:bg-white/5 text-ely-muted hover:text-white",
        className
      )}
      {...props}
    >
      {children}
    </button>
  );
}

export function Card({ children, className }: { children: React.ReactNode; className?: string }) {
  return (
    <div className={cn("glass rounded-2xl p-6", className)}>
      {children}
    </div>
  );
}
