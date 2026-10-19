// Full-screen highlight player. A WebView inside a React Native Modal renders
// blank / won't play on Android, so video playback lives on its own route and
// the board/feed navigate here instead.

import React from "react";
import { View, Text, Pressable, StyleSheet, useWindowDimensions } from "react-native";
import { WebView } from "react-native-webview";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Feather } from "@expo/vector-icons";
import { colors, fonts } from "../lib/theme";

export default function WatchScreen() {
  const { id, name } = useLocalSearchParams<{ id: string; name?: string }>();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();

  return (
    <View style={[styles.root, { paddingTop: insets.top }]}>
      <View style={styles.bar}>
        <Pressable onPress={() => router.back()} hitSlop={12} style={styles.close}>
          <Feather name="x" size={20} color="#fff" />
        </Pressable>
        <Text style={styles.title} numberOfLines={1}>{name ? decodeURIComponent(String(name)) : "Highlight film"}</Text>
      </View>

      <View style={styles.center}>
        <View style={{ width: "100%", height: width * 9 / 16, backgroundColor: "#000" }}>
          <WebView
            source={{ uri: `https://www.youtube.com/embed/${id}?autoplay=1&playsinline=1&rel=0&modestbranding=1` }}
            style={{ flex: 1, backgroundColor: "#000" }}
            originWhitelist={["*"]}
            allowsInlineMediaPlayback
            mediaPlaybackRequiresUserAction={false}
            javaScriptEnabled
            domStorageEnabled
            allowsFullscreenVideo
          />
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: "#000" },
  bar: { height: 48, flexDirection: "row", alignItems: "center", gap: 12, paddingHorizontal: 14 },
  close: { width: 34, height: 34, borderRadius: 17, alignItems: "center", justifyContent: "center", backgroundColor: "rgba(255,255,255,0.12)" },
  title: { flex: 1, fontFamily: fonts.semibold, fontSize: 14, color: "#fff" },
  center: { flex: 1, justifyContent: "center" },
});
