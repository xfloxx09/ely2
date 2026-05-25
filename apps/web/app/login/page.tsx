"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Navbar, Button, Card } from "@/components/ui";
import { apiFetch } from "@/lib/utils";

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError("");
    try {
      const data = await apiFetch("/auth/login", {
        method: "POST",
        body: JSON.stringify({ email, password }),
      });
      localStorage.setItem("ely_token", data.token);
      localStorage.setItem("ely_user", JSON.stringify(data.user));

      if (!data.user.personalityComplete) {
        router.push("/onboarding/personality");
      } else if (data.user.role === "ADMIN") {
        router.push("/admin");
      } else {
        router.push("/chat");
      }
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <>
      <Navbar />
      <main className="min-h-screen flex items-center justify-center px-4 pt-16">
        <Card className="w-full max-w-md">
          <h1 className="text-2xl font-bold mb-2">Welcome back</h1>
          <p className="text-sm text-ely-muted mb-6">Log in to continue with ELY</p>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-sm mb-1">Email</label>
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full px-4 py-3 rounded-xl bg-ely-bg border border-ely-border focus:border-ely-primary outline-none min-h-[44px]"
              />
            </div>
            <div>
              <label className="block text-sm mb-1">Password</label>
              <input
                type="password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full px-4 py-3 rounded-xl bg-ely-bg border border-ely-border focus:border-ely-primary outline-none min-h-[44px]"
              />
            </div>
            {error && <p className="text-red-400 text-sm">{error}</p>}
            <Button type="submit" className="w-full" disabled={loading}>
              {loading ? "Logging in..." : "Log In"}
            </Button>
          </form>

          <p className="text-sm text-ely-muted text-center mt-6">
            Don&apos;t have an account?{" "}
            <Link href="/signup" className="text-ely-accent hover:underline">Sign up</Link>
          </p>
        </Card>
      </main>
    </>
  );
}
