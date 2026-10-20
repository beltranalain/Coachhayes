// The "breakdown" card for auto-generated player posts in the community feed —
// mirrors the website's PlayerPostCard so chips read the same everywhere.

import React from "react";
import { View, Text, StyleSheet } from "react-native";
import { Image } from "expo-image";
import { colors, fonts, chipColors, type ThemeColors } from "../lib/theme";
import { useColors, useThemedStyles } from "../lib/ThemeContext";

type Chip = "bronze" | "silver" | "gold" | "blue";
export type PlayerPost = {
  name: string; position?: string; classYear?: string; school?: string;
  commit?: string; commitLogo?: string; slug?: string; chip?: Chip;
  categories?: Partial<Record<string, Chip>>; categoryNotes?: Partial<Record<string, string>>;
};

const CATS: { key: string; label: string }[] = [
  { key: "power", label: "Power" },
  { key: "speed", label: "Speed" },
  { key: "motor", label: "Motor" },
  { key: "technique", label: "Technique" },
  { key: "iq", label: "Football IQ" },
];
const CHIP_LABEL: Record<Chip, string> = { bronze: "Bronze chip", silver: "Silver chip", gold: "Gold chip", blue: "Blue chip" };
const CHIP_WEIGHT: Record<Chip, number> = { bronze: 1, silver: 2, gold: 3, blue: 4 };

export default function PlayerBreakdownCard({ p }: { p: PlayerPost }) {
  const colors = useColors();
  const styles = useThemedStyles(makeStyles);
  if (!p || !p.name) return null;
  const cats = p.categories || {};
  const overall: Chip = p.chip || "bronze";
  const ring = chipColors[overall];
  const set = CATS.filter((c) => cats[c.key]);
  const avg = set.length ? (set.reduce((s, c) => s + (CHIP_WEIGHT[cats[c.key] as Chip] || 0), 0) / set.length).toFixed(1) : null;

  return (
    <View style={styles.card}>
      <Text style={[styles.kick, { color: ring }]}>The breakdown</Text>
      <Text style={styles.title}>{p.name}{p.position ? ` — ${p.position}` : ""}{p.classYear ? `, class of ${p.classYear}` : ""}</Text>
      {!!p.school && <Text style={styles.meta}>{p.school}</Text>}

      <View style={{ marginTop: 12 }}>
        {CATS.map((cat) => {
          const t = cats[cat.key] as Chip | undefined;
          if (!t) return null;
          const note = p.categoryNotes?.[cat.key];
          return (
            <View key={cat.key} style={styles.row}>
              <View style={[styles.dot, { backgroundColor: chipColors[t], shadowColor: chipColors[t] }]} />
              <View style={{ flex: 1 }}>
                <View style={styles.rowHead}>
                  <Text style={styles.catLabel}>{cat.label}</Text>
                  <Text style={[styles.catChip, { color: chipColors[t] }]}>{CHIP_LABEL[t]}</Text>
                </View>
                {!!note && <Text style={styles.note}>{note}</Text>}
              </View>
            </View>
          );
        })}
      </View>

      <View style={styles.overall}>
        <View style={[styles.bigDot, { backgroundColor: ring }]} />
        <View style={{ flex: 1 }}>
          <Text style={[styles.kick, { color: ring, marginBottom: 2 }]}>Overall ranking</Text>
          <Text style={styles.overallChip}>{CHIP_LABEL[overall]}{avg ? <Text style={styles.score}>   Score {avg}</Text> : null}</Text>
        </View>
      </View>

      {!!p.commitLogo && (
        <View style={styles.commitWrap}>
          <Image source={{ uri: p.commitLogo }} style={styles.commit} contentFit="contain" />
        </View>
      )}
    </View>
  );
}

const makeStyles = (colors: ThemeColors) => StyleSheet.create({
  card: { backgroundColor: colors.surface2, borderWidth: 1, borderColor: colors.line, borderRadius: 14, padding: 15, marginTop: 4, marginBottom: 2 },
  kick: { fontFamily: fonts.bold, fontSize: 10.5, letterSpacing: 1.6, textTransform: "uppercase" },
  title: { fontFamily: fonts.bold, fontSize: 16, color: colors.cream, marginTop: 8, letterSpacing: -0.3 },
  meta: { fontFamily: fonts.body, fontSize: 12.5, color: colors.muted, marginTop: 3 },

  row: { flexDirection: "row", gap: 12, alignItems: "flex-start", paddingVertical: 10, borderTopWidth: 1, borderTopColor: colors.lineSoft },
  dot: { width: 20, height: 20, borderRadius: 10, marginTop: 2, shadowOpacity: 0.5, shadowRadius: 5, elevation: 2 },
  rowHead: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 10 },
  catLabel: { fontFamily: fonts.bold, fontSize: 14, color: colors.cream },
  catChip: { fontFamily: fonts.bold, fontSize: 12.5 },
  note: { fontFamily: fonts.body, fontSize: 12.5, lineHeight: 18, color: colors.muted, marginTop: 4 },

  overall: { flexDirection: "row", alignItems: "center", gap: 13, paddingTop: 14, marginTop: 6, borderTopWidth: 1, borderTopColor: colors.line },
  bigDot: { width: 34, height: 34, borderRadius: 17 },
  overallChip: { fontFamily: fonts.bold, fontSize: 20, color: colors.cream, letterSpacing: -0.4 },
  score: { fontFamily: fonts.body, fontSize: 13, color: colors.muted },

  commitWrap: { alignItems: "center", marginTop: 16 },
  commit: { width: 54, height: 54 },
});
