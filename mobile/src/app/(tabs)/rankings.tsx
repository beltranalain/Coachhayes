// RANKINGS — the chip-graded board. Video cards with tap-to-play highlights,
// chip dots, and a Read / Unlock button that opens the Honest Evaluation.

import React, { useEffect, useMemo, useState } from "react";
import { View, Text, StyleSheet, FlatList, ActivityIndicator, Linking, Pressable, ScrollView } from "react-native";
import { useRouter } from "expo-router";

import { colors, fonts } from "../../lib/theme";
import { fetchPlayers, youtubeId, type RankPlayer } from "../../lib/api";
import { Eyebrow } from "../../components/ui";
import { PlayerCard, VideoModal, evalHref } from "../../components/PlayerCard";

export default function RankingsScreen() {
  const router = useRouter();
  const [players, setPlayers] = useState<RankPlayer[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [playing, setPlaying] = useState<{ id: string; name: string } | null>(null);
  const [pos, setPos] = useState<string>("all");
  const [year, setYear] = useState<string>("all");

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

  const positions = useMemo(() => [...new Set(players.map((p) => p.position).filter(Boolean))].sort(), [players]);
  const years = useMemo(() => [...new Set(players.map((p) => p.classYear).filter(Boolean))].sort(), [players]);
  const rows = useMemo(
    () => players.filter((p) => (pos === "all" || p.position === pos) && (year === "all" || p.classYear === year)),
    [players, pos, year]
  );

  function openVideo(p: RankPlayer) {
    const id = youtubeId(p.videoUrl);
    if (id) setPlaying({ id, name: p.name });
    else if (p.videoUrl) Linking.openURL(p.videoUrl).catch(() => {});
  }

  const header = (
    <View style={styles.head}>
      <Eyebrow>Coach Hayes · Player Rankings</Eyebrow>
      <Text style={styles.h1}>Four chips. One grade.</Text>
      <View style={styles.statRow}>
        <View><Text style={styles.statN}>{players.length}</Text><Text style={styles.statL}>Players graded</Text></View>
        <View><Text style={styles.statN}>4</Text><Text style={styles.statL}>Chip tiers</Text></View>
      </View>

      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.filters}>
        <Chip label="All" on={pos === "all"} onPress={() => setPos("all")} />
        {positions.map((p) => <Chip key={p} label={p} on={pos === p} onPress={() => setPos(p)} />)}
        {years.length > 1 && <View style={styles.divider} />}
        {years.length > 1 && <Chip label="All years" on={year === "all"} onPress={() => setYear("all")} />}
        {years.length > 1 && years.map((y) => <Chip key={y} label={y} on={year === y} onPress={() => setYear(y)} />)}
      </ScrollView>
    </View>
  );

  if (loading) {
    return <View style={styles.center}><ActivityIndicator color={colors.amber} /><Text style={styles.dim}>Loading the board…</Text></View>;
  }

  return (
    <>
      <FlatList
        data={rows}
        keyExtractor={(p) => p.slug}
        ListHeaderComponent={header}
        contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: 28 }}
        renderItem={({ item, index }) => (
          <PlayerCard player={item} rank={players.indexOf(item) + 1} onPlay={() => openVideo(item)} onEval={() => router.push(evalHref(item) as never)} />
        )}
        ListEmptyComponent={
          <Text style={styles.empty}>{error ? "Couldn't reach the board. Check your connection." : "No players match that filter yet."}</Text>
        }
      />
      <VideoModal playing={playing} onClose={() => setPlaying(null)} />
    </>
  );
}

function Chip({ label, on, onPress }: { label: string; on: boolean; onPress: () => void }) {
  return (
    <Pressable onPress={onPress} style={[styles.chip, on && styles.chipOn]}>
      <Text style={[styles.chipText, on && styles.chipTextOn]}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  center: { flex: 1, alignItems: "center", justifyContent: "center", gap: 10, backgroundColor: colors.bg },
  dim: { fontFamily: fonts.body, color: colors.muted, fontSize: 12.5 },
  empty: { fontFamily: fonts.body, color: colors.muted, fontSize: 13.5, textAlign: "center", paddingHorizontal: 24, paddingVertical: 40 },
  head: { paddingTop: 12, paddingBottom: 6 },
  h1: { fontFamily: fonts.display, fontSize: 30, color: colors.cream, letterSpacing: -1, marginTop: 8, lineHeight: 33 },
  statRow: { flexDirection: "row", gap: 26, marginTop: 16, marginBottom: 6 },
  statN: { fontFamily: fonts.display, fontSize: 30, color: colors.cream, lineHeight: 30 },
  statL: { fontFamily: fonts.body, fontSize: 12, color: colors.muted, marginTop: 4 },
  filters: { gap: 7, paddingTop: 14, paddingBottom: 4, alignItems: "center" },
  chip: { borderWidth: 1, borderColor: colors.line, borderRadius: 999, paddingVertical: 6, paddingHorizontal: 14, backgroundColor: colors.surface },
  chipOn: { backgroundColor: colors.cream, borderColor: colors.cream },
  chipText: { fontFamily: fonts.semibold, fontSize: 12.5, color: colors.muted },
  chipTextOn: { color: colors.bg },
  divider: { width: 1, height: 20, backgroundColor: colors.line, marginHorizontal: 4 },
});
