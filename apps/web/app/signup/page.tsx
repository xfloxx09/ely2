"use client";

import { useState, Suspense } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Navbar, Button, Card } from "@/components/ui";
import { apiFetch } from "@/lib/utils";

function SignupForm() {
  const router = useRouter();
  const params = useSearchParams();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [referralCode, setReferralCode] = useState(params.get("ref") || "");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError("");
    try {
      const data = await apiFetch("/auth/register", {
        method: "POST",
        body: JSON.stringify({ email, password, name, referralCode: referralCode || undefined }),
      });
      localStorage.setItem("ely_token", data.token);
      localStorage.setItem("ely_user", JSON.stringify(data.user));
      router.push("/onboarding/personality");
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
          <h1 className="text-2xl font-bold mb-2">Create your account</h1>
          <p className="text-sm text-ely-muted mb-6">Start your journey with ELY</p>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-sm mb-1">Name</label>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="w-full px-4 py-3 rounded-xl bg-ely-bg border border-ely-border focus:border-ely-primary outline-none min-h-[44px]"
                placeholder="Your name"
              />
            </div>
            <div>
              <label className="block text-sm mb-1">Email</label>
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full px-4 py-3 rounded-xl bg-ely-bg border border-ely-border focus:border-ely-primary outline-none min-h-[44px]"
                placeholder="you@example.com"
              />
            </div>
            <div>
              <label className="block text-sm mb-1">Password</label>
              <input
                type="password"
                required
                minLength={8}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full px-4 py-3 rounded-xl bg-ely-bg border border-ely-border focus:border-ely-primary outline-none min-h-[44px]"
                placeholder="Min 8 characters"
              />
            </div>
            <div>
              <label className="block text-sm mb-1">Referral Code (optional)</label>
              <input
                type="text"
                value={referralCode}
                onChange={(e) => setReferralCode(e.target.value)}
                className="w-full px-4 py-3 rounded-xl bg-ely-bg border border-ely-border focus:border-ely-primary outline-none min-h-[44px]"
                placeholder="ELY-XXXXXX"
              />
            </div>
            {error && <p className="text-red-400 text-sm">{error}</p>}
            <Button type="submit" className="w-full" disabled={loading}>
              {loading ? "Creating..." : "Create Account"}
            </Button>
          </form>

          <p className="text-sm text-ely-muted text-center mt-6">
            Already have an account?{" "}
            <Link href="/login" className="text-ely-accent hover:underline">Log in</Link>
          </p>
        </Card>
      </main>
    </>
  );
}

export default function SignupPage() {
  return (
    <Suspense fallback={<div className="min-h-screen flex items-center justify-center pt-16">Loading...</div>}>
      <SignupForm />
    </Suspense>
  );
}
