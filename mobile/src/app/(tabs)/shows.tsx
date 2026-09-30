// SHOWS tab. Upcoming (future) broadcasts from /api/site-config, plus the five
// series from the site's SERIES list — matching the mockup's "The Slate".

import React, { useEffect, useState } from "react";
import { View, Text, StyleSheet, ScrollView, ActivityIndicator } from "react-native";
import { colors, fonts } from "../../lib/theme";
import {
  fetchSiteConfig,
  upcoming,
  countdownLabel,
  formatWhen,
  type ScheduleItem,
} from "../../lib/api";
import { SERIES } from "../../lib/series";
import { ArtWell, Eyebrow, Display, Body, Card, Dot } from "../../components/ui";
import { wellForKey } from "../../lib/theme";

export default function ShowsScreen() {
  const [up, setUp] = useState<ScheduleItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [, tick] = useState(0);

  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const cfg = await fetchSiteConfig();
        if (alive) setUp(upcoming(cfg.schedule || []).slice(0, 5));
      } catch {
        /* leave empty */
      } finally {
        if (alive) setLoading(false);
      }
    })();
    const id = setInterval(() => tick((n) => n + 1), 1000);
    return () => {
      alive = false;
      clearInterval(id);
    };
  }, []);

  return (
    <ScrollView contentContainerStyle={styles.scroll}>
      <Eyebrow dim>The Slate</Eyebrow>
      <Display style={styles.h1}>Five Shows.{"\n"}One Camera.</Display>
      <Body style={{ marginBottom: 18 }}>
        One creator, one rig, five distinct programs — streamed live and archived for your audience.
      </Body>

      <Eyebrow style={{ marginBottom: 10 }}>Upcoming Live</Eyebrow>
      {loading ? (
        <ActivityIndicator color={colors.amber} style={{ marginVertical: 20 }} />
      ) : up.length === 0 ? (
        <Card style={styles.emptyCard}>
          <Body>No upcoming broadcasts scheduled yet. Check back soon.</Body>
        </Card>
      ) : (
        up.map((s, i) => (
          <Card key={`${s.title}-${i}`} style={styles.upCard}>
            <ArtWell well={i % 2 ? "blue" : "clay"} style={styles.cover} />
            <View style={{ flex: 1 }}>
              <Text style={styles.upTitle}>{s.title}</Text>
              <View style={styles.countChip}>
                <Dot color={colors.live} glow />
                <Text style={styles.countText}>
                  {formatWhen(s)} · {countdownLabel(s.startsAt)}
                </Text>
              </View>
            </View>
          </Card>
        ))
      )}

      <Eyebrow style={{ marginTop: 22, marginBottom: 12 }}>The Slate</Eyebrow>
      {SERIES.map((series) => (
        <Card key={series.key} style={styles.showCard}>
          <ArtWell well={wellForKey(series.key)} style={styles.art}>
            <View style={styles.catChip}>
              <Text style={styles.catText}>{series.badge}</Text>
            </View>
            <Text style={styles.showTitle}>{series.title}</Text>
          </ArtWell>
          <View style={styles.body}>
            <Body>{series.blurb}</Body>
          </View>
        </Card>
      ))}
      <View style={{ height: 20 }} />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  scroll: { padding: 16, paddingBottom: 34 },
  h1: { fontSize: 38, lineHeight: 38, marginTop: 8, marginBottom: 8 },
  emptyCard: { padding: 16 },
  upCard: { flexDirection: "row", gap: 12, padding: 12, alignItems: "center", marginBottom: 12 },
  cover: { width: 96, height: 64, borderRadius: 11 },
  upTitle: { fontFamily: fonts.bold, fontSize: 15, color: colors.cream },
  countChip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    alignSelf: "flex-start",
    marginTop: 8,
    backgroundColor: "rgba(245,165,36,0.10)",
    borderWidth: 1,
    borderColor: "rgba(245,165,36,0.28)",
    borderRadius: 999,
    paddingVertical: 4,
    paddingHorizontal: 9,
  },
  countText: { fontFamily: fonts.bold, fontSize: 11.5, color: colors.amber },
  showCard: { marginBottom: 14 },
  art: { aspectRatio: 16 / 9, justifyContent: "flex-end", padding: 12 },
  catChip: {
    position: "absolute",
    top: 8,
    left: 8,
    backgroundColor: "rgba(10,9,8,0.6)",
    borderWidth: 1,
    borderColor: colors.lineSoft,
    borderRadius: 6,
    paddingVertical: 3,
    paddingHorizontal: 7,
  },
  catText: { fontFamily: fonts.bold, fontSize: 8.5, letterSpacing: 1, color: colors.cream, textTransform: "uppercase" },
  showTitle: { fontFamily: fonts.display, fontSize: 22, color: colors.cream },
  body: { paddingHorizontal: 13, paddingTop: 11, paddingBottom: 14 },
});
