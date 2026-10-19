// RANKINGS — the chip-graded board. Video cards with tap-to-play highlights,
// chip dots, and a Read / Unlock button that opens the Honest Evaluation.

import React, { useEffect, useState } from "react";
import { View, Text, StyleSheet, FlatList, ActivityIndicator, Linking } from "react-native";
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
          <PlayerCard player={item} rank={index + 1} onPlay={() => openVideo(item)} onEval={() => router.push(evalHref(item) as never)} />
        )}
        ListEmptyComponent={
          <Text style={styles.empty}>{error ? "Couldn't reach the board. Check your connection." : "The board is opening soon."}</Text>
        }
      />
      <VideoModal playing={playing} onClose={() => setPlaying(null)} />
    </>
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
});
