// Shared ranking card used by both Home ("top of the board") and the Rankings
// screen: a playable highlight thumbnail, chip dots, chip label + commit, and a
// Read / Unlock button. Plus the fullscreen VideoModal both screens render.

import React from "react";
import { View, Text, StyleSheet, Pressable } from "react-native";
import { Image } from "expo-image";
import { colors, fonts, chipColors } from "../lib/theme";
import { youtubeId, type RankPlayer } from "../lib/api";
import { ArtWell } from "./ui";

// Route to the full-screen highlight player (avoids the WebView-in-Modal bug).
export function watchHref(id: string, name: string): string {
  return `/watch?id=${encodeURIComponent(id)}&name=${encodeURIComponent(name)}`;
}

const CAT_ORDER = ["power", "speed", "motor", "technique", "iq"] as const;

export function chipsFor(p: RankPlayer): string[] {
  const base = p.chip;
  return CAT_ORDER.map((k) => (p.categories && p.categories[k]) || base);
}

export function PlayerCard({ player, rank, onPlay, onEval }: { player: RankPlayer; rank: number; onPlay: () => void; onEval: () => void }) {
  const id = youtubeId(player.videoUrl);
  const thumb = id ? `https://i.ytimg.com/vi/${id}/hqdefault.jpg` : null;
  const dots = chipsFor(player);
  const locked = player.evalAccess === "locked";

  return (
    <View style={styles.card}>
      <Pressable onPress={onPlay} style={styles.thumbWrap}>
        {thumb ? (
          <Image source={{ uri: thumb }} style={styles.fill} contentFit="cover" transition={150} />
        ) : (
          <ArtWell well="amber" radius={12} style={styles.fill} />
        )}
        <View style={styles.thumbShade} />
        <Text style={styles.rankTag}>No. {rank}</Text>
        {player.videoUrl ? <View style={styles.playBtn}><PlayTriangle /></View> : null}
      </Pressable>

      <View style={styles.headRow}>
        <View style={{ flex: 1, minWidth: 0 }}>
          <Text style={styles.name}>{player.name}</Text>
          <Text style={styles.meta}>{[player.position, player.city || player.school, player.classYear].filter(Boolean).join(" · ")}</Text>
        </View>
        {player.commitLogo ? <Image source={{ uri: player.commitLogo }} style={styles.commit} contentFit="contain" /> : null}
      </View>

      <View style={styles.footRow}>
        <View style={styles.lhs}>
          <View style={styles.dots}>{dots.map((c, i) => <View key={i} style={[styles.dot, { backgroundColor: chipColors[c] || colors.dim }]} />)}</View>
          <Text style={styles.chipLabel}>{player.chipLabel}</Text>
        </View>
        {player.hasEval ? (
          <Pressable onPress={onEval} style={({ pressed }) => [styles.evBtn, locked && styles.evBtnLock, pressed && { opacity: 0.8 }]}>
            {locked && <LockGlyph />}
            <Text style={[styles.evBtnText, locked && { color: colors.cream }]}>{locked ? "Unlock" : "Read ›"}</Text>
          </Pressable>
        ) : <View style={{ width: 4 }} />}
      </View>
    </View>
  );
}

export function PlayTriangle() {
  return <View style={{ width: 0, height: 0, marginLeft: 3, borderTopWidth: 8, borderBottomWidth: 8, borderLeftWidth: 13, borderTopColor: "transparent", borderBottomColor: "transparent", borderLeftColor: "#fff" }} />;
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
  card: { backgroundColor: colors.surface, borderColor: colors.line, borderWidth: 1, borderRadius: 18, padding: 11, marginBottom: 12 },
  fill: { position: "absolute", top: 0, left: 0, right: 0, bottom: 0 },
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

// Build the evaluation route href with the player's display params.
export function evalHref(p: RankPlayer): string {
  return `/evaluation/${p.slug}?name=${encodeURIComponent(p.name)}&meta=${encodeURIComponent(
    [p.position, p.city || p.school, p.classYear].filter(Boolean).join(" · ")
  )}&access=${p.evalAccess}&price=${encodeURIComponent(p.evalPrice || "")}`;
}
