"use client";

import { useEffect, useState } from "react";
import { AppShell } from "@/components/app-shell";
import { Card, Button } from "@/components/ui";
import { apiFetch } from "@/lib/utils";

export default function AdminPage() {
  const [users, setUsers] = useState<{ id: string; email: string; tier: string; role: string }[]>([]);
  const [authorized, setAuthorized] = useState(false);

  useEffect(() => {
    apiFetch("/auth/me")
      .then((d) => {
        if (d.user?.role === "ADMIN") {
          setAuthorized(true);
          return apiFetch("/admin/users");
        }
        throw new Error("Not admin");
      })
      .then(setUsers)
      .catch(() => setAuthorized(false));
  }, []);

  if (!authorized) {
    return (
      <AppShell>
        <div className="p-8 text-center text-ely-muted">Admin access required</div>
      </AppShell>
    );
  }

  return (
    <AppShell>
      <div className="p-4 md:p-8 max-w-6xl mx-auto">
        <h1 className="text-2xl font-bold mb-8">Admin Panel</h1>

        <div className="grid sm:grid-cols-3 gap-4 mb-8">
          <Card>
            <h3 className="font-semibold mb-2">Commission Runs</h3>
            <p className="text-sm text-ely-muted mb-3">Trigger monthly commission calculation</p>
            <Button variant="secondary" className="text-sm">Run Commissions</Button>
          </Card>
          <Card>
            <h3 className="font-semibold mb-2">70% Rule Compliance</h3>
            <p className="text-sm text-ely-muted mb-3">Monitor retail vs affiliate commission ratio</p>
            <Button variant="secondary" className="text-sm">View Dashboard</Button>
          </Card>
          <Card>
            <h3 className="font-semibold mb-2">Income Disclosure</h3>
            <p className="text-sm text-ely-muted mb-3">Update quarterly earnings by rank</p>
            <Button variant="secondary" className="text-sm">Manage</Button>
          </Card>
        </div>

        <h2 className="text-lg font-semibold mb-4">Users ({users.length})</h2>
        <div className="space-y-2">
          {users.map((u) => (
            <Card key={u.id} className="flex justify-between items-center py-3">
              <div>
                <p className="font-medium text-sm">{u.email}</p>
                <p className="text-xs text-ely-muted">{u.role}</p>
              </div>
              <span className="text-xs px-2 py-1 rounded-full bg-ely-primary/20">{u.tier}</span>
            </Card>
          ))}
        </div>
      </div>
    </AppShell>
  );
}
