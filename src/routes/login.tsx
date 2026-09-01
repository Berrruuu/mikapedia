import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import {
  Activity, ArrowRight, Eye, EyeOff, LineChart,
  Lock, Mail, ShieldCheck, Sparkles, ArrowLeft, KeyRound,
} from "lucide-react";
import { toast } from "sonner";
import { useAuth } from "@/lib/auth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";

export const Route = createFileRoute("/login")({
  head: () => ({ meta: [{ title: "Sign in · MIKAPEDIA TOMS" }] }),
  component: LoginPage,
});

type View = "login" | "forgot" | "reset";

function LoginPage() {
  const { user, login, forgotPassword, resetPassword } = useAuth();
  const navigate = useNavigate();
  const [view, setView] = useState<View>("login");

  // login state
  const [email, setEmail]     = useState("");
  const [password, setPassword] = useState("");
  const [remember, setRemember] = useState(true);
  const [show, setShow]       = useState(false);
  const [busy, setBusy]       = useState(false);

  // forgot state
  const [fpEmail, setFpEmail] = useState("");

  // reset state
  const [resetToken, setResetToken] = useState("");
  const [newPw, setNewPw]           = useState("");
  const [confirmPw, setConfirmPw]   = useState("");

  useEffect(() => {
    if (user) {
      const redirectPath = user.role === "admin" || user.role === "owner" ? "/admin" : "/trader";
      navigate({ to: redirectPath, replace: true });
    }
  }, [user, navigate]);

  // ── Login submit ────────────────────────────────────────────────────────────
  const submitLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    try {
      const u = await login(email, password, remember);
      toast.success(`Welcome back, ${u.name.split(" ")[0]}`);
      const redirectPath = u.role === "admin" || u.role === "owner" ? "/admin" : "/trader";
      navigate({ to: redirectPath, replace: true });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Login failed");
    } finally {
      setBusy(false);
    }
  };

  // ── Forgot password submit ──────────────────────────────────────────────────
  const submitForgot = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    try {
      const msg = await forgotPassword(fpEmail);
      toast.success(msg);
      setView("reset");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed");
    } finally {
      setBusy(false);
    }
  };

  // ── Reset password submit ───────────────────────────────────────────────────
  const submitReset = async (e: React.FormEvent) => {
    e.preventDefault();
    if (newPw !== confirmPw) { toast.error("Passwords do not match"); return; }
    if (newPw.length < 8) { toast.error("Password must be at least 8 characters"); return; }
    setBusy(true);
    try {
      await resetPassword(resetToken, newPw);
      toast.success("Password reset successfully. Please log in.");
      setView("login");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Reset failed");
    } finally {
      setBusy(false);
    }
  };

  const brandPanel = (
    <div className="relative hidden lg:flex flex-col justify-between overflow-hidden gradient-hero p-10 text-white">
      <div className="absolute inset-0 opacity-30" style={{
        backgroundImage: "radial-gradient(circle at 20% 20%, rgba(255,255,255,0.25), transparent 40%), radial-gradient(circle at 80% 60%, rgba(46,125,50,0.4), transparent 45%)",
      }} />
      <div className="relative flex items-center gap-3">
        <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-white/15 backdrop-blur-md border border-white/25">
          <Activity className="h-5 w-5" />
        </div>
        <div>
          <div className="text-base font-bold tracking-tight">MIKAPEDIA</div>
          <div className="text-[10px] uppercase tracking-[0.22em] text-white/70">Trading Operations · TOMS</div>
        </div>
      </div>
      <div className="relative">
        <div className="mb-4 inline-flex items-center gap-2 rounded-full bg-white/10 px-3 py-1 text-xs backdrop-blur border border-white/15">
          <Sparkles className="h-3 w-3" /> Enterprise Operations Platform
        </div>
        <h1 className="text-4xl font-bold leading-tight tracking-tight">
          Command every signal.<br />Measure every execution.
        </h1>
        <p className="mt-4 max-w-md text-sm text-white/80">
          Monitor trader discipline, attendance, and SOP compliance in real time.
        </p>
        <div className="mt-8 grid grid-cols-2 gap-3 max-w-md">
          {[
            { icon: LineChart,  label: "Signal Compliance", value: "94.6%" },
            { icon: ShieldCheck, label: "SOP Adherence",    value: "A+" },
            { icon: Activity,   label: "MT5 Bridges",       value: "8 live" },
            { icon: Sparkles,   label: "Attendance",        value: "18/20" },
          ].map((s) => (
            <div key={s.label} className="rounded-xl bg-white/10 border border-white/15 backdrop-blur-md p-4">
              <s.icon className="h-4 w-4 text-white/80" />
              <div className="mt-2 text-lg font-bold">{s.value}</div>
              <div className="text-[11px] uppercase tracking-wider text-white/60">{s.label}</div>
            </div>
          ))}
        </div>
      </div>
      <div className="relative text-xs text-white/60">
        © {new Date().getFullYear()} MIKAPEDIA Capital · Internal use only · v1.0.0
      </div>
    </div>
  );

  return (
    <div className="min-h-screen grid lg:grid-cols-2 bg-background">
      {brandPanel}

      <div className="flex items-center justify-center px-6 py-12 md:px-12">
        <div className="w-full max-w-md">

          {/* ── LOGIN ── */}
          {view === "login" && (
            <>
              <div className="mb-8">
                <div className="mb-2 text-[11px] font-semibold uppercase tracking-[0.2em] text-primary">Secure Sign-in</div>
                <h2 className="text-3xl font-bold tracking-tight">Welcome back</h2>
                <p className="mt-2 text-sm text-muted-foreground">Enter your enterprise credentials.</p>
              </div>

              <form onSubmit={submitLogin} className="space-y-4">
                <div className="space-y-1.5">
                  <Label htmlFor="email">Email</Label>
                  <div className="relative">
                    <Mail className="pointer-events-none absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
                    <Input id="email" type="email" autoComplete="email" required
                      value={email} onChange={(e) => setEmail(e.target.value)} className="pl-9 h-11" />
                  </div>
                </div>

                <div className="space-y-1.5">
                  <div className="flex items-center justify-between">
                    <Label htmlFor="password">Password</Label>
                    <button type="button" onClick={() => { setFpEmail(email); setView("forgot"); }}
                      className="text-xs font-medium text-primary hover:underline">
                      Forgot password?
                    </button>
                  </div>
                  <div className="relative">
                    <Lock className="pointer-events-none absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
                    <Input id="password" type={show ? "text" : "password"} autoComplete="current-password" required
                      value={password} onChange={(e) => setPassword(e.target.value)} className="pl-9 pr-10 h-11" />
                    <button type="button" onClick={() => setShow((s) => !s)}
                      className="absolute right-2.5 top-2 rounded-md p-1 text-muted-foreground hover:bg-muted">
                      {show ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                    </button>
                  </div>
                </div>

                <label className="flex items-center gap-2 text-sm text-muted-foreground">
                  <Checkbox checked={remember} onCheckedChange={(v) => setRemember(!!v)} />
                  Keep me signed in
                </label>

                <Button type="submit" disabled={busy}
                  className="h-11 w-full gradient-primary text-primary-foreground">
                  {busy ? "Authenticating…" : "Sign in securely"}
                  <ArrowRight className="ml-2 h-4 w-4" />
                </Button>
              </form>
            </>
          )}

          {/* ── FORGOT PASSWORD ── */}
          {view === "forgot" && (
            <>
              <button onClick={() => setView("login")} className="mb-6 flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition">
                <ArrowLeft className="h-4 w-4" /> Back to sign in
              </button>
              <div className="mb-8">
                <div className="mb-3 flex h-12 w-12 items-center justify-center rounded-xl bg-primary/10">
                  <KeyRound className="h-6 w-6 text-primary" />
                </div>
                <h2 className="text-2xl font-bold">Reset your password</h2>
                <p className="mt-2 text-sm text-muted-foreground">
                  Enter your email and we'll send a reset link.
                </p>
              </div>
              <form onSubmit={submitForgot} className="space-y-4">
                <div className="space-y-1.5">
                  <Label>Email address</Label>
                  <div className="relative">
                    <Mail className="pointer-events-none absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
                    <Input type="email" required value={fpEmail}
                      onChange={(e) => setFpEmail(e.target.value)} className="pl-9 h-11" />
                  </div>
                </div>
                <Button type="submit" disabled={busy} className="h-11 w-full gradient-primary text-primary-foreground">
                  {busy ? "Sending…" : "Send reset link"}
                  <ArrowRight className="ml-2 h-4 w-4" />
                </Button>
              </form>
              <p className="mt-4 text-center text-xs text-muted-foreground">
                In development mode, check the API response for the token.
              </p>
            </>
          )}

          {/* ── RESET PASSWORD ── */}
          {view === "reset" && (
            <>
              <button onClick={() => setView("forgot")} className="mb-6 flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition">
                <ArrowLeft className="h-4 w-4" /> Back
              </button>
              <div className="mb-8">
                <div className="mb-3 flex h-12 w-12 items-center justify-center rounded-xl bg-success/10">
                  <ShieldCheck className="h-6 w-6 text-success" />
                </div>
                <h2 className="text-2xl font-bold">Set new password</h2>
                <p className="mt-2 text-sm text-muted-foreground">Enter the reset token and your new password.</p>
              </div>
              <form onSubmit={submitReset} className="space-y-4">
                <div className="space-y-1.5">
                  <Label>Reset Token</Label>
                  <Input value={resetToken} onChange={(e) => setResetToken(e.target.value)}
                    placeholder="Paste token from email / API response" required />
                </div>
                <div className="space-y-1.5">
                  <Label>New Password</Label>
                  <Input type="password" value={newPw} onChange={(e) => setNewPw(e.target.value)}
                    placeholder="Min. 8 characters" required className="h-11" />
                </div>
                <div className="space-y-1.5">
                  <Label>Confirm Password</Label>
                  <Input type="password" value={confirmPw} onChange={(e) => setConfirmPw(e.target.value)}
                    placeholder="Repeat new password" required className="h-11" />
                </div>
                <Button type="submit" disabled={busy} className="h-11 w-full gradient-primary text-primary-foreground">
                  {busy ? "Resetting…" : "Reset password"}
                  <ArrowRight className="ml-2 h-4 w-4" />
                </Button>
              </form>
            </>
          )}

        </div>
      </div>
    </div>
  );
}
