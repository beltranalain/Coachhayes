// HONEST EVALUATION — the long-form report. Free evaluations render inline;
// locked ones show a teaser + the manual-unlock paywall (same gate as the site).

import React, { useEffect, useState } from "react";
import { View, Text, StyleSheet, ScrollView, Pressable, ActivityIndicator } from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { colors, fonts, type ThemeColors } from "../../lib/theme";
import { useColors, useThemedStyles } from "../../lib/ThemeContext";
import { API_BASE } from "../../lib/config";
import { fetchEvaluation, type Evaluation, type EvalResponse } from "../../lib/api";
import { getFirebaseAuth } from "../../lib/firebase";

function paras(text: string): string[] {
  return String(text || "").split(/\n{2,}/).map((p) => p.trim()).filter(Boolean);
}

export default function EvaluationScreen() {
  const colors = useColors();
  const styles = useThemedStyles(makeStyles);
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { slug, name, meta, access, price } = useLocalSearchParams<{
    slug: string; name?: string; meta?: string; access?: string; price?: string;
  }>();

  const [resp, setResp] = useState<EvalResponse | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const token = (await getFirebaseAuth().currentUser?.getIdToken().catch(() => null)) ?? null;
        const d = await fetchEvaluation(String(slug), token);
        if (alive) setResp(d);
      } catch {
        if (alive) setResp({ hasEval: false });
      } finally {
        if (alive) setLoading(false);
      }
    })();
    return () => { alive = false; };
  }, [slug]);

  return (
    <View style={{ flex: 1, backgroundColor: colors.bg, paddingTop: insets.top }}>
      <View style={styles.topbar}>
        <Pressable onPress={() => router.back()} hitSlop={10} style={styles.back}>
          <Text style={styles.backChevron}>‹</Text><Text style={styles.backText} numberOfLines={1}>{name || "Back"}</Text>
        </Pressable>
      </View>

      <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: 40 }}>
        <Text style={styles.kick}>Honest Evaluation</Text>
        <Text style={styles.h1}>{name || "Player"}</Text>
        {!!meta && <Text style={styles.meta}>{meta}</Text>}

        {loading ? (
          <View style={styles.loading}><ActivityIndicator color={colors.amber} /></View>
        ) : resp?.locked ? (
          <Locked teaser={resp.teaser} price={resp.price || String(price || "")} />
        ) : resp?.evaluation ? (
          <Report e={resp.evaluation} />
        ) : (
          <Text style={styles.none}>No evaluation has been published for this player yet.</Text>
        )}
      </ScrollView>
    </View>
  );
}

function Report({ e }: { e: Evaluation }) {
  const colors = useColors();
  const styles = useThemedStyles(makeStyles);
  return (
    <View style={{ marginTop: 18 }}>
      {!!e.evaluatedOn && <Text style={styles.date}>Evaluated {e.evaluatedOn}</Text>}
      <Section title="Size" body={e.size} />
      <Section title="Speed & Movement" body={e.speed} />
      <Section title="Effort" body={e.effort} />
      <Section title="Position Analysis" body={e.positionAnalysis} />
      <ListSection title="Areas of Strength" items={e.strengths} />
      <ListSection title="Areas for Improvement" items={e.improvements} />
      <ListSection title="Recommended Recruiting Targets" items={e.recommendedTargets} />
      <Section title="Additional Comments" body={e.additionalComments} />
      <ListSection title="Development Priorities" items={e.developmentPriorities} ordered />
      <Section title="Final Recruiting Assessment" body={e.finalAssessment} />
      {!!e.projection && (
        <View style={styles.projWrap}><Text style={styles.proj}><Text style={styles.projLabel}>Projection: </Text>{e.projection}</Text></View>
      )}
    </View>
  );
}

function Section({ title, body }: { title: string; body: string }) {
  const colors = useColors();
  const styles = useThemedStyles(makeStyles);
  if (!body) return null;
  return (
    <View style={styles.sec}>
      <Text style={styles.secTitle}>{title}</Text>
      {paras(body).map((p, i) => <Text key={i} style={styles.p}>{p}</Text>)}
    </View>
  );
}
function ListSection({ title, items, ordered }: { title: string; items: string[]; ordered?: boolean }) {
  const colors = useColors();
  const styles = useThemedStyles(makeStyles);
  if (!items || !items.length) return null;
  return (
    <View style={styles.sec}>
      <Text style={styles.secTitle}>{title}</Text>
      {items.map((it, i) => (
        <View key={i} style={styles.li}>
          <Text style={styles.bullet}>{ordered ? `${i + 1}.` : "•"}</Text>
          <Text style={styles.liText}>{it}</Text>
        </View>
      ))}
    </View>
  );
}

