// Native Studio - Costs (read-only). Shows the estimated monthly total, the
// cost breakdown, and the per-show estimate (viewers x minutes x rate). Reads
// /api/admin/usage with the admin Bearer token.

import React, { useEffect, useState } from "react";
import { View, Text, StyleSheet, RefreshControl, ActivityIndicator } from "react-native";
import { colors, fonts, radii } from "../../lib/theme";
import { fetchAdminUsage, type UsageResponse } from "../../lib/adminApi";
import { AdminScaffold } from "../../components/AdminScaffold";

const money = (n: number | null | undefined) =>
  n == null ? "—" : "$" + Number(n).toLocaleString(undefined, { maximumFractionDigits: 2 });

export default function AdminCostsScreen() {
  const [data, setData] = useState<UsageResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState("");

  async function load() {
    setError("");
    try {
      setData(await fetchAdminUsage());
    } catch (e: any) {
      setError(e?.message === "not-authorized" ? "Not authorized." : "Could not load costs.");
    }
  }

  useEffect(() => {
    (async () => {
      await load();
      setLoading(false);
    })();
  }, []);

  const est = data?.estimate;
  const overBudget = data && data.budget > 0 && data.total > data.budget;

  return (
    <AdminScaffold
      eyebrow="Running the Channel"
      title="Costs"
      require="costs"
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
          <Text style={styles.muted}>{error || "No cost data."}</Text>
        </View>
      ) : (
        <>
          {/* Estimated monthly total */}
          <View style={styles.totalCard}>
            <Text style={styles.totalLabel}>Estimated this month</Text>
            <Text style={styles.totalValue}>{money(data.total)}</Text>
            {data.budget > 0 ? (
              <Text style={[styles.budget, overBudget && { color: colors.live }]}>
                Budget {money(data.budget)}
                {overBudget ? " · over budget" : ""}
              </Text>
            ) : null}
          </View>

          {/* Breakdown */}
          <Text style={styles.heading}>Breakdown</Text>
          {data.breakdown.map((b, i) => (
            <View key={b.key ?? `${b.name}-${i}`} style={styles.row}>
              <View style={{ flex: 1 }}>
                <Text style={styles.rowName}>{b.name}</Text>
                <Text style={styles.rowDetail}>{b.detail}</Text>
              </View>
              <Text style={[styles.rowCost, b.free && { color: colors.muted }]}>
                {b.free ? "Free" : money(b.cost)}
              </Text>
            </View>
          ))}

          {/* Per-show estimate */}
          {est ? (
            <>
              <Text style={styles.heading}>Per-show estimate</Text>
              <View style={styles.card}>
                <Text style={styles.estLine}>
                  {est.typicalViewers.toLocaleString()} viewers x {est.avgShowMinutes} min
                </Text>
                <Text style={styles.estCost}>{money(est.perShow)} per show</Text>
                <View style={styles.estGrid}>
                  <View style={styles.estCell}>
                    <Text style={styles.estCellValue}>{est.showsPerMonth}</Text>
                    <Text style={styles.estCellLabel}>Shows / month</Text>
                  </View>
                  <View style={styles.estCell}>
                    <Text style={styles.estCellValue}>{money(est.perMonth)}</Text>
                    <Text style={styles.estCellLabel}>Est. monthly</Text>
                  </View>
                </View>
                {data.prices ? (
                  <Text style={styles.priceNote}>
                    Delivery ~{money(data.prices.deliveryPer1k)} / 1,000 min watched · storage ~
                    {money(data.prices.storagePer1k)} / 1,000 min stored
                  </Text>
                ) : null}
              </View>
            </>
          ) : null}
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
  totalCard: {
    backgroundColor: colors.surface,
    borderColor: "rgba(245,165,36,0.3)",
    borderWidth: 1,
    borderRadius: radii.lg,
    padding: 18,
  },
  totalLabel: {
    fontFamily: fonts.bold,
    fontSize: 10.5,
    letterSpacing: 2,
    color: colors.dim,
    textTransform: "uppercase",
  },
  totalValue: { fontFamily: fonts.display, fontSize: 44, color: colors.amber, marginTop: 6 },
  budget: { fontFamily: fonts.semibold, fontSize: 12.5, color: colors.muted, marginTop: 6 },
  heading: { fontFamily: fonts.bold, fontSize: 13, color: colors.cream, marginTop: 24, marginBottom: 12 },
  row: {
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
  rowName: { fontFamily: fonts.bold, fontSize: 13.5, color: colors.cream },
  rowDetail: { fontFamily: fonts.body, fontSize: 11.5, color: colors.muted, marginTop: 3, lineHeight: 16 },
  rowCost: { fontFamily: fonts.bold, fontSize: 14, color: colors.cream, flexShrink: 0 },
  estLine: { fontFamily: fonts.semibold, fontSize: 13, color: colors.muted },
  estCost: { fontFamily: fonts.display, fontSize: 30, color: colors.cream, marginTop: 6 },
  estGrid: { flexDirection: "row", gap: 10, marginTop: 14 },
  estCell: {
    flex: 1,
    backgroundColor: colors.surface2,
    borderRadius: radii.md,
    padding: 12,
  },
  estCellValue: { fontFamily: fonts.bold, fontSize: 18, color: colors.cream },
  estCellLabel: {
    fontFamily: fonts.bold,
    fontSize: 9.5,
    letterSpacing: 1.2,
    color: colors.dim,
    textTransform: "uppercase",
    marginTop: 4,
  },
  priceNote: { fontFamily: fonts.body, fontSize: 11, color: colors.dim, marginTop: 14, lineHeight: 16 },
});
