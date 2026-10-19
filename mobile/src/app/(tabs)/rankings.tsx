// RANKINGS — the chip-graded board, matching the website. Each player is a card
// with a playable highlight thumbnail, chip dots, the chip label + commit, and a
// Read / Unlock button that opens the Honest Evaluation (free report or paywall).

import React, { useEffect, useMemo, useState } from "react";
import {
  View, Text, StyleSheet, FlatList, Pressable, ActivityIndicator, Modal, Linking, useWindowDimensions,
} from "react-native";
import { Image } from "expo-image";
import { WebView } from "react-native-webview";
import { useRouter } from "expo-router";

import { colors, fonts, radii, chipColors } from "../../lib/theme";
import { fetchPlayers, youtubeId, type RankPlayer } from "../../lib/api";
import { ArtWell, Eyebrow } from "../../components/ui";

const CAT_ORDER = ["power", "speed", "motor", "technique", "iq"] as const;

function chipsFor(p: RankPlayer): string[] {
  const base = p.chip;
  return CAT_ORDER.map((k) => (p.categories && p.categories[k]) || base);
}

export default function RankingsScreen() {
  const router = useRouter();
  const [players, setPlayers] = useState<RankPlayer[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [playing, setPlaying] = useState<{ id: string; name: string } | null>(null);

  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const d = await fetchPlayers();
        if (alive) setPlayers(d.players || []);
      } catch {
        if (alive) setError(true);
      } finally {
        if (alive) setLoading(false);
      }
    })();
    return () => { alive = false; };
  }, []);

  function openVideo(p: RankPlayer) {
    const id = youtubeId(p.videoUrl);
    if (id) setPlaying({ id, name: p.name });
    else if (p.videoUrl) Linking.openURL(p.videoUrl).catch(() => {});
  }

  function openEval(p: RankPlayer) {
    router.push(
      `/evaluation/${p.slug}?name=${encodeURIComponent(p.name)}&meta=${encodeURIComponent(
        [p.position, p.city || p.school, p.classYear].filter(Boolean).join(" · ")
      )}&access=${p.evalAccess}&price=${encodeURIComponent(p.evalPrice || "")}` as never
    );
  }

  const header = (
    <View style={styles.head}>
      <Eyebrow>Coach Hayes · Player Rankings</Eyebrow>
      <Text style={styles.h1}>Four chips. One grade.</Text>
      <View style={styles.statRow}>
        <View><Text style={styles.statN}>{players.length}</Text><Text style={styles.statL}>Players graded</Text></View>
        <View><Text style={styles.statN}>4</Text><Text style={styles.statL}>Chip tiers</Text></View>
      </View>
    </View>
  );

  if (loading) {
    return <View style={styles.center}><ActivityIndicator color={colors.amber} /><Text style={styles.dim}>Loading the board…</Text></View>;
  }

  return (
    <>
      <FlatList
        data={players}
        keyExtractor={(p) => p.slug}
        ListHeaderComponent={header}
        contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: 28 }}
        renderItem={({ item, index }) => (
          <PlayerCard player={item} rank={index + 1} onPlay={() => openVideo(item)} onEval={() => openEval(item)} />
        )}
        ListEmptyComponent={
          <Text style={styles.empty}>
            {error ? "Couldn't reach the board. Check your connection." : "The board is opening soon."}
          </Text>
        }
      />
      <VideoModal playing={playing} onClose={() => setPlaying(null)} />
    </>
  );
}

function PlayerCard({ player, rank, onPlay, onEval }: { player: RankPlayer; rank: number; onPlay: () => void; onEval: () => void }) {
  const id = youtubeId(player.videoUrl);
  const thumb = id ? `https://i.ytimg.com/vi/${id}/hqdefault.jpg` : null;
  const dots = chipsFor(player);
  const locked = player.evalAccess === "locked";

  return (
    <View style={styles.card}>
      <Pressable onPress={onPlay} style={styles.thumbWrap}>
        {thumb ? (
          <Image source={{ uri: thumb }} style={StyleSheet.absoluteFill} contentFit="cover" transition={150} />
        ) : (
          <ArtWell well="amber" radius={12} style={StyleSheet.absoluteFill} />
        )}
        <View style={styles.thumbShade} />
        <Text style={styles.rankTag}>No. {rank}</Text>
        {player.videoUrl ? (
          <View style={styles.playBtn}><PlayTriangle /></View>
        ) : null}
      </Pressable>

      <View style={styles.headRow}>
        <View style={{ flex: 1, minWidth: 0 }}>
          <Text style={styles.name}>{player.name}</Text>
          <Text style={styles.meta}>{[player.position, player.city || player.school, player.classYear].filter(Boolean).join(" · ")}</Text>
        </View>
        {player.commitLogo ? (
          <Image source={{ uri: player.commitLogo }} style={styles.commit} contentFit="contain" />
        ) : null}
      </View>

      <View style={styles.footRow}>
        <View style={styles.lhs}>
          <View style={styles.dots}>
            {dots.map((c, i) => <View key={i} style={[styles.dot, { backgroundColor: chipColors[c] || colors.dim }]} />)}
          </View>
          <Text style={styles.chipLabel}>{player.chipLabel}</Text>
        </View>
        {player.hasEval ? (
          <Pressable onPress={onEval} style={({ pressed }) => [styles.evBtn, locked && styles.evBtnLock, pressed && { opacity: 0.8 }]}>
            {locked && <LockGlyph />}
            <Text style={[styles.evBtnText, locked && { color: colors.cream }]}>{locked ? "Unlock" : "Read ›"}</Text>
          </Pressable>
        ) : (
          <View style={{ width: 4 }} />
        )}
      </View>
    </View>
  );
}

