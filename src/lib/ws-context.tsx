/**
 * WebSocket Context — single WS connection shared across the entire app.
 * Components subscribe via useWSEvent() hook.
 */

import { createContext, useContext, useEffect, useRef, useState, type ReactNode, useCallback } from "react";
import { getAccessToken, refreshAccessToken, useAuth } from "@/lib/auth";
import type { WSMessage, WSMessageType } from "@/hooks/use-websocket";

// Compute WebSocket URL dynamically so it works in both dev and production.
// In production (behind Nginx), the WS connection goes through port 80/443.
// In local dev, connect directly to Daphne on port 8000.
function getWSUrl(): string {
  if (typeof window === "undefined") return "ws://localhost:8000/ws/live/";
  const host = window.location.hostname;
  const isLocal = host === "localhost" || host === "127.0.0.1";
  const proto = window.location.protocol === "https:" ? "wss:" : "ws:";
  const port = isLocal ? ":8000" : "";
  return `${proto}//${host}${port}/ws/live/`;
}
const WS_URL = getWSUrl();

type Listener = (data: unknown) => void;

interface WSContextValue {
  status: "connecting" | "connected" | "disconnected";
  subscribe: (type: WSMessageType, cb: Listener) => () => void;
}

const WSContext = createContext<WSContextValue | null>(null);

export function WSProvider({ children }: { children: ReactNode }) {
  const [status, setStatus] = useState<WSContextValue["status"]>("disconnected");
  const listenersRef = useRef<Map<WSMessageType, Set<Listener>>>(new Map());
  const wsRef        = useRef<WebSocket | null>(null);
  const retryRef     = useRef<ReturnType<typeof setTimeout> | null>(null);
  const retryCount   = useRef(0);
  const mountedRef   = useRef(true);
  const { logout }   = useAuth();

  const dispatch = useCallback((msg: WSMessage) => {
    const set = listenersRef.current.get(msg.type);
    if (set) set.forEach((cb) => cb(msg.data ?? msg));
  }, []);

  const connect = useCallback(async () => {
    if (!mountedRef.current) return;
    let token = getAccessToken();
    if (!token) {
      const refreshed = await refreshAccessToken();
      if (refreshed) token = getAccessToken();
    }

    if (!token) {
      // Wait for token (user might not be logged in yet)
      retryRef.current = setTimeout(() => void connect(), 2000);
      return;
    }

    setStatus("connecting");
    const ws = new WebSocket(`${WS_URL}?token=${encodeURIComponent(token)}`);
    wsRef.current = ws;

    ws.onopen = () => {
      if (!mountedRef.current) return;
      setStatus("connected");
      retryCount.current = 0;
    };

    ws.onmessage = (event) => {
      if (!mountedRef.current) return;
      try {
        dispatch(JSON.parse(event.data as string) as WSMessage);
      } catch { /* ignore */ }
    };

    ws.onclose = async (event) => {
      if (!mountedRef.current) return;
      setStatus("disconnected");

      if (event?.code === 4001) {
        const refreshed = await refreshAccessToken();
        if (refreshed) {
          retryCount.current = 0;
          retryRef.current = setTimeout(() => void connect(), 1000);
          return;
        }

        await logout();
        return;
      }

      const delay = Math.min(1000 * 2 ** retryCount.current, 30000);
      retryCount.current += 1;
      retryRef.current = setTimeout(() => void connect(), delay);
    };

    ws.onerror = () => { ws.close(); };

    // Keep-alive ping
    const ping = setInterval(() => {
      if (ws.readyState === WebSocket.OPEN) ws.send('{"type":"ping"}');
    }, 25000);

    const origClose = ws.onclose;
    ws.addEventListener('close', () => clearInterval(ping));
  }, [dispatch]);

  useEffect(() => {
    mountedRef.current = true;
    connect();
    return () => {
      mountedRef.current = false;
      if (retryRef.current) clearTimeout(retryRef.current);
      wsRef.current?.close();
    };
  }, [connect]);

  const subscribe = useCallback((type: WSMessageType, cb: Listener) => {
    if (!listenersRef.current.has(type)) {
      listenersRef.current.set(type, new Set());
    }
    listenersRef.current.get(type)!.add(cb);
    return () => listenersRef.current.get(type)?.delete(cb);
  }, []);

  return (
    <WSContext.Provider value={{ status, subscribe }}>
      {children}
    </WSContext.Provider>
  );
}

export function useWSContext() {
  const ctx = useContext(WSContext);
  if (!ctx) throw new Error("useWSContext must be used within WSProvider");
  return ctx;
}

/** Subscribe to a specific WebSocket event type */
export function useWSEvent<T = unknown>(type: WSMessageType, handler: (data: T) => void) {
  const { subscribe } = useWSContext();
  useEffect(() => {
    return subscribe(type, handler as Listener);
  }, [type, handler, subscribe]);
}

/** Get current WebSocket connection status */
export function useWSStatus() {
  return useWSContext().status;
}
