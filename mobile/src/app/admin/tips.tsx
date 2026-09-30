// Native Studio - Tips. Shows a KPI row (total raised, count, this week,
// average) and a list of recent tips. Reads /api/admin/tips with the admin
// Bearer token. Handles not-configured / demo state.

import React, { useEffect, useState } from "react";
import { View, Text, StyleSheet, RefreshControl, ActivityIndicator } from "react-native";
import { colors, fonts, radii } from "../../lib/theme";
import { fetchAdminTips, type TipsResponse } from "../../lib/adminApi";
import { AdminScaffold } from "../../components/AdminScaffold";

const money = (n: number) =>
  "$" + Number(n || 0).toLocaleString(undefined, { maximumFractionDigits: 0 });

const WEEK_MS = 7 * 24 * 60 * 60 * 1000;

export default function AdminTipsScreen() {
  const [data, setData] = useState<TipsResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState("");

  async function load() {
    setError("");
    try {
      setData(await fetchAdminTips());
    } catch (e: any) {
      setError(e?.message === "not-authorized" ? "Not authorized." : "Could not load tips.");
    }
  }

  useEffect(() => {
    (async () => {
      await load();
      setLoading(false);
    })();
  }, []);

  const tips = data?.tips ?? [];
  const total = data?.total ?? 0;
  const count = data?.count ?? tips.length;
  const now = Date.now();
  const thisWeek = tips.filter((t) => t.ts > now - WEEK_MS).reduce((s, t) => s + t.amount, 0);
  const avg = count > 0 ? total / count : 0;

  const KPIS = [
    { label: "Total raised", value: money(total) },
    { label: "Tips", value: String(count) },
    { label: "This week", value: money(thisWeek) },
    { label: "Average", value: money(avg) },
  ];

  return (
    <AdminScaffold
      eyebrow="Viewer Support"
      title="Tips"
      require="tips"
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
      ) : error ? (
        <View style={styles.card}>
          <Text style={styles.muted}>{error}</Text>
        </View>
      ) : data && data.configured === false ? (
        <View style={styles.card}>
          <Text style={styles.muted}>
            Tips are not configured yet. Connect Firebase + Stripe on the backend to start
            collecting support.
          </Text>
        </View>
      ) : (
        <>
          <View style={styles.kpiRow}>
            {KPIS.map((k) => (
              <View key={k.label} style={styles.kpi}>
                <Text style={styles.kpiValue}>{k.value}</Text>
                <Text style={styles.kpiLabel}>{k.label}</Text>
              </View>
            ))}
          </View>

          <Text style={styles.heading}>Recent tips</Text>
          {tips.length === 0 ? (
            <View style={styles.card}>
              <Text style={styles.muted}>No tips yet.</Text>
            </View>
          ) : (
            tips.map((t, i) => (
              <View key={`${t.ts}-${i}`} style={styles.tip}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.tipName}>{t.name || "A viewer"}</Text>
                  {t.message ? <Text style={styles.tipMsg}>{t.message}</Text> : null}
                  <Text style={styles.tipDate}>
                    {t.ts ? new Date(t.ts).toLocaleString(undefined, { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" }) : ""}
                  </Text>
                </View>
                <Text style={styles.tipAmount}>{money(t.amount)}</Text>
              </View>
            ))
          )}
        </>
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
  kpiRow: { flexDirection: "row", flexWrap: "wrap", gap: 10 },
  kpi: {
    flexGrow: 1,
    flexBasis: "45%",
    backgroundColor: colors.surface,
    borderColor: colors.lineSoft,
    borderWidth: 1,
    borderRadius: radii.lg,
    padding: 16,
  },
  kpiValue: { fontFamily: fonts.display, fontSize: 28, color: colors.cream },
  kpiLabel: {
    fontFamily: fonts.bold,
    fontSize: 10,
    letterSpacing: 1.5,
    color: colors.dim,
    textTransform: "uppercase",
    marginTop: 6,
  },
  heading: { fontFamily: fonts.bold, fontSize: 13, color: colors.cream, marginTop: 24, marginBottom: 12 },
  tip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    backgroundColor: colors.surface,
    borderColor: colors.lineSoft,
    borderWidth: 1,
    borderRadius: radii.lg,
    padding: 14,
    marginBottom: 10,
  },
  tipName: { fontFamily: fonts.bold, fontSize: 14, color: colors.cream },
  tipMsg: { fontFamily: fonts.body, fontSize: 12.5, color: colors.muted, marginTop: 3 },
  tipDate: { fontFamily: fonts.body, fontSize: 11, color: colors.dim, marginTop: 5 },
  tipAmount: { fontFamily: fonts.bold, fontSize: 16, color: colors.amber, flexShrink: 0 },
});
