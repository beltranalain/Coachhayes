// SCHEDULE tab. Future broadcasts from /api/site-config schedule with live
// countdowns, matching the mockup's "On the Schedule" list.

import React, { useEffect, useState } from "react";
import { View, Text, StyleSheet, ScrollView, ActivityIndicator, RefreshControl } from "react-native";
import { colors, fonts, type WellName } from "../../lib/theme";
import {
  fetchSiteConfig,
  upcoming,
  countdownLabel,
  formatWhen,
  type ScheduleItem,
} from "../../lib/api";
import { ArtWell, Eyebrow, Display, Body, Card } from "../../components/ui";

const WELL_CYCLE: WellName[] = ["clay", "amber", "blue", "green", "purple"];

export default function ScheduleScreen() {
  const [items, setItems] = useState<ScheduleItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [, tick] = useState(0);

  async function load() {
    try {
      const cfg = await fetchSiteConfig();
      setItems(upcoming(cfg.schedule || []));
    } catch {
      /* leave empty */
    }
  }

  useEffect(() => {
    (async () => {
      await load();
      setLoading(false);
    })();
    const id = setInterval(() => tick((n) => n + 1), 1000);
    return () => clearInterval(id);
  }, []);

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
      <Eyebrow dim>Broadcast Calendar</Eyebrow>
      <Display style={styles.h1}>On the{"\n"}Schedule</Display>

      {loading ? (
        <ActivityIndicator color={colors.amber} style={{ marginTop: 24 }} />
      ) : items.length === 0 ? (
        <Card style={{ padding: 16 }}>
          <Body>No upcoming broadcasts scheduled yet. Pull to refresh.</Body>
        </Card>
      ) : (
        items.map((it, i) => (
          <Card key={`${it.title}-${i}`} style={styles.row}>
            <ArtWell well={WELL_CYCLE[i % WELL_CYCLE.length]} style={styles.thumb} />
            <View style={{ flex: 1 }}>
              <Text style={styles.date}>{formatWhen(it)}</Text>
              <Text style={styles.title}>{it.title}</Text>
              {it.note ? <Text style={styles.note}>{it.note}</Text> : null}
            </View>
            <Text style={styles.cd}>{countdownLabel(it.startsAt)}</Text>
          </Card>
        ))
      )}
      <View style={{ height: 20 }} />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  scroll: { padding: 16, paddingBottom: 34 },
  h1: { fontSize: 38, lineHeight: 38, marginTop: 8, marginBottom: 18 },
  row: { flexDirection: "row", gap: 12, padding: 12, alignItems: "center", marginBottom: 11 },
  thumb: { width: 66, height: 66, borderRadius: 11 },
  date: { fontFamily: fonts.bold, fontSize: 11.5, color: colors.amber },
  title: { fontFamily: fonts.bold, fontSize: 14, color: colors.cream, marginTop: 3 },
  note: { fontFamily: fonts.body, fontSize: 11.5, color: colors.muted, marginTop: 2 },
  cd: { fontFamily: fonts.bold, fontSize: 11, color: colors.cream, textAlign: "right" },
});
