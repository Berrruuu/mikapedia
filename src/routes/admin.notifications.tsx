import { createFileRoute } from "@tanstack/react-router";
import { useState, useEffect, useCallback } from "react";
import type { ComponentType } from "react";
import { Bell, AlertTriangle, CheckCircle2, Clock, Zap, Check, Trash2, Filter } from "lucide-react";
import { toast } from "sonner";
import { PageHeader } from "@/components/page-header";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { notificationsApi, Notification } from "@/lib/api";
import { useWSEvent } from "@/lib/ws-context";

export const Route = createFileRoute("/admin/notifications")({
  component: NotificationsPage,
});

type Level = "info" | "warning" | "danger" | "success";

interface NotifItem {
  id: string;
  type: string;
  title: string;
  time: string;
  level: Level;
  read: boolean;
}

function formatTimeAgo(timestamp: string) {
  const diffMs = Date.now() - new Date(timestamp).getTime();
  const minutes = Math.round(diffMs / 60000);
  if (minutes < 60) return `${minutes}m`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `${hours}h`;
  const days = Math.round(hours / 24);
  return `${days}d`;
}

function mapNotification(notification: Notification): NotifItem {
  return {
    id: String(notification.id),
    type: notification.type,
    title: notification.title,
    time: formatTimeAgo(notification.created_at),
    level: notification.level,
    read: notification.read,
  };
}

const LEVEL_STYLE: Record<Level, string> = {
  danger:  "bg-destructive/10 text-destructive",
  warning: "bg-warning/10 text-warning",
  success: "bg-success/10 text-success",
  info:    "bg-info/10 text-info",
};

const LEVEL_ICON: Record<Level, ComponentType<{ className?: string }>> = {
  danger:  AlertTriangle,
  warning: Clock,
  success: CheckCircle2,
  info:    Zap,
};

