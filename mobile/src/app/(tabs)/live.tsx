// LIVE — the watch screen. Plays the Cloudflare Stream embed when on air;
// otherwise shows the off-air well + the upcoming schedule (matches the mock).

import React, { useEffect, useState } from "react";
import { View, Text, StyleSheet, ScrollView, ActivityIndicator } from "react-native";
import { Image } from "expo-image";
import { WebView } from "react-native-webview";

import { colors, fonts, type ThemeColors } from "../../lib/theme";
import { useColors, useThemedStyles } from "../../lib/ThemeContext";
import { STREAM_IFRAME_URL, API_BASE } from "../../lib/config";
import { fetchLiveStatus, fetchSiteConfig, upcoming, formatWhen, countdownLabel, type LiveStatus, type ScheduleItem } from "../../lib/api";
import { useBranding } from "../../lib/branding";
import { Eyebrow } from "../../components/ui";

// Serve the embed from the SITE's origin (the same origin that successfully plays
// it on the website). Embedding from youtube.com's own origin trips Error 152 on
// some live streams; using the allowed site origin fixes it.
const EMBED_ORIGIN = (API_BASE || "https://coachhayes.vercel.app").replace(/\/$/, "");
function ytLiveHtml(id: string): string {
  return `<!doctype html><html><head>
  <meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=1">
  <style>html,body{margin:0;padding:0;background:#000;height:100%;overflow:hidden}
  .wrap{position:absolute;inset:0}iframe{width:100%;height:100%;border:0;display:block}</style></head>
  <body><div class="wrap">
    <iframe src="https://www.youtube.com/embed/${id}?autoplay=1&playsinline=1&rel=0&modestbranding=1&origin=${EMBED_ORIGIN}"
      allow="autoplay; encrypted-media; picture-in-picture; fullscreen" allowfullscreen></iframe>
  </div></body></html>`;
}

export default function LiveScreen() {
  const colors = useColors();
  const styles = useThemedStyles(makeStyles);
  const branding = useBranding();
  const [status, setStatus] = useState<LiveStatus | null>(null);
  const [checked, setChecked] = useState(false);
  const [sched, setSched] = useState<ScheduleItem[]>([]);

  useEffect(() => {
    let alive = true;
    async function poll() {
      try { const s = await fetchLiveStatus(); if (alive) setStatus(s); }
      catch {} finally { if (alive) setChecked(true); }
    }
    poll();
    const id = setInterval(poll, 10000);
    (async () => { try { const cfg = await fetchSiteConfig(); if (alive) setSched(upcoming(cfg.schedule || [])); } catch {} })();
    return () => { alive = false; clearInterval(id); };
  }, []);

  const ytLive = status?.source === "youtube" && status.videoId;
  const cfLive = status?.source === "cloudflare";

  return (
    <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: 30 }}>
      {ytLive || cfLive ? (
        <View style={styles.player}>
          <WebView
            source={ytLive ? { html: ytLiveHtml(status!.videoId!), baseUrl: EMBED_ORIGIN } : { uri: STREAM_IFRAME_URL }}
            style={{ flex: 1, backgroundColor: "#000" }}
            originWhitelist={["*"]}
            allowsInlineMediaPlayback mediaPlaybackRequiresUserAction={false} javaScriptEnabled domStorageEnabled allowsFullscreenVideo scrollEnabled={false}
          />
          <View style={styles.liveBadge}><View style={styles.liveBadgeDot} /><Text style={styles.liveBadgeText}>LIVE</Text></View>
        </View>
      ) : (
        <View style={styles.well}>
          {branding.logo ? (
            <Image source={{ uri: branding.logo }} style={styles.markLogo} contentFit="contain" />
          ) : (
            <View style={styles.mark}><Text style={styles.markText}>CH</Text></View>
          )}
          <View style={styles.offPill}><Text style={styles.offPillText}>Off air</Text></View>
          <Text style={styles.offLine}>The show appears here the moment it goes live.</Text>
          {!checked && <ActivityIndicator color={colors.amber} style={{ marginTop: 6 }} />}
        </View>
      )}

      <View style={{ marginTop: 20 }}>
        <Eyebrow>Up next</Eyebrow>
        <View style={{ marginTop: 12, gap: 11 }}>
          {sched.length === 0 ? (
            <Text style={styles.empty}>No upcoming broadcasts scheduled yet.</Text>
          ) : (
            sched.slice(0, 6).map((s, i) => (
              <View key={i} style={styles.schedRow}>
                <View style={styles.schedDate}><Text style={styles.schedDateText}>{dayAbbr(s)}</Text></View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.schedTitle}>{s.title}</Text>
                  <Text style={styles.schedWhen}>{formatWhen(s)} · {countdownLabel(s.startsAt)}</Text>
                </View>
              </View>
            ))
          )}
        </View>
      </View>
    </ScrollView>
  );
}

function dayAbbr(s: ScheduleItem): string {
  if (s.startsAt) { try { return new Date(s.startsAt).toLocaleDateString(undefined, { weekday: "short" }); } catch {} }
  return (s.when || "·").slice(0, 3);
}

const makeStyles = (colors: ThemeColors) => StyleSheet.create({
  player: { aspectRatio: 16 / 9, borderRadius: 18, overflow: "hidden", backgroundColor: "#000", borderWidth: 1, borderColor: colors.line },
  liveBadge: { position: "absolute", top: 10, left: 10, flexDirection: "row", alignItems: "center", gap: 5, backgroundColor: "rgba(255,69,58,0.92)", borderRadius: 6, paddingVertical: 3, paddingHorizontal: 8 },
  liveBadgeDot: { width: 6, height: 6, borderRadius: 3, backgroundColor: "#fff" },
  liveBadgeText: { fontFamily: fonts.bold, color: "#fff", fontSize: 9, letterSpacing: 1.4 },

  well: { aspectRatio: 9 / 10, borderRadius: 20, borderWidth: 1, borderColor: colors.line, backgroundColor: colors.surface, alignItems: "center", justifyContent: "center", gap: 12, padding: 24 },
  mark: { width: 72, height: 72, borderRadius: 36, borderWidth: 2, borderColor: colors.amber, alignItems: "center", justifyContent: "center", backgroundColor: "#15120f" },
  markText: { fontFamily: fonts.display, fontSize: 24, color: colors.amber },
  markLogo: { width: 84, height: 84, borderRadius: 42 },
  offPill: { borderWidth: 1, borderColor: colors.line, borderRadius: 999, paddingVertical: 4, paddingHorizontal: 14 },
  offPillText: { fontFamily: fonts.semibold, fontSize: 11, color: colors.muted },
  offLine: { fontFamily: fonts.semibold, fontSize: 14, color: colors.cream, textAlign: "center", maxWidth: 240 },

  empty: { fontFamily: fonts.body, fontSize: 13, color: colors.muted },
  schedRow: { flexDirection: "row", alignItems: "center", gap: 11, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.line, borderRadius: 16, padding: 14 },
  schedDate: { width: 42, height: 42, borderRadius: 11, backgroundColor: colors.surface2, alignItems: "center", justifyContent: "center" },
  schedDateText: { fontFamily: fonts.semibold, fontSize: 12, color: colors.amber },
  schedTitle: { fontFamily: fonts.bold, fontSize: 13.5, color: colors.cream },
  schedWhen: { fontFamily: fonts.body, fontSize: 12, color: colors.muted, marginTop: 2 },
});
