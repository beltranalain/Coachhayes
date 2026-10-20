// Generic in-app browser. Opens a website page INSIDE the app (themed header +
// back) instead of kicking the user out to the phone's browser via
// Linking.openURL. Used for the few flows that still live on the web (checkout,
// contact). Params: url (required), title (optional header label).

import React, { useRef, useState } from "react";
import { View, Text, Pressable, StyleSheet, ActivityIndicator } from "react-native";
import { WebView } from "react-native-webview";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Feather } from "@expo/vector-icons";
import { fonts, type ThemeColors } from "../lib/theme";
import { useColors, useThemedStyles } from "../lib/ThemeContext";

export default function WebScreen() {
  const colors = useColors();
  const styles = useThemedStyles(makeStyles);
  const { url, title } = useLocalSearchParams<{ url: string; title?: string }>();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const [loading, setLoading] = useState(true);
  const ref = useRef<WebView>(null);

  const target = decodeURIComponent(String(url || ""));

  return (
    <View style={[styles.root, { paddingTop: insets.top }]}>
      <View style={styles.bar}>
        <Pressable onPress={() => router.back()} hitSlop={12} style={styles.close}>
          <Feather name="chevron-left" size={22} color={colors.cream} />
        </Pressable>
        <Text style={styles.title} numberOfLines={1}>{title ? decodeURIComponent(String(title)) : "Coach Hayes Football"}</Text>
      </View>

      <View style={{ flex: 1 }}>
        {target ? (
          <WebView
            ref={ref}
            source={{ uri: target }}
            style={{ flex: 1, backgroundColor: colors.bg }}
            onLoadEnd={() => setLoading(false)}
            originWhitelist={["*"]}
            javaScriptEnabled
            domStorageEnabled
            allowsInlineMediaPlayback
            sharedCookiesEnabled
            thirdPartyCookiesEnabled
          />
        ) : (
          <View style={styles.center}><Text style={styles.err}>No page to show.</Text></View>
        )}
        {loading && target ? (
          <View style={styles.loadWrap} pointerEvents="none">
            <ActivityIndicator color={colors.amber} />
          </View>
        ) : null}
      </View>
    </View>
  );
}

const makeStyles = (colors: ThemeColors) => StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.bg },
  bar: { height: 48, flexDirection: "row", alignItems: "center", gap: 6, paddingHorizontal: 10, borderBottomWidth: 1, borderBottomColor: colors.line },
  close: { width: 34, height: 34, borderRadius: 17, alignItems: "center", justifyContent: "center" },
  title: { flex: 1, fontFamily: fonts.semibold, fontSize: 15, color: colors.cream },
  center: { flex: 1, alignItems: "center", justifyContent: "center" },
  err: { fontFamily: fonts.body, fontSize: 14, color: colors.muted },
  loadWrap: { position: "absolute", top: 0, left: 0, right: 0, bottom: 0, alignItems: "center", justifyContent: "center" },
});
