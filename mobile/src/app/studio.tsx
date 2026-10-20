// GO LIVE (Studio) — NATIVE host broadcast. In a dev build / production app this
// renders the native WebRTC broadcaster (camera -> Cloudflare WHIP, no browser,
// no website). In Expo Go — which can't access the camera for live capture — it
// shows a native "install the app" message instead of any web content.

import React from "react";
import { View, Text, Pressable, StyleSheet } from "react-native";
import { useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Feather } from "@expo/vector-icons";

import { fonts, radii, type ThemeColors } from "../lib/theme";
import { useColors, useThemedStyles } from "../lib/ThemeContext";
import { IS_EXPO_GO } from "../lib/env";

export default function StudioScreen() {
  const colors = useColors();
  const styles = useThemedStyles(makeStyles);
  const router = useRouter();
  const insets = useSafeAreaInsets();

  // Expo Go can't capture the camera for live streaming — show a native notice,
  // never web content. The real broadcaster runs in the installed dev build.
  if (IS_EXPO_GO) {
    return (
      <View style={styles.root}>
        <View style={[styles.topBar, { paddingTop: insets.top + 8 }]}>
          <Text style={styles.title}>Go Live</Text>
          <Pressable onPress={() => router.back()} hitSlop={10} style={({ pressed }) => [styles.doneBtn, pressed && { opacity: 0.75 }]}>
            <Text style={styles.doneText}>Done</Text>
          </Pressable>
        </View>
        <View style={styles.center}>
          <View style={styles.iconWrap}><Feather name="video" size={30} color={colors.amber} /></View>
          <Text style={styles.h}>Go live from the installed app</Text>
          <Text style={styles.p}>
            Broadcasting uses your phone&apos;s camera, which the Expo Go sandbox can&apos;t open for live
            streaming. Install the app (dev build) and open Go Live there to broadcast straight from your
            phone — fully native, no website.
          </Text>
        </View>
      </View>
    );
  }

  // Dev build / production: load the native broadcaster lazily so Expo Go never
  // evaluates the react-native-webrtc native module.
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const LiveBroadcaster = require("../components/LiveBroadcaster").default as React.ComponentType<{ onClose: () => void }>;
  return <LiveBroadcaster onClose={() => router.back()} />;
}

const makeStyles = (colors: ThemeColors) => StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.bg },
  topBar: {
    flexDirection: "row", alignItems: "center", justifyContent: "space-between",
    paddingHorizontal: 16, paddingBottom: 12, borderBottomWidth: 1, borderBottomColor: colors.lineSoft, backgroundColor: colors.bg,
  },
  title: { fontFamily: fonts.display, fontSize: 24, color: colors.cream, textTransform: "uppercase" },
  doneBtn: { borderRadius: radii.pill, borderWidth: 1, borderColor: colors.line, backgroundColor: colors.surface, paddingVertical: 8, paddingHorizontal: 16 },
  doneText: { fontFamily: fonts.bold, fontSize: 13, color: colors.cream },
  center: { flex: 1, alignItems: "center", justifyContent: "center", paddingHorizontal: 32, gap: 14 },
  iconWrap: { width: 64, height: 64, borderRadius: 20, alignItems: "center", justifyContent: "center", backgroundColor: colors.surface2, borderWidth: 1, borderColor: colors.line },
  h: { fontFamily: fonts.display, fontSize: 21, color: colors.cream, textAlign: "center", letterSpacing: -0.4 },
  p: { fontFamily: fonts.body, fontSize: 13.5, color: colors.muted, textAlign: "center", lineHeight: 21 },
});
