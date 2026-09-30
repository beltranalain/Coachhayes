// Anonymous Twitch chat reader (browser). Connects to Twitch IRC over WebSocket
// as a read-only "justinfan" guest - no auth, no token - and emits each chat
// message. Used by the Studio to merge Twitch chat into the site chat.

export type TwitchMsg = { id: string; name: string; text: string };

// Parse one IRC line into a chat message, or null if it isn't a PRIVMSG.
function parsePrivmsg(line: string): TwitchMsg | null {
  let rest = line;
  const tags: Record<string, string> = {};
  if (rest[0] === "@") {
    const sp = rest.indexOf(" ");
    const tagStr = rest.slice(1, sp);
    rest = rest.slice(sp + 1);
    for (const kv of tagStr.split(";")) {
      const i = kv.indexOf("=");
      if (i > 0) tags[kv.slice(0, i)] = kv.slice(i + 1);
    }
  }
  if (rest[0] === ":") rest = rest.slice(rest.indexOf(" ") + 1); // drop the :prefix
  if (!rest.startsWith("PRIVMSG")) return null;
  const msgIdx = rest.indexOf(" :");
  if (msgIdx < 0) return null;
  const text = rest.slice(msgIdx + 2).replace(/[\r\n]/g, " ").trim();
  if (!text) return null;
  const name = tags["display-name"] || "Twitch";
  const id = tags["id"] || `${name}:${text}`.slice(0, 96);
  return { id, name, text };
}

// Connect and stream messages to onMsg. Returns a disconnect function.
// Auto-reconnects until disconnected.
export function connectTwitchChat(channel: string, onMsg: (m: TwitchMsg) => void): () => void {
  const chan = channel.trim().toLowerCase();
  if (!chan) return () => {};
  let ws: WebSocket | null = null;
  let closed = false;
  let retry: ReturnType<typeof setTimeout> | null = null;
  const nick = "justinfan" + Math.floor(10000 + Math.random() * 89999);

  function open() {
    if (closed) return;
    try {
      ws = new WebSocket("wss://irc-ws.chat.twitch.tv:443");
    } catch {
      retry = setTimeout(open, 4000);
      return;
    }
    ws.onopen = () => {
      ws!.send("CAP REQ :twitch.tv/tags");
      ws!.send("NICK " + nick);
      ws!.send("JOIN #" + chan);
    };
    ws.onmessage = (e) => {
      const raw = typeof e.data === "string" ? e.data : "";
      for (const line of raw.split("\r\n")) {
        if (!line) continue;
        if (line.startsWith("PING")) { try { ws!.send("PONG :tmi.twitch.tv"); } catch {} continue; }
        const m = parsePrivmsg(line);
        if (m) onMsg(m);
      }
    };
    ws.onclose = () => { if (!closed) retry = setTimeout(open, 3000); };
    ws.onerror = () => { try { ws?.close(); } catch {} };
  }
  open();

  return () => {
    closed = true;
    if (retry) clearTimeout(retry);
    try { ws?.close(); } catch {}
  };
}
