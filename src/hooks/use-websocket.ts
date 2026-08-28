/**
 * useWebSocket — persistent WebSocket connection to Django Channels
 * Dev:  ws://localhost:8000/ws/live/?token=<JWT>
 * Prod: wss://yourdomain.com/ws/live/?token=<JWT>  (via Nginx proxy)
 *
 * Reconnects automatically with exponential backoff.
 * Dispatches typed events via callbacks.
 */

import { useEffect, useRef, useCallback } from "react";
import { getAccessToken } from "@/lib/auth";

// Compute WebSocket URL dynamically for dev vs production.
function getWSUrl(): string {
  if (typeof window === "undefined") return "ws://localhost:8000/ws/live/";
  const host = window.location.hostname;
  const isLocal = host === "localhost" || host === "127.0.0.1";
  const proto = window.location.protocol === "https:" ? "wss:" : "ws:";
  const port = isLocal ? ":8000" : "";
  return `${proto}//${host}${port}/ws/live/`;
}
const WS_URL = getWSUrl();

export type WSMessageType =
  | "connection_established"
  | "signal_update"
  | "mt5_update"
  | "attendance_update"
  | "notification"
  | "dashboard_stats"
  | "compliance_update"
  | "pong";

export interface WSMessage<T = unknown> {
  type: WSMessageType;
  data?: T;
  user_id?: string;
  role?: string;
}

type MessageHandler = (msg: WSMessage) => void;

interface UseWebSocketOptions {
  onMessage?: MessageHandler;
  onSignal?: (data: unknown) => void;
  onMT5?: (data: unknown) => void;
  onAttendance?: (data: unknown) => void;
  onNotification?: (data: unknown) => void;
  onDashboardStats?: (data: unknown) => void;
  onCompliance?: (data: unknown) => void;
  enabled?: boolean;
}

export function useWebSocket(options: UseWebSocketOptions = {}) {
  const {
    onMessage, onSignal, onMT5, onAttendance,
    onNotification, onDashboardStats, onCompliance,
    enabled = true,
  } = options;

  const wsRef        = useRef<WebSocket | null>(null);
  const retryRef     = useRef<ReturnType<typeof setTimeout> | null>(null);
  const retryCount   = useRef(0);
  const mountedRef   = useRef(true);
  const pingRef      = useRef<ReturnType<typeof setInterval> | null>(null);

  const connect = useCallback(() => {
    if (!mountedRef.current || !enabled) return;
    const token = getAccessToken();
    if (!token) return;

    const url = `${WS_URL}?token=${encodeURIComponent(token)}`;
    const ws = new WebSocket(url);
    wsRef.current = ws;

    ws.onopen = () => {
      retryCount.current = 0;
      // Ping every 25s to keep alive
      pingRef.current = setInterval(() => {
        if (ws.readyState === WebSocket.OPEN) {
          ws.send(JSON.stringify({ type: "ping" }));
        }
      }, 25000);
    };

    ws.onmessage = (event) => {
      if (!mountedRef.current) return;
      try {
        const msg = JSON.parse(event.data as string) as WSMessage;
        onMessage?.(msg);
        switch (msg.type) {
          case "signal_update":     onSignal?.(msg.data); break;
          case "mt5_update":        onMT5?.(msg.data); break;
          case "attendance_update": onAttendance?.(msg.data); break;
          case "notification":      onNotification?.(msg.data); break;
          case "dashboard_stats":   onDashboardStats?.(msg.data); break;
          case "compliance_update": onCompliance?.(msg.data); break;
        }
      } catch { /* ignore malformed */ }
    };

    ws.onerror = () => { /* handled by onclose */ };

    ws.onclose = () => {
      if (pingRef.current) clearInterval(pingRef.current);
      if (!mountedRef.current) return;
      // Exponential backoff: 1s, 2s, 4s, 8s, max 30s
      const delay = Math.min(1000 * 2 ** retryCount.current, 30000);
      retryCount.current += 1;
      retryRef.current = setTimeout(connect, delay);
    };
  }, [enabled, onMessage, onSignal, onMT5, onAttendance, onNotification, onDashboardStats, onCompliance]);

  useEffect(() => {
    mountedRef.current = true;
    if (enabled) connect();
    return () => {
      mountedRef.current = false;
      if (retryRef.current) clearTimeout(retryRef.current);
      if (pingRef.current) clearInterval(pingRef.current);
      wsRef.current?.close();
    };
  }, [connect, enabled]);

  const send = useCallback((data: object) => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify(data));
    }
  }, []);

  return { send };
}