function NotificationsPage() {
  const [items, setItems] = useState<NotifItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [filterType, setFilterType] = useState("all");
  const [filterLevel, setFilterLevel] = useState("all");
  const [showUnread, setShowUnread] = useState(false);

  const unreadCount = items.filter((n) => !n.read).length;

  useEffect(() => {
    const fetchNotifications = async () => {
      try {
        const data = await notificationsApi.list();
        const itemsArray = Array.isArray(data) ? data : (data?.data ?? []);
        setItems(itemsArray.map(mapNotification));
      } catch (error) {
        console.error("Failed to fetch notifications", error);
      } finally {
        setLoading(false);
      }
    };

    void fetchNotifications();
  }, []);

  const filtered = items.filter((n) => {
    if (showUnread && n.read) return false;
    if (filterType !== "all" && n.type !== filterType) return false;
    if (filterLevel !== "all" && n.level !== filterLevel) return false;
    return true;
  });

  async function markRead(id: string) {
    setItems((prev) => prev.map((n) => n.id === id ? { ...n, read: true } : n));
    try {
      await notificationsApi.markRead(Number(id));
    } catch (error) {
      console.error("Failed to mark notification read", error);
    }
  }

  async function markAllRead() {
    setItems((prev) => prev.map((n) => ({ ...n, read: true })));
    try {
      await notificationsApi.markAllRead();
    } catch (error) {
      console.error("Failed to mark all notifications read", error);
    }
  }

  async function dismiss(id: string) {
    setItems((prev) => prev.filter((n) => n.id !== id));
    try {
      await notificationsApi.dismiss(Number(id));
    } catch (error) {
      console.error("Failed to dismiss notification", error);
    }
  }

  function clearAll() {
    setItems([]);
  }

  // WebSocket: push new notifications in real time
  const handleNewNotif = useCallback((data: unknown) => {
    const n = data as Notification;
    if (!n?.title) return;
    const item = mapNotification(n);
    setItems((prev) => {
      if (prev.find((x) => x.id === item.id)) return prev;
      toast.info(item.title, { icon: <Bell className="h-4 w-4" /> });
      return [item, ...prev];
    });
  }, []);

  useWSEvent("notification", handleNewNotif);

  return (
    <>
      <PageHeader
        eyebrow="Alerts"
        title="Notification Center"
        description="Alert sistem, compliance, kehadiran, dan sinyal dalam satu feed."
        actions={
          <div className="flex gap-2">
            {unreadCount > 0 && (
              <Button variant="outline" size="sm" onClick={markAllRead}>
                <Check className="mr-1.5 h-3.5 w-3.5" />Tandai Semua Dibaca
              </Button>
            )}
            <Button variant="outline" size="sm" onClick={clearAll} className="text-destructive hover:text-destructive">
              <Trash2 className="mr-1.5 h-3.5 w-3.5" />Hapus Semua
            </Button>
          </div>
        }
      />

      <div className="mb-4 flex flex-wrap gap-2">
        <Badge variant="outline" className="gap-1.5">
          <Bell className="h-3 w-3" />{items.length} total
        </Badge>
        {unreadCount > 0 && (
          <Badge variant="outline" className="bg-primary/10 text-primary border-primary/20">
            {unreadCount} belum dibaca
          </Badge>
        )}
        {(["danger", "warning", "success", "info"] as Level[]).map((l) => {
          const count = items.filter((n) => n.level === l).length;
          if (!count) return null;
          return (
            <Badge key={l} variant="outline" className={`${LEVEL_STYLE[l]} border-transparent`}>
              {count} {l}
            </Badge>
          );
        })}
      </div>

      <Card className="p-0 overflow-hidden">
        <div className="flex flex-wrap items-center gap-3 border-b border-border/60 p-4">
          <Filter className="h-4 w-4 text-muted-foreground shrink-0" />
          <Select value={filterType} onValueChange={setFilterType}>
            <SelectTrigger className="h-8 w-36 text-xs"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Semua Tipe</SelectItem>
              <SelectItem value="signal">Signal</SelectItem>
              <SelectItem value="compliance">Compliance</SelectItem>
              <SelectItem value="attendance">Attendance</SelectItem>
              <SelectItem value="system">System</SelectItem>
            </SelectContent>
          </Select>
          <Select value={filterLevel} onValueChange={setFilterLevel}>
            <SelectTrigger className="h-8 w-36 text-xs"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Semua Level</SelectItem>
              <SelectItem value="danger">Danger</SelectItem>
              <SelectItem value="warning">Warning</SelectItem>
              <SelectItem value="success">Success</SelectItem>
              <SelectItem value="info">Info</SelectItem>
            </SelectContent>
          </Select>
          <button
            onClick={() => setShowUnread((v) => !v)}
            className={`text-xs px-3 py-1.5 rounded-lg border transition ${showUnread ? "border-primary/60 bg-primary/5 text-primary" : "border-border/60 text-muted-foreground hover:text-foreground"}`}
          >
            Belum dibaca saja
          </button>
          <span className="ml-auto text-xs text-muted-foreground">{filtered.length} ditampilkan</span>
        </div>

        {filtered.length === 0 ? (
          <div className="p-12 text-center text-sm text-muted-foreground">
            <Bell className="mx-auto mb-3 h-8 w-8 opacity-30" />
            Tidak ada notifikasi.
          </div>
        ) : (
          <div className="divide-y divide-border/60">
            {filtered.map((n) => {
              const Icon = LEVEL_ICON[n.level];
              return (
                <div key={n.id} className={`flex items-start gap-3 p-4 transition hover:bg-muted/40 ${!n.read ? "bg-primary/[0.02]" : ""}`}>
                  <div className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-lg ${LEVEL_STYLE[n.level]}`}>
                    <Icon className="h-4 w-4" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className={`text-sm ${!n.read ? "font-semibold" : "font-medium"}`}>{n.title}</div>
                    <div className="mt-0.5 flex items-center gap-2 text-[11px] text-muted-foreground">
                      <Badge variant="outline" className="capitalize">{n.type}</Badge>
                      <span>{n.time} ago</span>
                      {!n.read && <span className="h-1.5 w-1.5 rounded-full bg-primary inline-block" />}
                    </div>
                  </div>
                  <div className="flex items-center gap-1 shrink-0">
                    {!n.read && (
                      <Button variant="ghost" size="sm" className="h-7 px-2" onClick={() => markRead(n.id)}>
                        <Check className="h-3.5 w-3.5" />
                      </Button>
                    )}
                    <Button variant="ghost" size="sm" className="h-7 px-2 text-destructive hover:text-destructive" onClick={() => dismiss(n.id)}>
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </Card>
    </>
  );
}
