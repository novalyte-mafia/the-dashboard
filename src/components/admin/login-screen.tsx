"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent } from "@/components/ui/card";
import { Loader2, Lock, ShieldCheck, AlertCircle } from "lucide-react";

export function LoginScreen() {
  const [email, setEmail] = useState("founder@novalyte.io");
  const [password, setPassword] = useState("novalyte2025");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "Sign in failed.");
        setLoading(false);
        return;
      }
      window.location.reload();
    } catch {
      setError("Network error. Please try again.");
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen flex flex-col bg-background nv-grid-bg">
      <main className="flex-1 flex items-center justify-center p-6">
        <div className="w-full max-w-md">
          <div className="flex flex-col items-center mb-8">
            <div className="size-14 rounded-2xl bg-primary/10 flex items-center justify-center mb-4 ring-1 ring-primary/20">
              <LogoMark className="size-8 text-primary" />
            </div>
            <h1 className="text-2xl font-semibold tracking-tight">Novalyte Admin</h1>
            <p className="text-sm text-muted-foreground mt-1">Revenue Command Center</p>
          </div>

          <Card className="shadow-sm border-border/80">
            <CardContent className="pt-6">
              <form onSubmit={handleSubmit} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="email">Email</Label>
                  <Input
                    id="email"
                    type="email"
                    autoComplete="username"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="password">Password</Label>
                  <Input
                    id="password"
                    type="password"
                    autoComplete="current-password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    required
                  />
                </div>

                {error && (
                  <div className="flex items-start gap-2 text-sm text-destructive bg-destructive/5 border border-destructive/20 rounded-md px-3 py-2">
                    <AlertCircle className="size-4 mt-0.5 shrink-0" />
                    <span>{error}</span>
                  </div>
                )}

                <Button type="submit" className="w-full" disabled={loading}>
                  {loading ? <Loader2 className="size-4 animate-spin" /> : <Lock className="size-4" />}
                  Sign in
                </Button>

                <div className="text-center">
                  <button
                    type="button"
                    className="text-xs text-muted-foreground hover:text-foreground transition-colors"
                    onClick={() => setError("Password reset is configured by your administrator.")}
                  >
                    Forgot password?
                  </button>
                </div>
              </form>
            </CardContent>
          </Card>

          <div className="mt-6 flex items-center justify-center gap-2 text-xs text-muted-foreground">
            <ShieldCheck className="size-3.5" />
            <span>Authorized personnel only · noindex · nofollow</span>
          </div>
        </div>
      </main>
      <footer className="border-t border-border/60 py-4 px-6 text-center text-xs text-muted-foreground">
        Novalyte AI · Private Operations · © {new Date().getFullYear()}
      </footer>
    </div>
  );
}

function LogoMark({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 32 32" className={className} fill="none" aria-hidden="true">
      <path
        d="M16 4 C16.6 9.5 20.5 13.4 26 14 C20.5 14.6 16.6 18.5 16 24 C15.4 18.5 11.5 14.6 6 14 C11.5 13.4 15.4 9.5 16 4Z"
        fill="currentColor"
      />
    </svg>
  );
}
