"use client";

import { useEffect, useState } from "react";
import { AppShell } from "@/components/app-shell";
import { Card, Button } from "@/components/ui";
import { apiFetch } from "@/lib/utils";

export default function BoutiquePage() {
  const [items, setItems] = useState<{ id: string; name: string; description: string; type: string; priceCents: number; xpCost?: number; owned: boolean }[]>([]);

  useEffect(() => {
    apiFetch("/avatar/boutique").then(setItems).catch(() => {});
  }, []);

  return (
    <AppShell>
      <div className="p-4 md:p-8 max-w-4xl mx-auto">
        <h1 className="text-2xl font-bold mb-2">Avatar Boutique</h1>
        <p className="text-ely-muted mb-8">Customize your ELY with outfits, environments, and expressions</p>

        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {items.map((item) => (
            <Card key={item.id}>
              <div className="aspect-square rounded-xl bg-ely-bg mb-4 flex items-center justify-center">
                <span className="text-4xl">✨</span>
              </div>
              <h3 className="font-semibold">{item.name}</h3>
              <p className="text-sm text-ely-muted mb-3">{item.description}</p>
              <div className="flex items-center justify-between">
                {item.owned ? (
                  <span className="text-sm text-green-400">Owned</span>
                ) : (
                  <span className="text-sm text-ely-accent">
                    {item.priceCents > 0 ? `$${(item.priceCents / 100).toFixed(2)}` : ""}
                    {item.xpCost ? ` ${item.xpCost} XP` : ""}
                  </span>
                )}
                {!item.owned && (
                  <Button variant="secondary" className="text-xs px-4 py-2 min-h-[36px]">
                    {item.priceCents > 0 ? "Buy" : "Earn"}
                  </Button>
                )}
              </div>
            </Card>
          ))}
        </div>
      </div>
    </AppShell>
  );
}