function Locked({ teaser, price }: { teaser?: string; price: string }) {
  const colors = useColors();
  const styles = useThemedStyles(makeStyles);
  const router = useRouter();
  const site = API_BASE.replace(/\/$/, "");
  return (
    <View style={{ marginTop: 18 }}>
      {!!teaser && <Text style={styles.p}>{teaser}</Text>}
      <View style={styles.lockCard}>
        <View style={styles.lockBadge}><Text style={styles.lockBadgeText}>Full breakdown locked</Text></View>
        <Text style={styles.lockTitle}>Unlock the full evaluation{price ? ` — ${price}` : ""}</Text>
        <Text style={styles.lockSub}>Size, movement, effort, strengths, areas to improve, recruiting targets and a final projection.</Text>
        <View style={{ marginTop: 10, gap: 6 }}>
          <Text style={styles.step}>1. Pay{price ? ` ${price}` : ""} via CashApp or PayPal.</Text>
          <Text style={styles.step}>2. Include the player&apos;s name and your sign-in email.</Text>
          <Text style={styles.step}>3. Coach unlocks it to your account.</Text>
        </View>
        <View style={styles.lockBtns}>
          <Pressable onPress={() => router.push("/membership" as never)} style={styles.primaryBtn}><Text style={styles.primaryBtnText}>Payment options</Text></Pressable>
          <Pressable onPress={() => site && router.push(`/web?url=${encodeURIComponent(`${site}/contact`)}&title=Contact` as never)} style={styles.ghostBtn}><Text style={styles.ghostBtnText}>Contact Coach</Text></Pressable>
        </View>
      </View>
    </View>
  );
}

const makeStyles = (colors: ThemeColors) => StyleSheet.create({
  topbar: { height: 48, flexDirection: "row", alignItems: "center", paddingHorizontal: 14, borderBottomWidth: 1, borderBottomColor: colors.lineSoft },
  back: { flexDirection: "row", alignItems: "center", gap: 6, flex: 1 },
  backChevron: { fontFamily: fonts.medium, fontSize: 24, color: colors.cream, marginTop: -3 },
  backText: { fontFamily: fonts.semibold, fontSize: 15, color: colors.cream, flexShrink: 1 },

  kick: { fontFamily: fonts.bold, fontSize: 10.5, letterSpacing: 2, color: colors.amber, textTransform: "uppercase" },
  h1: { fontFamily: fonts.display, fontSize: 26, color: colors.cream, letterSpacing: -0.8, marginTop: 8 },
  meta: { fontFamily: fonts.body, fontSize: 12.5, color: colors.muted, marginTop: 6 },
  date: { fontFamily: fonts.body, fontSize: 12, color: colors.dim, marginBottom: 16 },

  loading: { paddingVertical: 50, alignItems: "center" },
  none: { fontFamily: fonts.body, fontSize: 13.5, color: colors.muted, marginTop: 24 },

  sec: { marginBottom: 18 },
  secTitle: { fontFamily: fonts.bold, fontSize: 15, color: colors.cream, marginBottom: 7 },
  p: { fontFamily: fonts.body, fontSize: 13.5, lineHeight: 21, color: "#d8d2c9", marginBottom: 10 },
  li: { flexDirection: "row", gap: 8, marginBottom: 6 },
  bullet: { fontFamily: fonts.body, fontSize: 13, color: colors.amber, width: 18 },
  liText: { flex: 1, fontFamily: fonts.body, fontSize: 13, lineHeight: 20, color: "#d8d2c9" },
  projWrap: { borderTopWidth: 1, borderTopColor: colors.lineSoft, paddingTop: 14, marginTop: 4 },
  proj: { fontFamily: fonts.body, fontSize: 14, color: colors.cream },
  projLabel: { fontFamily: fonts.bold },

  lockCard: { marginTop: 14, borderWidth: 1, borderColor: colors.line, borderRadius: 16, backgroundColor: colors.surface2, padding: 18 },
  lockBadge: { alignSelf: "flex-start", backgroundColor: "rgba(200,169,107,0.14)", borderRadius: 999, paddingVertical: 6, paddingHorizontal: 13, marginBottom: 12 },
  lockBadgeText: { fontFamily: fonts.bold, fontSize: 11, color: colors.amber },
  lockTitle: { fontFamily: fonts.bold, fontSize: 16, color: colors.cream, marginBottom: 8 },
  lockSub: { fontFamily: fonts.body, fontSize: 12.5, lineHeight: 19, color: colors.muted },
  step: { fontFamily: fonts.body, fontSize: 12.5, lineHeight: 19, color: "#cfc8be" },
  lockBtns: { flexDirection: "row", gap: 8, marginTop: 16 },
  primaryBtn: { backgroundColor: colors.amber, borderRadius: 999, paddingVertical: 10, paddingHorizontal: 16 },
  primaryBtnText: { fontFamily: fonts.bold, fontSize: 12.5, color: colors.onAccent },
  ghostBtn: { borderWidth: 1, borderColor: colors.line, borderRadius: 999, paddingVertical: 10, paddingHorizontal: 16 },
  ghostBtnText: { fontFamily: fonts.semibold, fontSize: 12.5, color: colors.cream },
});
