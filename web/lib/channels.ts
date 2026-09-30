// YouTube channel identifiers. Edit the defaults in lib/brand.ts (CHANNELS),
// or manage them at runtime in the admin (Content -> Connected YouTube channels).
// uploadsPlaylist = channel ID with the "UC" prefix swapped for "UU".

import { CHANNELS as BRAND_CHANNELS } from "./brand";

export type Channel = {
  key: string;
  name: string;
  handle: string;
  url: string;
  channelId: string;
  uploadsPlaylist: string;
};

function uploads(channelId: string): string {
  return /^UC/.test(channelId) ? "UU" + channelId.slice(2) : "";
}

// Build a full Channel from minimal fields (name, handle, channelId). The
// uploads playlist + watch URL + key are derived so the rest of the app works
// with a complete Channel object. Used by both the brand defaults and the
// admin-managed channel list.
export function makeChannel(input: { name?: string; handle?: string; channelId: string; key?: string }): Channel {
  const channelId = (input.channelId || "").trim();
  let handle = (input.handle || "").trim();
  if (handle && !handle.startsWith("@")) handle = "@" + handle;
  return {
    key: input.key || channelId || handle || "channel",
    name: (input.name || handle || "Channel").trim(),
    handle,
    url: handle ? `https://www.youtube.com/${handle}` : (channelId ? `https://www.youtube.com/channel/${channelId}` : "https://www.youtube.com"),
    channelId,
    uploadsPlaylist: uploads(channelId),
  };
}

// Default channels come from lib/brand.ts (neutral until the buyer fills them in).
export const CHANNELS: Channel[] = BRAND_CHANNELS.map((c) => makeChannel(c));

// The channel whose live stream anchors the public Live page.
export const PRIMARY_CHANNEL = CHANNELS[0];

export function channelByKey(key: string): Channel | undefined {
  return CHANNELS.find((c) => c.key === key);
}
