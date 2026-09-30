// Small reusable, themed building blocks that recreate the mockup's look:
// gradient "art wells", pill buttons, cards, eyebrows and amber CTAs.

import React from "react";
import {
  View,
  Text,
  Pressable,
  StyleSheet,
  type ViewStyle,
  type TextStyle,
  type StyleProp,
} from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { colors, radii, fonts, wells, type WellName } from "../lib/theme";

// ---- Art well ---------------------------------------------------------------
// Emulates the web ::before radial gradients by layering two diagonal
// LinearGradients plus a bottom vignette, all clipped to a rounded box.
export function ArtWell({
  well = "amber",
  style,
  children,
  radius = radii.lg,
}: {
  well?: WellName;
  style?: StyleProp<ViewStyle>;
  children?: React.ReactNode;
  radius?: number;
}) {
  const w = wells[well];
  return (
    <View style={[{ backgroundColor: w.base, borderRadius: radius, overflow: "hidden" }, style]}>
      {/* top-left glow */}
      <LinearGradient
        colors={[w.a, "transparent"]}
        start={{ x: 0.15, y: 0.1 }}
        end={{ x: 0.9, y: 0.9 }}
        style={StyleSheet.absoluteFill}
      />
      {/* bottom-right secondary hue */}
      <LinearGradient
        colors={["transparent", w.b]}
        start={{ x: 0.2, y: 0.2 }}
        end={{ x: 0.9, y: 1 }}
        style={[StyleSheet.absoluteFill, { opacity: 0.85 }]}
      />
      {/* bottom vignette so text sits legibly */}
      <LinearGradient
        colors={["rgba(10,9,8,0.1)", "rgba(10,9,8,0.45)", "rgba(10,9,8,0.9)"]}
        start={{ x: 0.5, y: 0 }}
        end={{ x: 0.5, y: 1 }}
        style={StyleSheet.absoluteFill}
      />
      {children}
    </View>
  );
}

// ---- Text helpers -----------------------------------------------------------
export function Eyebrow({ children, dim, style }: { children: React.ReactNode; dim?: boolean; style?: StyleProp<TextStyle> }) {
  return <Text style={[styles.eyebrow, dim && { color: colors.dim }, style]}>{children}</Text>;
}

export function Display({ children, style }: { children: React.ReactNode; style?: StyleProp<TextStyle> }) {
  return <Text style={[styles.display, style]}>{children}</Text>;
}

export function Body({ children, style }: { children: React.ReactNode; style?: StyleProp<TextStyle> }) {
  return <Text style={[styles.body, style]}>{children}</Text>;
}

// ---- Card -------------------------------------------------------------------
export function Card({ children, style }: { children: React.ReactNode; style?: StyleProp<ViewStyle> }) {
  return <View style={[styles.card, style]}>{children}</View>;
}

// ---- Pills / buttons --------------------------------------------------------
export function Pill({
  label,
  onPress,
  active,
  icon,
}: {
  label: string;
  onPress?: () => void;
  active?: boolean;
  icon?: React.ReactNode;
}) {
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [
        styles.pill,
        active && styles.pillActive,
        pressed && { transform: [{ scale: 0.96 }] },
      ]}
    >
      {icon}
      <Text style={[styles.pillText, active && { color: "#1a1205" }]}>{label}</Text>
    </Pressable>
  );
}

export function AmberButton({
  label,
  onPress,
  disabled,
}: {
  label: string;
  onPress?: () => void;
  disabled?: boolean;
}) {
  return (
    <Pressable onPress={onPress} disabled={disabled} style={({ pressed }) => [{ opacity: disabled ? 0.6 : 1 }, pressed && { transform: [{ scale: 0.98 }] }]}>
      <LinearGradient
        colors={[colors.highlight, colors.amber]}
        start={{ x: 0, y: 0 }}
        end={{ x: 0, y: 1 }}
        style={styles.amberBtn}
      >
        <Text style={styles.amberBtnText}>{label}</Text>
      </LinearGradient>
    </Pressable>
  );
}

export function OutlineAmberButton({
  label,
  onPress,
  icon,
}: {
  label: string;
  onPress?: () => void;
  icon?: React.ReactNode;
}) {
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [styles.outlineBtn, pressed && { transform: [{ scale: 0.98 }], backgroundColor: "rgba(245,165,36,0.14)" }]}
    >
      {icon}
      <Text style={styles.outlineBtnText}>{label}</Text>
    </Pressable>
  );
}

export function Dot({ color = colors.dim, glow }: { color?: string; glow?: boolean }) {
  return (
    <View
      style={{
        width: 7,
        height: 7,
        borderRadius: 4,
        backgroundColor: color,
        ...(glow ? { shadowColor: color, shadowOpacity: 0.8, shadowRadius: 6, elevation: 4 } : null),
      }}
    />
  );
}

const styles = StyleSheet.create({
  eyebrow: {
    fontFamily: fonts.bold,
    fontSize: 10.5,
    letterSpacing: 2,
    color: colors.amber,
    textTransform: "uppercase",
  },
  display: {
    fontFamily: fonts.display,
    color: colors.cream,
    textTransform: "uppercase",
    fontSize: 34,
    lineHeight: 34,
  },
  body: {
    fontFamily: fonts.body,
    fontSize: 13,
    color: colors.muted,
    lineHeight: 20,
  },
  card: {
    backgroundColor: colors.surface,
    borderColor: colors.lineSoft,
    borderWidth: 1,
    borderRadius: radii.lg,
    overflow: "hidden",
  },
  pill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 7,
    borderRadius: radii.pill,
    borderWidth: 1,
    borderColor: colors.line,
    backgroundColor: colors.surface,
    paddingVertical: 9,
    paddingHorizontal: 14,
  },
  pillActive: { backgroundColor: colors.amber, borderColor: colors.amber },
  pillText: { fontFamily: fonts.semibold, fontSize: 12, color: colors.cream },
  amberBtn: {
    borderRadius: 14,
    paddingVertical: 15,
    alignItems: "center",
    justifyContent: "center",
  },
  amberBtnText: { fontFamily: fonts.bold, fontSize: 15, color: "#1a1205" },
  outlineBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 9,
    borderRadius: 14,
    backgroundColor: "rgba(245,165,36,0.06)",
    borderWidth: 1.5,
    borderColor: "rgba(245,165,36,0.55)",
    paddingVertical: 14,
  },
  outlineBtnText: { fontFamily: fonts.bold, fontSize: 14, color: colors.amber },
});
