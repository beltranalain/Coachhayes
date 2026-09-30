// GO LIVE (Studio) — the NATIVE host broadcast screen (Phase 3 of app/web parity).
//
// Rather than re-implementing the web studio natively, this screen embeds the
// full web studio (`${API_BASE}/admin/go-live`) inside a <WebView>. The host
// broadcasts straight from the app: the page runs getUserMedia in the WebView
// and pushes to Cloudflare exactly as it does in a desktop browser. Firebase web
// auth persists via DOM storage + cookies, so a sign-in inside the studio sticks.
//
// Reachability is admin-only via FloatingMenu (isAdminEmail). This screen itself
// does not re-gate — the menu entry is the gate — but it shows the signed-in
// admin nothing sensitive; the web page enforces its own admin auth.
//
// WEBVIEW MEDIA/PERMISSION NOTES (react-native-webview 13.16.1):
//   - iOS  (WKWebView): getUserMedia is allowed by `mediaCapturePermissionGrantType="grant"`
//     combined with the NSCamera/NSMicrophone usage strings (added in app.json Phase 2).
//   - Android: this version has NO `onPermissionRequest` prop. The library's
//     internal WebChromeClient auto-grants the page's camera/mic request once the
//     app itself holds the OS CAMERA + RECORD_AUDIO permissions (declared in
//     app.json Phase 2). `allowsProtectedMedia` + hardware layer keep video smooth.
//   - Screen-share (getDisplayMedia) is not available in a mobile WebView.

import React, { useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  Pressable,
  ActivityIndicator,
  Platform,
} from "react-native";
import { WebView } from "react-native-webview";
import { useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { colors, fonts, radii } from "../lib/theme";
import { API_BASE } from "../lib/config";
import { IS_EXPO_GO } from "../lib/env";

const STUDIO_URL = `${API_BASE}/admin/go-live`;

export default function StudioScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const [loading, setLoading] = useState(true);

  return (
    <View style={styles.root}>
      {/* Top bar — this is a modal, so a Done/close button + title. */}
      <View style={[styles.topBar, { paddingTop: insets.top + 8 }]}>
        <Text style={styles.title}>Go Live</Text>
        <Pressable
          onPress={() => router.back()}
          hitSlop={10}
          accessibilityLabel="Close the studio"
          style={({ pressed }) => [styles.doneBtn, pressed && { opacity: 0.75 }]}
        >
          <Text style={styles.doneText}>Done</Text>
        </Pressable>
      </View>

      {/* Expo Go can load the WebView, but live camera capture needs the dev
          build (Expo Go lacks the camera usage config). Do NOT block — just note it. */}
      {IS_EXPO_GO && (
        <View style={styles.banner}>
          <Text style={styles.bannerText}>
            Camera/mic in the studio needs the installed app (dev build).
          </Text>
        </View>
      )}

      {/* On-brand UX notes: first-time sign-in + no screen-share on mobile. */}
      <View style={styles.notes}>
        <Text style={styles.noteText}>
          First time here you may need to sign in inside the studio. Screen-share
          isn&apos;t available on mobile.
        </Text>
      </View>

      <View style={styles.webWrap}>
        <WebView
          source={{ uri: STUDIO_URL }}
          style={styles.web}
          // Core web app + Firebase web auth persistence.
          javaScriptEnabled
          domStorageEnabled
          // Live camera/mic capture in-page, no user gesture required.
          allowsInlineMediaPlayback
          mediaPlaybackRequiresUserAction={false}
          // iOS: grant getUserMedia (usage strings present in app.json).
          mediaCapturePermissionGrantType="grant"
          // Android: keep DRM/protected media working + smooth video.
          allowsProtectedMedia
          androidLayerType="hardware"
          // Keep the Firebase session across launches.
          thirdPartyCookiesEnabled
          sharedCookiesEnabled={Platform.OS === "ios"}
          allowsFullscreenVideo
          onLoadEnd={() => setLoading(false)}
        />
        {loading && (
          <View style={styles.loading} pointerEvents="none">
            <ActivityIndicator color={colors.amber} />
            <Text style={styles.loadingText}>Opening the studio…</Text>
          </View>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.bg },
  topBar: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: colors.lineSoft,
    backgroundColor: colors.bg,
  },
  title: {
    fontFamily: fonts.display,
    fontSize: 24,
    color: colors.cream,
    textTransform: "uppercase",
  },
  doneBtn: {
    borderRadius: radii.pill,
    borderWidth: 1,
    borderColor: colors.line,
    backgroundColor: colors.surface,
    paddingVertical: 8,
    paddingHorizontal: 16,
  },
  doneText: { fontFamily: fonts.bold, fontSize: 13, color: colors.cream },
  banner: {
    backgroundColor: "rgba(245,165,36,0.1)",
    borderBottomWidth: 1,
    borderBottomColor: "rgba(245,165,36,0.35)",
    paddingHorizontal: 16,
    paddingVertical: 9,
  },
  bannerText: { fontFamily: fonts.semibold, fontSize: 12, color: colors.amber },
  notes: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: colors.lineSoft,
    backgroundColor: colors.bg,
  },
  noteText: { fontFamily: fonts.body, fontSize: 11.5, color: colors.muted, lineHeight: 17 },
  webWrap: { flex: 1, backgroundColor: colors.bgDeep },
  web: { flex: 1, backgroundColor: colors.bgDeep },
  loading: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    alignItems: "center",
    justifyContent: "center",
    gap: 10,
    backgroundColor: colors.bgDeep,
  },
  loadingText: { fontFamily: fonts.body, fontSize: 12.5, color: colors.muted },
});
