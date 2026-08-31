import { Link, useLocation, useNavigate } from "@tanstack/react-router";
import {
  Activity, AlertTriangle, BarChart3, Bell, CalendarClock, CandlestickChart, ClipboardCheck,
  FileBarChart, Gauge, HardDriveDownload, LayoutDashboard, LineChart, LogOut,
  Moon, Radio, ScrollText, Settings, ShieldCheck, Sun, Trophy, Users,
} from "lucide-react";
import { useEffect, useState, type ReactNode } from "react";
import { useAuth, type Role } from "@/lib/auth";
import { useWSStatus } from "@/lib/ws-context";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem,
  DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

interface NavItem { to: string; label: string; icon: React.ComponentType<{ className?: string }>; badge?: string }

const ADMIN_NAV: { section: string; items: NavItem[] }[] = [
  { section: "Overview", items: [
    { to: "/admin", label: "Dashboard", icon: LayoutDashboard },
    { to: "/admin/signals", label: "Signal Center", icon: Radio, badge: "8" },
    { to: "/admin/chart", label: "Live Chart", icon: CandlestickChart },
    { to: "/admin/compliance", label: "Compliance Engine", icon: ShieldCheck },
  ]},
  { section: "Operations", items: [
    { to: "/admin/traders", label: "Traders", icon: Users },
    { to: "/admin/attendance", label: "Attendance", icon: CalendarClock },
    { to: "/admin/mt5", label: "MT5 Monitoring", icon: HardDriveDownload },
    { to: "/admin/leaderboard", label: "Leaderboard", icon: Trophy },
  ]},
  { section: "Administration", items: [
    { to: "/admin/reports", label: "Reports", icon: FileBarChart },
    { to: "/admin/notifications", label: "Notifications", icon: Bell },
    { to: "/admin/audit", label: "Audit Logs", icon: ScrollText },
    { to: "/admin/users", label: "User Management", icon: Users },
    { to: "/admin/settings", label: "Settings", icon: Settings },
  ]},
];

const TRADER_NAV: { section: string; items: NavItem[] }[] = [
  { section: "Trading Desk", items: [
    { to: "/trader", label: "Dashboard", icon: LayoutDashboard },
    { to: "/trader/signals", label: "Signal Timeline", icon: Radio },
    { to: "/trader/chart", label: "Live Chart", icon: CandlestickChart },
    { to: "/trader/checklist", label: "Execution Checklist", icon: ClipboardCheck },
  ]},
  { section: "Personal", items: [
    { to: "/trader/attendance", label: "Attendance", icon: CalendarClock },
    { to: "/trader/report", label: "Session Report", icon: FileBarChart },
    { to: "/trader/profile", label: "My Profile", icon: Settings },
    { to: "/trader/mt5", label: "MT5 Account", icon: HardDriveDownload },
  ]},
];

