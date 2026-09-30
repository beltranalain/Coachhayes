// Branded app bar from the mockup:
//   [hamburger, top-left]  [centered: logo + site name wordmark]  [bell, top-right]
//
// The logo is the uploaded brand image from /api/site-config (branding.logo),
// exactly like the website's SiteHeader. It falls back to the amber mark tile
// only when no logo has been uploaded. The row uses flex so the top-right bell
// always fits inside the safe area (fixes the previous overflow/clipping).

import React from "react";
import { View, Text, Pressable, StyleSheet } from "react-native";
import { Image } from "expo-image";
import { LinearGradient } from "expo-linear-gradient";
import { useRouter } from "expo-router";
import { colors, fonts } from "../lib/theme";
import { useBranding } from "../lib/branding";
import { useAuth } from "../lib/auth";
import { useMenu } from "./FloatingMenu";

function HamburgerIcon() {
  return (
    <View style={{ width: 19, height: 14, justifyContent: "space-between" }}>
      <View style={styles.hbar} />
      <View style={styles.hbar} />
      <View style={styles.hbar} />
    </View>
  );
}

function BellIcon() {
  // Simple View-based bell glyph (dome + clapper) to avoid an SVG dependency.
  return (
    <View style={{ width: 18, height: 18, alignItems: "center", justifyContent: "center" }}>
      <View style={styles.bellDome} />
      <View style={styles.bellLip} />
      <View style={styles.bellClapper} />
    </View>
  );
}

export function ScreenHeader() {
  const { toggle } = useMenu();
  const { logo, siteName } = useBranding();
  const { user, displayName } = useAuth();
  const router = useRouter();

  return (
    <View style={styles.bar}>
      {/* Left: hamburger opens the floating menu */}
      <Pressable
        onPress={toggle}
        hitSlop={8}
        accessibilityLabel="Menu"
        style={({ pressed }) => [styles.iconBtn, pressed && { opacity: 0.7 }]}
      >
        <HamburgerIcon />
      </Pressable>

      {/* Center: uploaded logo (or fallback amber tile) + wordmark */}
      <View style={styles.brand}>
        {logo ? (
          <Image
            source={{ uri: logo }}
            style={styles.logoImg}
            contentFit="contain"
            transition={150}
            accessibilityLabel={siteName}
          />
        ) : (
          <LinearGradient colors={["#2a1f0e", "#120d06"]} style={styles.logoTile}>
            <Text style={styles.logoMark}>C</Text>
          </LinearGradient>
        )}
        <View style={styles.words}>
          <Text style={styles.wordmark} numberOfLines={1}>
            {siteName || "Your Studio"}
          </Text>
          <Text style={styles.sub}>{(siteName || "Your Studio").toUpperCase()}</Text>
        </View>
      </View>

      {/* Right: account affordance + notifications bell */}
      <View style={styles.right}>
        {user ? (
          <Pressable
            onPress={() => router.push("/signin")}
            hitSlop={8}
            accessibilityLabel={`Signed in as ${displayName}`}
            style={({ pressed }) => [styles.accountChip, pressed && { opacity: 0.7 }]}
          >
            <View style={styles.avatar}>
              <Text style={styles.avatarText}>
                {displayName.slice(0, 1).toUpperCase()}
              </Text>
            </View>
            <Text style={styles.accountName} numberOfLines={1}>
              {displayName}
            </Text>
          </Pressable>
        ) : (
          <Pressable
            onPress={() => router.push("/signin")}
            hitSlop={8}
            accessibilityLabel="Sign in"
            style={({ pressed }) => [styles.signInChip, pressed && { opacity: 0.7 }]}
          >
            <Text style={styles.signInText}>Sign in</Text>
          </Pressable>
        )}

        <Pressable
          hitSlop={8}
          accessibilityLabel="Notifications"
          style={({ pressed }) => [styles.iconBtn, pressed && { opacity: 0.7 }]}
        >
          <BellIcon />
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  bar: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 14,
    paddingBottom: 12,
    paddingTop: 6,
    borderBottomWidth: 1,
    borderBottomColor: colors.lineSoft,
    backgroundColor: colors.bg,
  },
  iconBtn: {
    width: 38,
    height: 38,
    borderRadius: 11,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: colors.lineSoft,
    backgroundColor: colors.surface,
    flexShrink: 0,
  },
  hbar: { height: 2.2, borderRadius: 2, backgroundColor: colors.muted },
  right: { flexDirection: "row", alignItems: "center", gap: 8, flexShrink: 0 },
  signInChip: {
    height: 38,
    borderRadius: 11,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 14,
    borderWidth: 1,
    borderColor: "rgba(245,165,36,0.55)",
    backgroundColor: "rgba(245,165,36,0.10)",
  },
  signInText: { fontFamily: fonts.bold, fontSize: 12, color: colors.amber },
  accountChip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 7,
    height: 38,
    maxWidth: 132,
    borderRadius: 11,
    paddingHorizontal: 8,
    borderWidth: 1,
    borderColor: colors.lineSoft,
    backgroundColor: colors.surface,
  },
  avatar: {
    width: 24,
    height: 24,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.amber,
  },
  avatarText: { fontFamily: fonts.bold, fontSize: 12, color: "#1a1205" },
  accountName: { fontFamily: fonts.semibold, fontSize: 12, color: colors.cream, flexShrink: 1 },
  brand: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 9,
    paddingHorizontal: 8,
  },
  words: { flexShrink: 1 },
  logoTile: {
    width: 34,
    height: 34,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: "rgba(245,165,36,0.35)",
    alignItems: "center",
    justifyContent: "center",
  },
  logoImg: { width: 34, height: 34, borderRadius: 10 },
  logoMark: { fontFamily: fonts.display, color: colors.amber, fontSize: 18 },
  wordmark: { fontFamily: fonts.semibold, fontSize: 12.5, color: colors.cream },
  wordmarkAccent: { color: colors.amber, fontFamily: fonts.bold },
  sub: { fontFamily: fonts.semibold, fontSize: 8.5, letterSpacing: 2, color: colors.dim, marginTop: 3 },
  bellDome: {
    width: 13,
    height: 11,
    borderWidth: 1.8,
    borderColor: colors.muted,
    borderBottomWidth: 0,
    borderTopLeftRadius: 9,
    borderTopRightRadius: 9,
    marginTop: 1,
  },
  bellLip: { width: 17, height: 1.8, backgroundColor: colors.muted, borderRadius: 2, marginTop: 0.5 },
  bellClapper: { width: 4, height: 4, borderRadius: 2, borderWidth: 1.8, borderColor: colors.muted, borderTopWidth: 0, marginTop: 0.5 },
});
