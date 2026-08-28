import { createFileRoute, Outlet, useNavigate } from "@tanstack/react-router";
import { useEffect } from "react";
import { useAuth } from "@/lib/auth";
import { AppLayout } from "@/components/app-layout";
import { Activity } from "lucide-react";

export const Route = createFileRoute("/trader")({
  ssr: false,
  component: TraderLayout,
});

function TraderLayout() {
  const { user, loading, logout } = useAuth();
  const navigate = useNavigate();
  useEffect(() => {
    if (loading) return;
    if (!user) { navigate({ to: "/login", replace: true }); return; }
    if (user.status === "suspended") { void logout(); navigate({ to: "/login", replace: true }); return; }
    if (user.role !== "trader") navigate({ to: "/admin", replace: true });
  }, [user, loading, navigate, logout]);

  if (loading || !user || user.role !== "trader") {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <div className="flex flex-col items-center gap-3">
          <div className="flex h-12 w-12 items-center justify-center rounded-xl gradient-primary animate-pulse">
            <Activity className="h-6 w-6 text-primary-foreground" />
          </div>
          <div className="text-xs text-muted-foreground">Verifying trader session…</div>
        </div>
      </div>
    );
  }
  return <AppLayout role="trader"><Outlet /></AppLayout>;
}
