import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect } from "react";
import { useAuth } from "@/lib/auth";
import { Activity } from "lucide-react";

export const Route = createFileRoute("/")({
  component: IndexRedirect,
});

function IndexRedirect() {
  const { user, loading } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    if (loading) return;
    if (!user) navigate({ to: "/login", replace: true });
    else if (user.role === "admin" || user.role === "owner") navigate({ to: "/admin", replace: true });
    else navigate({ to: "/trader", replace: true });
  }, [user, loading, navigate]);

  return (
    <div className="flex min-h-screen items-center justify-center bg-background">
      <div className="flex flex-col items-center gap-3">
        <div className="flex h-14 w-14 items-center justify-center rounded-2xl gradient-primary shadow-elevated animate-pulse">
          <Activity className="h-7 w-7 text-primary-foreground" />
        </div>
        <div className="text-sm text-muted-foreground">Initializing MIKAPEDIA TOMS…</div>
      </div>
    </div>
  );
}
