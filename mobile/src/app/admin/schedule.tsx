// Native Studio - Schedule CRUD. Lists upcoming broadcasts with a live
// countdown, lets an admin add a broadcast (date/time + timezone + title + note)
// and remove one. Saves the FULL updated array to the shared site-config
// endpoint with the admin Bearer token, mirroring the website's Studio.

import React, { useEffect, useState } from "react";
import {
  View,
  Text,
  TextInput,
  Pressable,
  StyleSheet,
  RefreshControl,
  ActivityIndicator,
} from "react-native";
import { colors, fonts, radii } from "../../lib/theme";
import { fetchSiteConfig, countdownLabel, type ScheduleItem } from "../../lib/api";
import {
  saveSchedule,
  wallClockToEpoch,
  fmtWhen,
  TZ_OPTIONS,
} from "../../lib/adminApi";
import { AdminScaffold } from "../../components/AdminScaffold";
import { AmberButton } from "../../components/ui";

export default function AdminScheduleScreen() {
  const [items, setItems] = useState<ScheduleItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");
  const [, tick] = useState(0);

  // Add-form state.
  const [dt, setDt] = useState("");
  const [tz, setTz] = useState("America/New_York");
  const [title, setTitle] = useState("");
  const [note, setNote] = useState("");

  async function load() {
    try {
      const cfg = await fetchSiteConfig();
      const list = Array.isArray(cfg.schedule) ? cfg.schedule : [];
      list.sort((a, b) => (a.startsAt ?? 0) - (b.startsAt ?? 0));
      setItems(list);
    } catch {
      setMessage("Could not load the schedule.");
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

  async function persist(list: ScheduleItem[]) {
    setSaving(true);
    try {
      const res = await saveSchedule(list);
      setMessage(res.saved ? "Saved." : res.demo ? "Preview only - connect Firebase to save." : res.error ?? "Saved.");
    } catch (e: any) {
      setMessage(e?.message === "not-authorized" ? "Not authorized to save." : "Could not save.");
    } finally {
      setSaving(false);
    }
  }

  async function addBroadcast() {
    if (!title.trim() || !dt.trim()) {
      setMessage("Add a date/time and a show name.");
      return;
    }
    // Accept "YYYY-MM-DDTHH:mm" or "YYYY-MM-DD HH:mm".
    const local = dt.trim().replace(" ", "T");
    if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(local)) {
      setMessage("Use the format YYYY-MM-DD HH:MM (24-hour).");
      return;
    }
    const startsAt = wallClockToEpoch(local, tz);
    const item: ScheduleItem = {
      title: title.trim(),
      note: note.trim(),
      startsAt,
      tz,
      when: fmtWhen(startsAt, tz),
    };
    const list = [...items, item].sort((a, b) => (a.startsAt ?? 0) - (b.startsAt ?? 0));
    setItems(list);
    setDt("");
    setTitle("");
    setNote("");
    await persist(list);
  }

  async function removeAt(idx: number) {
    const list = items.filter((_, i) => i !== idx);
    setItems(list);
    await persist(list);
  }

  const now = Date.now();

  return (
    <AdminScaffold
      eyebrow="Broadcast Calendar"
      title="Schedule"
      require="schedule"
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
      {message ? <Text style={styles.msg}>{message}</Text> : null}

      {/* Add a broadcast */}
      <View style={styles.panel}>
        <Text style={styles.panelTitle}>Add a broadcast</Text>
        <Text style={styles.panelSub}>Date, time and timezone - viewers see a live countdown.</Text>

        <Text style={styles.label}>Date &amp; time (24-hour)</Text>
        <TextInput
          value={dt}
          onChangeText={setDt}
          placeholder="2026-09-11T20:00"
          placeholderTextColor={colors.dim}
          style={styles.field}
          autoCapitalize="none"
          autoCorrect={false}
        />

        <Text style={styles.label}>Timezone</Text>
        <View style={styles.tzRow}>
          {TZ_OPTIONS.map((t) => {
            const active = tz === t.id;
            return (
              <Pressable
                key={t.id}
                onPress={() => setTz(t.id)}
                style={({ pressed }) => [
                  styles.tzPill,
                  active && styles.tzPillActive,
                  pressed && { opacity: 0.8 },
                ]}
              >
                <Text style={[styles.tzText, active && { color: "#1a1205" }]}>
                  {t.label.replace(/^(.*)\((.*)\)$/, "$2")}
                </Text>
              </Pressable>
            );
          })}
        </View>

        <Text style={styles.label}>Show</Text>
        <TextInput
          value={title}
          onChangeText={setTitle}
          placeholder="Your show name"
          placeholderTextColor={colors.dim}
          style={styles.field}
          maxLength={120}
        />

        <Text style={styles.label}>Note</Text>
        <TextInput
          value={note}
          onChangeText={setNote}
          placeholder="Weekly flagship broadcast"
          placeholderTextColor={colors.dim}
          style={styles.field}
          maxLength={160}
        />

        <View style={{ marginTop: 14 }}>
          <AmberButton label={saving ? "Saving…" : "Add broadcast"} onPress={addBroadcast} disabled={saving} />
        </View>
      </View>

      {/* Upcoming list */}
      <Text style={styles.listHeading}>Upcoming broadcasts</Text>
      {loading ? (
        <ActivityIndicator color={colors.amber} style={{ marginTop: 18 }} />
      ) : items.length === 0 ? (
        <View style={styles.emptyCard}>
          <Text style={styles.emptyText}>No broadcasts scheduled yet. Add one above.</Text>
        </View>
      ) : (
        items.map((it, i) => {
          const expired = (it.startsAt ?? 0) <= now;
          return (
            <View key={`${it.title}-${i}`} style={[styles.item, expired && { opacity: 0.55 }]}>
              <View style={{ flex: 1 }}>
                <Text style={styles.itemWhen}>{it.when || fmtWhen(it.startsAt ?? 0, it.tz ?? "America/New_York")}</Text>
                <Text style={styles.itemTitle}>
                  {it.title}
                  {expired ? "  · Expired" : ""}
                </Text>
                {it.note ? <Text style={styles.itemNote}>{it.note}</Text> : null}
                {!expired ? <Text style={styles.itemCd}>{countdownLabel(it.startsAt)}</Text> : null}
              </View>
              <Pressable
                onPress={() => removeAt(i)}
                hitSlop={8}
                style={({ pressed }) => [styles.removeBtn, pressed && { opacity: 0.7 }]}
              >
                <Text style={styles.removeText}>Remove</Text>
              </Pressable>
            </View>
          );
        })
      )}
    </AdminScaffold>
  );
}

const styles = StyleSheet.create({
  msg: { fontFamily: fonts.semibold, fontSize: 12.5, color: colors.amber, marginBottom: 12 },
  panel: {
    backgroundColor: colors.surface,
    borderColor: colors.lineSoft,
    borderWidth: 1,
    borderRadius: radii.lg,
    padding: 16,
  },
  panelTitle: { fontFamily: fonts.bold, fontSize: 15, color: colors.cream },
  panelSub: { fontFamily: fonts.body, fontSize: 12, color: colors.muted, marginTop: 4, marginBottom: 8 },
  label: {
    fontFamily: fonts.bold,
    fontSize: 10.5,
    letterSpacing: 1.5,
    color: colors.dim,
    textTransform: "uppercase",
    marginTop: 12,
    marginBottom: 6,
  },
  field: {
    backgroundColor: colors.surface2,
    borderWidth: 1,
    borderColor: colors.lineSoft,
    borderRadius: 12,
    paddingVertical: 12,
    paddingHorizontal: 14,
    fontFamily: fonts.body,
    fontSize: 14,
    color: colors.cream,
  },
  tzRow: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  tzPill: {
    borderRadius: radii.pill,
    borderWidth: 1,
    borderColor: colors.line,
    backgroundColor: colors.surface2,
    paddingVertical: 8,
    paddingHorizontal: 14,
  },
  tzPillActive: { backgroundColor: colors.amber, borderColor: colors.amber },
  tzText: { fontFamily: fonts.semibold, fontSize: 12, color: colors.cream },
  listHeading: { fontFamily: fonts.bold, fontSize: 13, color: colors.cream, marginTop: 24, marginBottom: 12 },
  emptyCard: {
    backgroundColor: colors.surface,
    borderColor: colors.lineSoft,
    borderWidth: 1,
    borderRadius: radii.lg,
    padding: 16,
  },
  emptyText: { fontFamily: fonts.body, fontSize: 13, color: colors.muted },
  item: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    backgroundColor: colors.surface,
    borderColor: colors.lineSoft,
    borderWidth: 1,
    borderRadius: radii.lg,
    padding: 14,
    marginBottom: 11,
  },
  itemWhen: { fontFamily: fonts.bold, fontSize: 11.5, color: colors.amber },
  itemTitle: { fontFamily: fonts.bold, fontSize: 14, color: colors.cream, marginTop: 3 },
  itemNote: { fontFamily: fonts.body, fontSize: 11.5, color: colors.muted, marginTop: 2 },
  itemCd: { fontFamily: fonts.semibold, fontSize: 11, color: colors.muted, marginTop: 5 },
  removeBtn: {
    borderRadius: 10,
    borderWidth: 1,
    borderColor: colors.lineSoft,
    backgroundColor: colors.surface2,
    paddingVertical: 8,
    paddingHorizontal: 12,
    flexShrink: 0,
  },
  removeText: { fontFamily: fonts.semibold, fontSize: 12, color: colors.muted },
});
