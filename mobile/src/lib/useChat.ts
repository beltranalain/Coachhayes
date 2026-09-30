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

import { useEffect, useRef, useState, useCallback } from "react";
import { CHAT_ROOM_WS } from "./config";

export type ChatMessage = {
  id: string;
  name: string;
  text: string;
  ts: number;
  tip?: number;
};

export function useChat() {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [count, setCount] = useState<number | null>(null);
  const [connected, setConnected] = useState(false);
  const wsRef = useRef<WebSocket | null>(null);
  const retryRef = useRef<ReturnType<typeof setTimeout> | null>(null);

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
          setMessages(data.messages);
        } else if (data.type === "chat") {
          setMessages((prev) => [...prev.slice(-199), data]);
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

  const send = useCallback((name: string, text: string, uid: string) => {
    const t = text.trim();
    const ws = wsRef.current;
    if (!t || !ws || ws.readyState !== WebSocket.OPEN) return false;
    ws.send(JSON.stringify({ type: "chat", name, text: t, uid }));
    return true;
  }, []);

  return { messages, count, connected, send };
}