export function AppLayout({ role, children }: { role: Role; children: ReactNode }) {
  const nav = role === "admin" ? ADMIN_NAV : TRADER_NAV;
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [dark, setDark] = useState(false);

  useEffect(() => {
    const stored = localStorage.getItem("mikapedia.theme");
    const isDark = stored === "dark";
    setDark(isDark);
    document.documentElement.classList.toggle("dark", isDark);
  }, []);
  const toggleTheme = () => {
    const next = !dark;
    setDark(next);
    document.documentElement.classList.toggle("dark", next);
    localStorage.setItem("mikapedia.theme", next ? "dark" : "light");
  };

  const handleLogout = async () => { await logout(); navigate({ to: "/login" }); };
  const handleProfile = () => {
    if (role === "admin") {
      navigate({ to: "/admin/settings" });
      return;
    }
    navigate({ to: "/trader/profile" });
  };
  const handlePreferences = () => {
    toggleTheme();
  };
  const handleReportIssue = () => {
    const subject = encodeURIComponent("Report an issue");
    const body = encodeURIComponent(`User: ${user?.name ?? "Unknown"}\nEmail: ${user?.email ?? "Unknown"}\nRole: ${role}\nPage: ${location.pathname}\n\nDescribe the issue:\n`);
    window.location.href = `mailto:support@mikapedia.com?subject=${subject}&body=${body}`;
  };
  const wsStatus = useWSStatus();

  const initials = (user?.name ?? "MK").split(" ").map(w => w[0]).slice(0, 2).join("").toUpperCase();

  return (
    <div className="min-h-screen bg-muted/40 text-foreground">
      <aside className="fixed inset-y-0 left-0 z-30 hidden w-64 flex-col bg-sidebar text-sidebar-foreground lg:flex">
        <div className="flex items-center gap-3 px-5 py-5 border-b border-sidebar-border">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl gradient-primary shadow-elevated">
            <Activity className="h-5 w-5 text-primary-foreground" />
          </div>
          <div>
            <div className="text-sm font-bold tracking-tight">MIKAPEDIA</div>
            <div className="text-[10px] uppercase tracking-[0.18em] text-sidebar-foreground/60">TOMS · v1.0</div>
          </div>
        </div>
        <nav className="flex-1 overflow-y-auto scrollbar-thin px-3 py-4">
          {nav.map(section => (
            <div key={section.section} className="mb-5">
              <div className="mb-2 px-3 text-[10px] font-semibold uppercase tracking-[0.16em] text-sidebar-foreground/50">
                {section.section}
              </div>
              <ul className="space-y-0.5">
                {section.items.map(item => {
                  const active = location.pathname === item.to ||
                    (item.to !== `/${role}` && location.pathname.startsWith(item.to));
                  const Icon = item.icon;
                  return (
                    <li key={item.to}>
                      <Link
                        to={item.to}
                        className={`group flex items-center gap-3 rounded-lg px-3 py-2 text-sm transition-all ${
                          active
                            ? "bg-sidebar-primary text-sidebar-primary-foreground shadow-elevated"
                            : "text-sidebar-foreground/80 hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
                        }`}
                      >
                        <Icon className="h-4 w-4 shrink-0" />
                        <span className="flex-1 truncate">{item.label}</span>
                        {item.badge && (
                          <span className="rounded-md bg-success/20 px-1.5 py-0.5 text-[10px] font-medium text-success">
                            {item.badge}
                          </span>
                        )}
                      </Link>
                    </li>
                  );
                })}
              </ul>
            </div>
          ))}
        </nav>
        <div className="border-t border-sidebar-border p-3">
          <div className="glass-panel rounded-lg p-3">
            <div className="mb-2 flex items-center gap-2 text-xs text-sidebar-foreground/70">
              <span className="inline-block h-2 w-2 rounded-full bg-success animate-pulse" />
              System Operational
            </div>
            <div className="text-[11px] text-sidebar-foreground/50">
              MT5 · TradingView · Webhooks live
            </div>
          </div>
        </div>
      </aside>

      <div className="lg:pl-64">
        <header className="sticky top-0 z-20 border-b border-border bg-background/80 backdrop-blur-xl">
          <div className="flex h-16 items-center gap-4 px-4 md:px-6">
            <div className="flex-1">
              <div className="relative max-w-md">
                <Input
                  placeholder="Search traders, signals, reports…"
                  className="h-9 bg-muted/60 pl-9 border-transparent focus-visible:bg-background"
                />
                <BarChart3 className="pointer-events-none absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
              </div>
            </div>
            <div className="hidden items-center gap-2 md:flex">
              <Badge variant="secondary" className="gap-1.5 bg-success/10 text-success border-success/20">
                <span className="h-1.5 w-1.5 rounded-full bg-success animate-pulse" /> MT5 Live
              </Badge>
              <Badge variant="secondary" className="gap-1.5 bg-info/10 text-info border-info/20">
                <LineChart className="h-3 w-3" /> TradingView
              </Badge>
            </div>
            <Button variant="ghost" size="icon" onClick={toggleTheme} aria-label="Toggle theme">
              {dark ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
            </Button>
            {/* WebSocket status dot */}
            <div className="flex items-center gap-1.5 px-2" title={`WebSocket: ${wsStatus}`}>
              <span className={`h-2 w-2 rounded-full ${
                wsStatus === "connected"    ? "bg-success animate-pulse" :
                wsStatus === "connecting"   ? "bg-warning animate-pulse" :
                "bg-destructive"
              }`} />
              <span className="text-[10px] text-muted-foreground hidden sm:inline">{wsStatus}</span>
            </div>
            <Button variant="ghost" size="icon" className="relative" asChild>
              <Link to={role === "admin" ? "/admin/notifications" : "/trader"}>
                <Bell className="h-4 w-4" />
                <span className="absolute right-1.5 top-1.5 h-2 w-2 rounded-full bg-destructive" />
              </Link>
            </Button>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button className="flex items-center gap-2 rounded-lg pl-1 pr-2 py-1 hover:bg-muted transition-colors">
                  <Avatar className="h-8 w-8"><AvatarFallback className="gradient-primary text-primary-foreground text-xs">{initials}</AvatarFallback></Avatar>
                  <div className="hidden text-left sm:block">
                    <div className="text-xs font-semibold leading-tight">{user?.name}</div>
                    <div className="text-[10px] uppercase tracking-wider text-muted-foreground">
                      {role === "admin" ? "Supervisor" : "Trader"}
                    </div>
                  </div>
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-56">
                <DropdownMenuLabel>
                  <div className="text-sm">{user?.name}</div>
                  <div className="text-[11px] font-normal text-muted-foreground">{user?.email}</div>
                </DropdownMenuLabel>
                <DropdownMenuSeparator />
                <DropdownMenuItem onSelect={(event) => { event.preventDefault(); handleProfile(); }}>
                  <Gauge className="mr-2 h-4 w-4" />Profile
                </DropdownMenuItem>
                <DropdownMenuItem onSelect={(event) => { event.preventDefault(); handlePreferences(); }}>
                  <Settings className="mr-2 h-4 w-4" />Preferences
                </DropdownMenuItem>
                <DropdownMenuItem onSelect={(event) => { event.preventDefault(); handleReportIssue(); }}>
                  <AlertTriangle className="mr-2 h-4 w-4" />Report an issue
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem onSelect={(event) => { event.preventDefault(); void handleLogout(); }} className="text-destructive">
                  <LogOut className="mr-2 h-4 w-4" />Sign out
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </header>

        <main className="p-4 md:p-6">{children}</main>
      </div>
    </div>
  );
}
