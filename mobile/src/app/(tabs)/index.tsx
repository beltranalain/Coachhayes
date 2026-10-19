// HOME — the landing screen (matches the mock): the film-first hero, a live-show
// status card, and the top of the chip-graded board.

import React, { useEffect, useState } from "react";
import { View, Text, StyleSheet, ScrollView, Pressable, Linking } from "react-native";
import { useRouter } from "expo-router";

import { colors, fonts } from "../../lib/theme";
import {
  fetchPlayers, fetchStreamStatus, fetchSiteConfig, upcoming, formatWhen, countdownLabel,
  youtubeId, type RankPlayer, type ScheduleItem,
} from "../../lib/api";
import { Eyebrow } from "../../components/ui";
import { PlayerCard, VideoModal, evalHref } from "../../components/PlayerCard";

export default function HomeScreen() {
  const router = useRouter();
  const [players, setPlayers] = useState<RankPlayer[]>([]);
  const [live, setLive] = useState(false);
  const [next, setNext] = useState<ScheduleItem | null>(null);
  const [playing, setPlaying] = useState<{ id: string; name: string } | null>(null);

  useEffect(() => {
    let alive = true;
    (async () => {
      try { const d = await fetchPlayers(); if (alive) setPlayers((d.players || []).slice(0, 3)); } catch {}
      try { const s = await fetchStreamStatus(); if (alive) setLive(Boolean(s.live)); } catch {}
      try { const cfg = await fetchSiteConfig(); if (alive) setNext(upcoming(cfg.schedule || [])[0] ?? null); } catch {}
    })();
    return () => { alive = false; };
  }, []);

  function openVideo(p: RankPlayer) {
    const id = youtubeId(p.videoUrl);
    if (id) setPlaying({ id, name: p.name });
    else if (p.videoUrl) Linking.openURL(p.videoUrl).catch(() => {});
  }

  return (
    <>
      <ScrollView contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: 30 }}>
        <View style={{ paddingTop: 14 }}>
          <Eyebrow>Film-first recruiting</Eyebrow>
          <Text style={styles.hero}>Four chips.{"\n"}One grade.{"\n"}Earned on film.</Text>
          <Text style={styles.dek}>Every recruit graded on tape by Coach Hayes. No stars, no camp buzz, no offer counting.</Text>
          <View style={styles.ctaRow}>
            <Pressable onPress={() => router.push("/rankings" as never)} style={({ pressed }) => [styles.primary, pressed && { opacity: 0.9 }]}>
              <Text style={styles.primaryText}>View the rankings</Text>
            </Pressable>
            <Pressable onPress={() => router.push("/rankings" as never)}><Text style={styles.link}>How it works ›</Text></Pressable>
          </View>
        </View>

        {/* Live-show status */}
        <Pressable onPress={() => router.push("/live" as never)} style={styles.liveCard}>
          <View style={[styles.liveDotWrap, live && { backgroundColor: "rgba(255,69,58,0.16)" }]}>
            <View style={[styles.liveDot, { backgroundColor: live ? colors.live : colors.dim }]} />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={styles.liveTitle}>{next?.title || "The Live Show"}</Text>
            <Text style={styles.liveSub}>
              {live ? "On air now — tap to watch" : next ? `Off air · ${formatWhen(next)} · ${countdownLabel(next.startsAt)}` : "Off air · check back soon"}
            </Text>
          </View>
          <Text style={styles.liveGo}>{live ? "Watch" : "Live"}</Text>
        </Pressable>

        {/* Top of the board */}
        <View style={styles.sectionHead}>
          <Eyebrow>Top of the board</Eyebrow>
          <Pressable onPress={() => router.push("/rankings" as never)}><Text style={styles.seeAll}>See all ›</Text></Pressable>
        </View>
        {players.map((p, i) => (
          <PlayerCard key={p.slug} player={p} rank={i + 1} onPlay={() => openVideo(p)} onEval={() => router.push(evalHref(p) as never)} />
        ))}
        {players.length === 0 && <Text style={styles.empty}>The board is opening soon.</Text>}
      </ScrollView>
      <VideoModal playing={playing} onClose={() => setPlaying(null)} />
    </>
  );
}

const styles = StyleSheet.create({
  hero: { fontFamily: fonts.display, fontSize: 38, lineHeight: 41, color: colors.cream, letterSpacing: -1.2, marginTop: 10 },
  dek: { fontFamily: fonts.body, fontSize: 14, lineHeight: 21, color: colors.muted, marginTop: 14 },
  ctaRow: { flexDirection: "row", alignItems: "center", gap: 14, marginTop: 18 },
  primary: { backgroundColor: colors.amber, borderRadius: 999, paddingVertical: 12, paddingHorizontal: 20 },
  primaryText: { fontFamily: fonts.bold, fontSize: 14, color: "#171204" },
  link: { fontFamily: fonts.semibold, fontSize: 13.5, color: colors.amber },

  liveCard: { flexDirection: "row", alignItems: "center", gap: 13, backgroundColor: colors.surface, borderColor: colors.line, borderWidth: 1, borderRadius: 18, padding: 14, marginTop: 22, marginBottom: 6 },
  liveDotWrap: { width: 44, height: 44, borderRadius: 12, alignItems: "center", justifyContent: "center", backgroundColor: colors.surface2 },
  liveDot: { width: 11, height: 11, borderRadius: 6 },
  liveTitle: { fontFamily: fonts.bold, fontSize: 14.5, color: colors.cream },
  liveSub: { fontFamily: fonts.body, fontSize: 12, color: colors.muted, marginTop: 3 },
  liveGo: { fontFamily: fonts.bold, fontSize: 12.5, color: colors.amber },

  sectionHead: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginTop: 20, marginBottom: 12 },
  seeAll: { fontFamily: fonts.semibold, fontSize: 12.5, color: colors.amber },
  empty: { fontFamily: fonts.body, color: colors.muted, fontSize: 13.5, textAlign: "center", paddingVertical: 20 },
});
