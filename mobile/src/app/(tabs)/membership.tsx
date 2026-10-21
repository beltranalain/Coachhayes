// MEMBERSHIP — YouTube-first. New members join on Coach's YouTube channel (his
// tiers + billing live there), then link their account for site/app/Discord
// perks. Joining + Google linking must open EXTERNALLY (YouTube membership and
// Google OAuth don't work inside an in-app WebView, and this keeps the app clear
// of in-app-purchase store rules).

import React from "react";
import { View, Text, StyleSheet, ScrollView, Pressable, Linking } from "react-native";
import { colors, fonts, type ThemeColors } from "../../lib/theme";
import { useColors, useThemedStyles } from "../../lib/ThemeContext";
import { API_BASE } from "../../lib/config";

const YT_JOIN_URL = "https://www.youtube.com/@CoachHayesFootball/join";

const TIERS = [
  { name: "Po' Lil Timmy", price: "$5", per: "/mo", hot: false, perks: ["Members' rooms", "Priority film review", "Supporter badge"] },
  { name: "The Coordinator", price: "$15", per: "/mo", hot: true, perks: ["Everything in Timmy", "The Film Room unlocked", "Front-of-line evaluations"] },
];

export default function MembershipScreen() {
  const colors = useColors();
  const styles = useThemedStyles(makeStyles);
  const site = API_BASE.replace(/\/$/, "");

  function joinOnYouTube() {
    Linking.openURL(YT_JOIN_URL).catch(() => {});
  }
  function linkMembership() {
    // Linking uses Google sign-in, which only works in a real browser — open the
    // website's membership page externally to complete it.
    if (site) Linking.openURL(`${site}/membership`).catch(() => {});
  }

  return (
    <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: 30 }}>
      <Text style={styles.h1}>Join the locker room.</Text>
      <Text style={styles.sub}>Become a member on YouTube, then link your account so your perks carry over here and on Discord.</Text>

      {TIERS.map((t) => (
        <View key={t.name} style={[styles.tier, t.hot && styles.tierHot]}>
          {t.hot && <View style={styles.badge}><Text style={styles.badgeText}>Most popular</Text></View>}
          <Text style={styles.name}>{t.name}</Text>
          <Text style={styles.price}>{t.price}<Text style={styles.per}> {t.per}</Text></Text>
          <View style={{ gap: 7, marginTop: 10, marginBottom: 14 }}>
            {t.perks.map((p) => (
              <View key={p} style={styles.perkRow}>
                <View style={styles.perkDot} /><Text style={styles.perk}>{p}</Text>
              </View>
            ))}
          </View>
          <Pressable onPress={joinOnYouTube} style={({ pressed }) => [t.hot ? styles.btnHot : styles.btn, pressed && { opacity: 0.9 }]}>
            <Text style={[t.hot ? styles.btnHotText : styles.btnText]}>Join on YouTube</Text>
          </Pressable>
        </View>
      ))}

      <Pressable onPress={linkMembership} style={({ pressed }) => [styles.linkRow, pressed && { opacity: 0.85 }]}>
        <Text style={styles.linkText}>Already a YouTube member? Link it ›</Text>
      </Pressable>
      <Text style={styles.note}>Membership is handled by YouTube. Linking carries your perks to the site, app and Discord at no extra cost.</Text>
    </ScrollView>
  );
}

const makeStyles = (colors: ThemeColors) => StyleSheet.create({
  h1: { fontFamily: fonts.display, fontSize: 26, color: colors.cream, letterSpacing: -0.8, marginTop: 12 },
  sub: { fontFamily: fonts.body, fontSize: 13, color: colors.muted, marginTop: 9, marginBottom: 16 },
  tier: { borderWidth: 1, borderColor: colors.line, borderRadius: 20, padding: 18, marginBottom: 13, backgroundColor: colors.surface },
  tierHot: { borderColor: colors.amber },
  badge: { alignSelf: "flex-start", backgroundColor: "rgba(200,169,107,0.16)", borderRadius: 999, paddingVertical: 3, paddingHorizontal: 11, marginBottom: 9 },
  badgeText: { fontFamily: fonts.bold, fontSize: 11, color: colors.amber },
  name: { fontFamily: fonts.bold, fontSize: 16, color: colors.cream },
  price: { fontFamily: fonts.display, fontSize: 30, color: colors.cream, marginTop: 5 },
  per: { fontFamily: fonts.body, fontSize: 12.5, color: colors.muted },
  perkRow: { flexDirection: "row", alignItems: "center", gap: 9 },
  perkDot: { width: 5, height: 5, borderRadius: 3, backgroundColor: colors.amber },
  perk: { fontFamily: fonts.body, fontSize: 12.5, color: colors.cream },
  btn: { borderWidth: 1, borderColor: colors.line, borderRadius: 999, paddingVertical: 12, alignItems: "center" },
  btnText: { fontFamily: fonts.bold, fontSize: 13.5, color: colors.cream },
  btnHot: { backgroundColor: colors.amber, borderRadius: 999, paddingVertical: 12, alignItems: "center" },
  btnHotText: { fontFamily: fonts.bold, fontSize: 13.5, color: colors.onAccent },
  linkRow: { alignItems: "center", paddingVertical: 12, marginTop: 2 },
  linkText: { fontFamily: fonts.bold, fontSize: 13.5, color: colors.amber },
  note: { fontFamily: fonts.body, fontSize: 11.5, color: colors.dim, marginTop: 8, textAlign: "center" },
});
