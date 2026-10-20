// Clean app bar (matches the mock): the brand (logo + wordmark) on the left and
// a single menu button on the right. Account / sign-in now live inside the menu,
// so the header stays uncluttered.

import React from "react";
import { View, Text, Pressable, StyleSheet } from "react-native";
import { Image } from "expo-image";
import { LinearGradient } from "expo-linear-gradient";
import { Feather } from "@expo/vector-icons";
import { colors, fonts, type ThemeColors } from "../lib/theme";
import { useColors, useThemedStyles, useTheme } from "../lib/ThemeContext";
import { useBranding } from "../lib/branding";
import { useMenu } from "./FloatingMenu";

export function ScreenHeader() {
  const colors = useColors();
  const styles = useThemedStyles(makeStyles);
  const { mode, setMode } = useTheme();
  const { toggle } = useMenu();
  const { logo, siteName } = useBranding();

  return (
    <View style={styles.bar}>
      <View style={styles.brand}>
        {logo ? (
          <Image source={{ uri: logo }} style={styles.logo} contentFit="contain" transition={150} accessibilityLabel={siteName} />
        ) : (
          <LinearGradient colors={["#2a2520", "#120d06"]} style={styles.logoTile}>
            <Text style={styles.logoMark}>CH</Text>
          </LinearGradient>
        )}
        <Text style={styles.wordmark} numberOfLines={1}>{siteName || "Coach Hayes Football"}</Text>
      </View>

      <View style={styles.right}>
        <Pressable
          onPress={() => setMode(mode === "light" ? "dark" : mode === "dark" ? "system" : "light")}
          hitSlop={8}
          accessibilityLabel={`Theme: ${mode}. Tap to change.`}
          style={({ pressed }) => [styles.themeBtn, pressed && { opacity: 0.7 }]}
        >
          <Feather name={mode === "light" ? "sun" : mode === "dark" ? "moon" : "smartphone"} size={16} color={colors.cream} />
        </Pressable>

        <Pressable onPress={toggle} hitSlop={8} accessibilityLabel="Menu" style={({ pressed }) => [styles.menuBtn, pressed && { opacity: 0.7 }]}>
          <View style={styles.hbar} />
          <View style={styles.hbar} />
          <View style={styles.hbar} />
        </Pressable>
      </View>
    </View>
  );
}

const makeStyles = (colors: ThemeColors) => StyleSheet.create({
  bar: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingBottom: 12,
    paddingTop: 6,
    borderBottomWidth: 1,
    borderBottomColor: colors.lineSoft,
    backgroundColor: colors.bg,
  },
  brand: { flexDirection: "row", alignItems: "center", gap: 9, flex: 1, minWidth: 0 },
  logo: { width: 30, height: 30, borderRadius: 15 },
  logoTile: { width: 30, height: 30, borderRadius: 15, borderWidth: 1, borderColor: "rgba(200,169,107,0.4)", alignItems: "center", justifyContent: "center" },
  logoMark: { fontFamily: fonts.bold, color: colors.amber, fontSize: 11 },
  wordmark: { fontFamily: fonts.bold, fontSize: 15, color: colors.cream, letterSpacing: -0.4, flexShrink: 1 },
  menuBtn: {
    width: 40, height: 40, borderRadius: 11, alignItems: "center", justifyContent: "center", gap: 4,
    borderWidth: 1, borderColor: colors.lineSoft, backgroundColor: colors.surface, flexShrink: 0,
  },
  hbar: { width: 17, height: 2, borderRadius: 2, backgroundColor: colors.cream },
  right: { flexDirection: "row", alignItems: "center", gap: 4, flexShrink: 0 },
  themeBtn: { width: 34, height: 40, alignItems: "center", justifyContent: "center" },
});