function VideoModal({ playing, onClose }: { playing: { id: string; name: string } | null; onClose: () => void }) {
  const { width } = useWindowDimensions();
  if (!playing) return null;
  return (
    <Modal visible transparent animationType="fade" onRequestClose={onClose}>
      <Pressable style={styles.vScrim} onPress={onClose}>
        <Pressable style={{ width: "100%" }} onPress={() => {}}>
          <View style={[styles.vBox, { height: (Math.min(width, 520) - 40) * 9 / 16 }]}>
            <WebView
              source={{ uri: `https://www.youtube.com/embed/${playing.id}?autoplay=1&playsinline=1&rel=0` }}
              style={{ flex: 1, backgroundColor: "#000" }}
              allowsInlineMediaPlayback
              mediaPlaybackRequiresUserAction={false}
              javaScriptEnabled
              allowsFullscreenVideo
              scrollEnabled={false}
            />
          </View>
          <Text style={styles.vName}>Highlight film · {playing.name}</Text>
          <Pressable onPress={onClose} style={styles.vClose}><Text style={styles.vCloseText}>Close</Text></Pressable>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

function PlayTriangle() {
  return (
    <View style={{ width: 0, height: 0, marginLeft: 3, borderTopWidth: 8, borderBottomWidth: 8, borderLeftWidth: 13,
      borderTopColor: "transparent", borderBottomColor: "transparent", borderLeftColor: "#fff" }} />
  );
}
function LockGlyph() {
  return (
    <View style={{ width: 11, height: 12, alignItems: "center", justifyContent: "flex-end", marginRight: 1 }}>
      <View style={{ width: 11, height: 7, borderRadius: 2, backgroundColor: colors.cream }} />
      <View style={{ position: "absolute", top: 0, width: 7, height: 7, borderTopLeftRadius: 4, borderTopRightRadius: 4, borderWidth: 1.4, borderBottomWidth: 0, borderColor: colors.cream }} />
    </View>
  );
}

const styles = StyleSheet.create({
  center: { flex: 1, alignItems: "center", justifyContent: "center", gap: 10, backgroundColor: colors.bg },
  dim: { fontFamily: fonts.body, color: colors.muted, fontSize: 12.5 },
  empty: { fontFamily: fonts.body, color: colors.muted, fontSize: 13.5, textAlign: "center", paddingHorizontal: 24, paddingVertical: 40 },

  head: { paddingTop: 12, paddingBottom: 6 },
  h1: { fontFamily: fonts.display, fontSize: 30, color: colors.cream, textTransform: "uppercase", marginTop: 8, lineHeight: 32 },
  statRow: { flexDirection: "row", gap: 26, marginTop: 16, marginBottom: 6 },
  statN: { fontFamily: fonts.display, fontSize: 30, color: colors.cream, lineHeight: 30 },
  statL: { fontFamily: fonts.body, fontSize: 12, color: colors.muted, marginTop: 4 },

  card: { backgroundColor: colors.surface, borderColor: colors.line, borderWidth: 1, borderRadius: 18, padding: 11, marginBottom: 12 },
  thumbWrap: { aspectRatio: 16 / 9, borderRadius: 12, overflow: "hidden", alignItems: "center", justifyContent: "center", backgroundColor: "#0b0a09" },
  thumbShade: { position: "absolute", top: 0, left: 0, right: 0, bottom: 0, backgroundColor: "rgba(0,0,0,0.12)" },
  rankTag: { position: "absolute", bottom: 7, right: 11, fontFamily: fonts.bold, fontSize: 12, color: "#fff", opacity: 0.92, textShadowColor: "rgba(0,0,0,0.6)", textShadowRadius: 4 },
  playBtn: { width: 48, height: 34, borderRadius: 9, alignItems: "center", justifyContent: "center", backgroundColor: "#e21f1f" },

  headRow: { flexDirection: "row", alignItems: "center", gap: 11, marginTop: 11 },
  name: { fontFamily: fonts.bold, fontSize: 15, color: colors.cream },
  meta: { fontFamily: fonts.body, fontSize: 11.5, color: colors.muted, marginTop: 2 },
  commit: { width: 28, height: 28 },

  footRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 10, marginTop: 11 },
  lhs: { flexDirection: "row", alignItems: "center", gap: 9, flexShrink: 1 },
  dots: { flexDirection: "row", gap: 4 },
  dot: { width: 14, height: 14, borderRadius: 7 },
  chipLabel: { fontFamily: fonts.semibold, fontSize: 12.5, color: colors.cream },

  evBtn: { flexDirection: "row", alignItems: "center", gap: 5, backgroundColor: "rgba(200,169,107,0.14)", borderColor: "rgba(200,169,107,0.4)", borderWidth: 1, borderRadius: 999, paddingVertical: 6, paddingHorizontal: 13 },
  evBtnLock: { backgroundColor: colors.surface2, borderColor: colors.line },
  evBtnText: { fontFamily: fonts.bold, fontSize: 12, color: colors.amber },

  vScrim: { flex: 1, backgroundColor: "rgba(0,0,0,0.9)", alignItems: "center", justifyContent: "center", padding: 20 },
  vBox: { width: "100%", borderRadius: 14, overflow: "hidden", backgroundColor: "#000" },
  vName: { fontFamily: fonts.semibold, fontSize: 13, color: "#fff", textAlign: "center", marginTop: 14 },
  vClose: { alignSelf: "center", marginTop: 14, borderWidth: 1, borderColor: "rgba(255,255,255,0.25)", borderRadius: 999, paddingVertical: 8, paddingHorizontal: 22 },
  vCloseText: { fontFamily: fonts.semibold, fontSize: 13, color: "#fff" },
});
