import { useState } from "react";
import { db as supabase } from "@/lib/db";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export function AuthScreen({ embedded = false }: { embedded?: boolean }) {
  const [mode, setMode] = useState<"signin" | "signup">(() =>
    typeof window !== "undefined" && sessionStorage.getItem("hisaaboo:auth-mode") === "signup" ? "signup" : "signin");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ type: "error" | "info"; text: string } | null>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setMsg(null);
    if (mode === "signin") {
      const { error } = await supabase.auth.signInWithPassword({ email, password });
      if (error) setMsg({ type: "error", text: /not confirmed/i.test(error.message) ? "Please confirm your email first — open the link we sent to your inbox." : error.message });
    } else {
      const { data, error } = await supabase.auth.signUp({
        email,
        password,
        options: { emailRedirectTo: `${window.location.origin}/billing` },
      });
      if (error) setMsg({ type: "error", text: error.message });
      else if (!data.session) setMsg({ type: "info", text: `We sent a confirmation link to ${email}. Open it to activate your account, then sign in.` });
    }
    setBusy(false);
  }

  async function google() {
    setMsg(null);
    sessionStorage.setItem("hisaaboo:connect-store", "1");
    const { error } = await supabase.auth.signInWithOAuth({ provider: "google", options: { redirectTo: `${window.location.origin}/billing` } });
    if (error) setMsg({ type: "error", text: error.message ?? "Google sign-in failed" });
  }

  return (
    <div className={embedded ? "flex justify-center" : "flex min-h-screen items-center justify-center bg-muted px-4"}>
      <div className={embedded ? "w-full max-w-sm" : "w-full max-w-sm rounded-xl border bg-card p-6 shadow-sm"}>
        <h1 className="text-2xl font-bold text-foreground">Hisaaboo</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          {mode === "signin" ? "Sign in to manage your billing & online store" : "Create your free merchant account"}
        </p>
        <Button type="button" className="mt-6 h-11 w-full gap-[10px] rounded-md border border-[#747775] bg-[#FFFFFF] px-3 text-sm font-medium text-[#1F1F1F] shadow-sm hover:bg-[#F8F9FA]" style={{ fontFamily: "'Google Sans', inherit" }} onClick={google}>
          <svg aria-hidden="true" width="18" height="18" viewBox="0 0 24 24"><path fill="#4285F4" d="M23.49 12.27c0-.79-.07-1.54-.19-2.27H12v4.51h6.47c-.29 1.48-1.14 2.73-2.4 3.58v3h3.86c2.26-2.09 3.56-5.17 3.56-8.82z"/><path fill="#34A853" d="M12 24c3.24 0 5.95-1.08 7.93-2.91l-3.86-3c-1.08.72-2.45 1.16-4.07 1.16-3.13 0-5.78-2.11-6.73-4.96H1.29v3.09C3.26 21.3 7.31 24 12 24z"/><path fill="#FBBC05" d="M5.27 14.29c-.25-.72-.38-1.49-.38-2.29s.14-1.57.38-2.29V6.62H1.29C.47 8.24 0 10.06 0 12s.47 3.76 1.29 5.38l3.98-3.09z"/><path fill="#EA4335" d="M12 4.75c1.77 0 3.35.61 4.6 1.8l3.42-3.42C17.95 1.19 15.24 0 12 0 7.31 0 3.26 2.7 1.29 6.62l3.98 3.09c.95-2.85 3.6-4.96 6.73-4.96z"/></svg>
          Continue with Google
        </Button>
        <p className="mt-2 text-center text-xs text-muted-foreground">Fastest — no confirmation email needed</p>
        <div className="my-4 flex items-center gap-3 text-xs text-muted-foreground"><span className="h-px flex-1 bg-border" />or use email<span className="h-px flex-1 bg-border" /></div>
        <form onSubmit={submit} className="space-y-3">
          <div className="space-y-1">
            <Label htmlFor="email">Email</Label>
            <Input id="email" type="email" required value={email} onChange={(e) => setEmail(e.target.value)} />
          </div>
          <div className="space-y-1">
            <Label htmlFor="password">Password</Label>
            <Input id="password" type="password" required minLength={6} value={password} onChange={(e) => setPassword(e.target.value)} />
          </div>
          {msg && (
            <p className={msg.type === "error" ? "text-sm text-destructive" : "text-sm text-muted-foreground"}>{msg.text}</p>
          )}
          <Button type="submit" variant="outline" className="w-full" disabled={busy}>
            {busy ? "Please wait…" : mode === "signin" ? "Sign in" : "Create account"}
          </Button>
        </form>
        <button
          type="button"
          className="mt-4 w-full text-center text-sm text-primary underline-offset-4 hover:underline"
          onClick={() => { setMode(mode === "signin" ? "signup" : "signin"); setMsg(null); }}
        >
          {mode === "signin" ? "New here? Create an account" : "Already have an account? Sign in"}
        </button>
      </div>
    </div>
  );
}
