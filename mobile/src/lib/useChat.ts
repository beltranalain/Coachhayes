// Live chat over the SAME Cloudflare Worker Durable Object the website uses.
// Message protocol (see worker/src/index.ts):
//   incoming: { type:"history", messages:[...] }
//             { type:"chat", id, name, text, uid, tip?, ts }
//             { type:"count", count }
//             { type:"tip", id, name, amount, message, ts }   (alert; the chat
//                          message itself already arrives as a "chat" with tip)
//             { type:"muted"/"moderation", ... }
//   outgoing: { type:"chat", name, text, uid }
//
// A "tip" chat message is a normal chat entry with a numeric `tip` field, which
// we render as an amber pill (matching the site's LiveChat).

import { useEffect, useMemo, useRef, useState, useCallback } from "react";
import { CHAT_ROOM_WS, API_BASE } from "./config";

export type ChatMessage = {
  id: string;
  name: string;
  text: string;
  ts: number;
  tip?: number;
  source?: "site" | "youtube";
};

export function useChat() {
  const [siteMessages, setSiteMessages] = useState<ChatMessage[]>([]);
  const [ytMessages, setYtMessages] = useState<ChatMessage[]>([]);
  const [count, setCount] = useState<number | null>(null);
  const [connected, setConnected] = useState(false);
  const wsRef = useRef<WebSocket | null>(null);
  const retryRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Site chat over the shared Durable Object WebSocket.
  useEffect(() => {
    let unmounted = false;

    function connect() {
      const ws = new WebSocket(CHAT_ROOM_WS);
      wsRef.current = ws;
      ws.onopen = () => setConnected(true);
      ws.onclose = () => {
        setConnected(false);
        if (!unmounted) retryRef.current = setTimeout(connect, 2500);
      };
      ws.onerror = () => ws.close();
      ws.onmessage = (event) => {
        let data: any;
        try {
          data = JSON.parse(event.data as string);
        } catch {
          return;
        }
        if (data.type === "history" && Array.isArray(data.messages)) {
          setSiteMessages(data.messages);
        } else if (data.type === "chat") {
          setSiteMessages((prev) => [...prev.slice(-199), data]);
        } else if (data.type === "count") {
          setCount(data.count);
        }
        // "tip" alert events are already reflected by the paired "chat" message,
        // and moderation/muted events are host-facing; we ignore them here.
      };
    }

    connect();
    return () => {
      unmounted = true;
      if (retryRef.current) clearTimeout(retryRef.current);
      wsRef.current?.close();
    };
  }, []);

  // Read-only mirror of the coach's YouTube live chat (server-cached endpoint).
  useEffect(() => {
    let stop = false;
    const poll = async () => {
      try {
        const r = await fetch(`${API_BASE}/api/live/chat`);
        const d = await r.json();
        if (!stop && Array.isArray(d.messages)) {
          setYtMessages(d.messages.map((m: any) => ({ id: `yt_${m.id}`, name: m.name, text: m.text, ts: m.ts, source: "youtube" as const })));
        }
      } catch { /* keep last */ }
    };
    poll();
    const id = setInterval(poll, 6000);
    return () => { stop = true; clearInterval(id); };
  }, []);

  // Site + YouTube, interleaved by time.
  const messages = useMemo(
    () => [...siteMessages.map((m) => ({ ...m, source: m.source || ("site" as const) })), ...ytMessages].sort((a, b) => a.ts - b.ts),
    [siteMessages, ytMessages]
  );

  const send = useCallback((name: string, text: string, uid: string) => {
    const t = text.trim();
    const ws = wsRef.current;
    if (!t || !ws || ws.readyState !== WebSocket.OPEN) return false;
    ws.send(JSON.stringify({ type: "chat", name, text: t, uid }));
    return true;
  }, []);

  return { messages, count, connected, send };
}
