// Lightweight tab icons drawn with plain Views (no SVG dependency needed).
// Each is a minimal glyph that echoes the mockup's menu icons.

import React from "react";
import { View, type ColorValue } from "react-native";

type Props = { color: ColorValue; size?: number };

export function LiveIcon({ color, size = 22 }: Props) {
  // concentric broadcast arcs + a center dot
  const s = size;
  return (
    <View style={{ width: s, height: s, alignItems: "center", justifyContent: "center" }}>
      <View style={{ width: s * 0.8, height: s * 0.4, borderColor: color, borderWidth: 2, borderBottomWidth: 0, borderTopLeftRadius: s, borderTopRightRadius: s, position: "absolute", top: s * 0.12 }} />
      <View style={{ width: s * 0.46, height: s * 0.23, borderColor: color, borderWidth: 2, borderBottomWidth: 0, borderTopLeftRadius: s, borderTopRightRadius: s, position: "absolute", top: s * 0.28 }} />
      <View style={{ width: s * 0.24, height: s * 0.24, borderRadius: s, backgroundColor: color, position: "absolute", bottom: s * 0.1 }} />
    </View>
  );
}

export function ShowsIcon({ color, size = 22 }: Props) {
  const cell = size * 0.38;
  const gap = size * 0.14;
  const Box = () => (
    <View style={{ width: cell, height: cell, borderRadius: 3, borderWidth: 2, borderColor: color }} />
  );
  return (
    <View style={{ width: size, height: size, justifyContent: "center", gap }}>
      <View style={{ flexDirection: "row", gap }}>
        <Box />
        <Box />
      </View>
      <View style={{ flexDirection: "row", gap }}>
        <Box />
        <Box />
      </View>
    </View>
  );
}

export function ScheduleIcon({ color, size = 22 }: Props) {
  return (
    <View style={{ width: size, height: size, alignItems: "center", justifyContent: "center" }}>
      <View style={{ width: size * 0.85, height: size * 0.75, borderWidth: 2, borderColor: color, borderRadius: 4 }} />
      <View style={{ position: "absolute", top: size * 0.34, width: size * 0.85, height: 2, backgroundColor: color }} />
      <View style={{ position: "absolute", top: size * 0.02, left: size * 0.28, width: 2, height: size * 0.16, backgroundColor: color }} />
      <View style={{ position: "absolute", top: size * 0.02, right: size * 0.28, width: 2, height: size * 0.16, backgroundColor: color }} />
    </View>
  );
}

export function ArchiveIcon({ color, size = 22 }: Props) {
  return (
    <View style={{ width: size, height: size, alignItems: "center", justifyContent: "center", gap: size * 0.12 }}>
      <View style={{ width: size * 0.8, height: size * 0.28, transform: [{ rotate: "0deg" }], borderWidth: 2, borderColor: color, borderRadius: 2 }} />
      <View style={{ width: size * 0.62, height: 2, backgroundColor: color }} />
      <View style={{ width: size * 0.62, height: 2, backgroundColor: color }} />
    </View>
  );
}
