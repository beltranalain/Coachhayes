// ARCHIVE tab. Past episodes from /api/youtube?type=uploads (server proxies the
// YouTube key). Two-column grid matching the mockup's "The Archive". When the
// backend has no YouTube key configured, we show a clear empty state.

import React, { useEffect, useState } from "react";
import { View, Text, StyleSheet, ScrollView, ActivityIndicator, Image, RefreshControl, Linking, Pressable } from "react-native";
import { colors, fonts, wells } from "../../lib/theme";
import { fetchUploads, type YtVideo } from "../../lib/api";
import { ArtWell, Eyebrow, Display, Body, Card } from "../../components/ui";

export default function ArchiveScreen() {
  const [items, setItems] = useState<YtVideo[]>([]);
  const [configured, setConfigured] = useState(true);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  async function load() {
    try {
      const res = await fetchUploads();
      setConfigured(res.configured);
      setItems(res.items ?? []);
    } catch {
      setItems([]);
    }
  }

  useEffect(() => {
    (async () => {
      await load();
      setLoading(false);
    })();
  }, []);

  function open(id: string) {
    if (id) Linking.openURL(`https://www.youtube.com/watch?v=${id}`);
  }

  return (
    <ScrollView
      contentContainerStyle={styles.scroll}
      refreshControl={
        <RefreshControl
          refreshing={refreshing}
          onRefresh={async () => {
            setRefreshing(true);
            await load();
            setRefreshing(false);
          }}
          tintColor={colors.amber}
        />
      }
    >
      <Eyebrow dim>Past Broadcasts</Eyebrow>
      <Display style={styles.h1}>The{"\n"}Archive</Display>

      {loading ? (
        <ActivityIndicator color={colors.amber} style={{ marginTop: 24 }} />
      ) : !configured ? (
        <Card style={{ padding: 16, marginTop: 8 }}>
          <Body>The YouTube archive isn&apos;t connected on the backend yet. Once it is, past episodes appear here automatically.</Body>
        </Card>
      ) : items.length === 0 ? (
        <Card style={{ padding: 16, marginTop: 8 }}>
          <Body>No past episodes found. Pull to refresh.</Body>
        </Card>
      ) : (
        <View style={styles.grid}>
          {items.map((v) => (
            <Pressable key={v.id} style={styles.cell} onPress={() => open(v.id)}>
              <View style={styles.art}>
                {v.thumbnail ? (
                  <Image source={{ uri: v.thumbnail }} style={StyleSheet.absoluteFill} resizeMode="cover" />
                ) : (
                  <ArtWell well="amber" radius={12} style={StyleSheet.absoluteFill} />
                )}
              </View>
              <Text style={styles.at} numberOfLines={2}>{v.title}</Text>
              <Text style={styles.meta}>{formatDate(v.publishedAt)}</Text>
            </Pressable>
          ))}
        </View>
      )}
      <View style={{ height: 20 }} />
    </ScrollView>
  );
}

function formatDate(iso: string): string {
  if (!iso) return "";
  try {
    return new Date(iso).toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" });
  } catch {
    return "";
  }
}

// keep the wells import referenced (used by the fallback ArtWell palette)
void wells;

const styles = StyleSheet.create({
  scroll: { padding: 16, paddingBottom: 34 },
  h1: { fontSize: 38, lineHeight: 38, marginTop: 8, marginBottom: 12 },
  grid: { flexDirection: "row", flexWrap: "wrap", justifyContent: "space-between", gap: 12 },
  cell: { width: "47.5%" },
  art: { aspectRatio: 16 / 10, borderRadius: 12, overflow: "hidden", backgroundColor: "#0b0a09" },
  at: { fontFamily: fonts.bold, fontSize: 12.5, color: colors.cream, marginTop: 8, lineHeight: 17 },
  meta: { fontFamily: fonts.body, fontSize: 10.5, color: colors.dim, marginTop: 3 },
});
