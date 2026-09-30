// Native Studio - Settings (status, read-only). Shows each backend integration
// with a colored status dot + label. Reads /api/admin/health with the admin
// Bearer token.

import React, { useEffect, useState } from "react";
import { View, Text, StyleSheet, RefreshControl, ActivityIndicator } from "react-native";
import { colors, fonts, radii } from "../../lib/theme";
import { fetchAdminHealth, type HealthResponse, type HealthStatus } from "../../lib/adminApi";
import { AdminScaffold } from "../../components/AdminScaffold";
import { Dot } from "../../components/ui";

const ROWS: { key: keyof HealthResponse; label: string; detail: string }[] = [
  { key: "firebase", label: "Firebase", detail: "Accounts + database" },
  { key: "youtube", label: "YouTube", detail: "Past episodes" },
  { key: "stream", label: "Cloudflare Stream", detail: "Live broadcast" },
  { key: "chat", label: "Live chat", detail: "Realtime worker" },
  { key: "stripe", label: "Stripe", detail: "Tips + payments" },
  { key: "resend", label: "Resend", detail: "Email delivery" },
];

function statusMeta(s: HealthStatus | undefined): { color: string; label: string } {
  switch (s) {
    case "ok":
      return { color: "#3f8f6b", label: "Working" };
    case "fail":
      return { color: colors.live, label: "Error" };
    default:
      return { color: colors.dim, label: "Not set up" };
  }
}

export default function AdminSettingsScreen() {
  const [data, setData] = useState<HealthResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState("");

  async function load() {
    setError("");
    try {
      setData(await fetchAdminHealth());
    } catch (e: any) {
      setError(e?.message === "not-authorized" ? "Not authorized." : "Could not load status.");
    }
  }

  useEffect(() => {
    (async () => {
      await load();
      setLoading(false);
    })();
  }, []);

  return (
    <AdminScaffold
      eyebrow="System Status"
      title="Settings"
      require="settings"
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
      {loading ? (
        <ActivityIndicator color={colors.amber} style={{ marginTop: 18 }} />
      ) : error || !data ? (
        <View style={styles.card}>
          <Text style={styles.muted}>{error || "No status."}</Text>
        </View>
      ) : (
        ROWS.map((r) => {
          const meta = statusMeta(data[r.key]);
          return (
            <View key={r.key} style={styles.row}>
              <View style={{ flex: 1 }}>
                <Text style={styles.name}>{r.label}</Text>
                <Text style={styles.detail}>{r.detail}</Text>
              </View>
              <View style={styles.statusPill}>
                <Dot color={meta.color} glow={data[r.key] === "ok"} />
                <Text style={[styles.statusText, { color: meta.color }]}>{meta.label}</Text>
              </View>
            </View>
          );
        })
      )}
    </AdminScaffold>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.surface,
    borderColor: colors.lineSoft,
    borderWidth: 1,
    borderRadius: radii.lg,
    padding: 16,
  },
  muted: { fontFamily: fonts.body, fontSize: 13, color: colors.muted, lineHeight: 20 },
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    backgroundColor: colors.surface,
    borderColor: colors.lineSoft,
    borderWidth: 1,
    borderRadius: radii.lg,
    padding: 15,
    marginBottom: 10,
  },
  name: { fontFamily: fonts.bold, fontSize: 14, color: colors.cream },
  detail: { fontFamily: fonts.body, fontSize: 11.5, color: colors.muted, marginTop: 3 },
  statusPill: { flexDirection: "row", alignItems: "center", gap: 7, flexShrink: 0 },
  statusText: { fontFamily: fonts.semibold, fontSize: 12 },
});
