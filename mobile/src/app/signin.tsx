// Sign-in / sign-up against the SAME Firebase project as the website, so an
// account created here works on the site and vice-versa. Email + password plus
// "Continue with Google" (via expo-auth-session, matching the website). Shown as
// a modal.

import React, { useEffect, useState } from "react";
import {
  View,
  Text,
  TextInput,
  StyleSheet,
  Pressable,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
  Alert,
} from "react-native";
import { useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { FontAwesome } from "@expo/vector-icons";
import * as WebBrowser from "expo-web-browser";
import * as Google from "expo-auth-session/providers/google";
import { colors, fonts } from "../lib/theme";
import { useAuth } from "../lib/auth";
import { IS_EXPO_GO } from "../lib/env";
import {
  GOOGLE_WEB_CLIENT_ID,
  GOOGLE_IOS_CLIENT_ID,
  GOOGLE_ANDROID_CLIENT_ID,
} from "../lib/config";
import { AmberButton, Eyebrow, Display } from "../components/ui";

// Required by expo-auth-session so the auth popup can hand control back to the
// app when the OAuth redirect returns. Safe to call at module scope.
WebBrowser.maybeCompleteAuthSession();

// Google sign-in only actually completes in a dev/production build with the
// client IDs filled in. In Expo Go, or when the IDs are blank, we show an Alert.
const GOOGLE_READY = !IS_EXPO_GO && GOOGLE_WEB_CLIENT_ID.length > 0;

// Simple Google "G" mark. react-native-svg isn't a dependency, so this is a
// clean typographic mark in Google's blue on a white chip — recognizable and
// crash-free everywhere (no emoji, no native module).
// Google "G" mark via @expo/vector-icons (bundled in Expo Go + dev builds; no
// native/bundler issues). Rendered in Google blue on the white button.
function GoogleG() {
  return <FontAwesome name="google" size={18} color="#4285F4" />;
}

export default function SignInScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { user, displayName, signIn, signUp, signInWithGoogleIdToken, logout } =
    useAuth();
  const [mode, setMode] = useState<"signin" | "signup">("signin");
  const [email, setEmail] = useState("");
  const [pw, setPw] = useState("");
  const [name, setName] = useState("");
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);

  // expo-auth-session Google provider. Passing empty client IDs is harmless —
  // we never call promptAsync() unless GOOGLE_READY, and we guard on `request`.
  const [request, response, promptAsync] = Google.useAuthRequest({
    webClientId: GOOGLE_WEB_CLIENT_ID,
    iosClientId: GOOGLE_IOS_CLIENT_ID,
    androidClientId: GOOGLE_ANDROID_CLIENT_ID,
  });

  // When the OAuth flow returns a token, exchange it for a Firebase session.
  useEffect(() => {
    if (response?.type !== "success") return;
    const idToken =
      response.params?.id_token ||
      (response.authentication?.idToken as string | undefined);
    if (!idToken) {
      setErr("Google sign-in did not return a token.");
      return;
    }
    (async () => {
      setErr("");
      setBusy(true);
      try {
        await signInWithGoogleIdToken(idToken);
        router.back();
      } catch {
        setErr("Google sign-in failed. Please try again.");
      } finally {
        setBusy(false);
      }
    })();
  }, [response]);

  async function onGoogle() {
    if (!GOOGLE_READY || !request) {
      Alert.alert(
        "Google sign-in",
        "Google sign-in works in the full app build. Set the Google client IDs in config to enable it."
      );
      return;
    }
    setErr("");
    try {
      await promptAsync();
    } catch {
      setErr("Could not start Google sign-in.");
    }
  }

  async function submit() {
    setErr("");
    setBusy(true);
    try {
      if (mode === "signup") {
        if (!name.trim()) throw new Error("name");
        await signUp(email, pw, name);
      } else {
        await signIn(email, pw);
      }
      router.back();
    } catch (e: any) {
      if (e?.message === "name") setErr("Pick a display name.");
      else setErr(mode === "signup" ? "Could not create the account (the email may already be in use)." : "Sign in failed. Check your email and password.");
    } finally {
      setBusy(false);
    }
  }

  if (user) {
    return (
      <View style={styles.wrap}>
        <View style={{ flex: 1, justifyContent: "center", gap: 14 }}>
          <Eyebrow>Signed in</Eyebrow>
          <Display style={{ fontSize: 30 }}>{displayName}</Display>
          <Text style={styles.sub}>{user.email}</Text>
          <View style={{ marginTop: 20 }}>
            <AmberButton label="Done" onPress={() => router.back()} />
          </View>
          <Pressable onPress={async () => { await logout(); }} style={{ paddingVertical: 14 }}>
            <Text style={styles.link}>Sign out</Text>
          </Pressable>
        </View>
      </View>
    );
  }

  return (
    <KeyboardAvoidingView style={{ flex: 1, backgroundColor: colors.bg }} behavior={Platform.OS === "ios" ? "padding" : undefined}>
      <ScrollView contentContainerStyle={[styles.wrap, { paddingTop: insets.top + 16 }]} keyboardShouldPersistTaps="handled">
        <View style={styles.headRow}>
          <View>
            <Eyebrow>{mode === "signup" ? "Create account" : "Welcome back"}</Eyebrow>
            <Display style={{ fontSize: 30, marginTop: 6 }}>
              {mode === "signup" ? "Join the chat" : "Sign in"}
            </Display>
          </View>
          <Pressable onPress={() => router.back()} style={styles.x}>
            <Text style={styles.xText}>✕</Text>
          </Pressable>
        </View>

        <Text style={styles.sub}>Same account as the website.</Text>

        <Pressable
          onPress={onGoogle}
          disabled={busy}
          style={({ pressed }) => [styles.googleBtn, pressed && { opacity: 0.85 }]}
        >
          <GoogleG />
          <Text style={styles.googleText}>Continue with Google</Text>
        </Pressable>

        <View style={styles.dividerRow}>
          <View style={styles.dividerLine} />
          <Text style={styles.dividerText}>or</Text>
          <View style={styles.dividerLine} />
        </View>

        <View style={{ gap: 12 }}>
          {mode === "signup" && (
            <TextInput
              value={name}
              onChangeText={setName}
              placeholder="Display name"
              placeholderTextColor={colors.dim}
              style={styles.field}
              maxLength={30}
            />
          )}
          <TextInput
            value={email}
            onChangeText={setEmail}
            placeholder="Email"
            placeholderTextColor={colors.dim}
            style={styles.field}
            autoCapitalize="none"
            keyboardType="email-address"
            autoComplete="email"
          />
          <TextInput
            value={pw}
            onChangeText={setPw}
            placeholder="Password"
            placeholderTextColor={colors.dim}
            style={styles.field}
            secureTextEntry
            autoComplete={mode === "signup" ? "new-password" : "current-password"}
          />
          {err ? <Text style={styles.err}>{err}</Text> : null}
          <AmberButton label={busy ? "…" : mode === "signup" ? "Create account" : "Sign in"} onPress={submit} disabled={busy} />
        </View>

        <Pressable
          onPress={() => {
            setMode(mode === "signup" ? "signin" : "signup");
            setErr("");
          }}
          style={{ paddingVertical: 18 }}
        >
          <Text style={styles.link}>
            {mode === "signup" ? "Have an account? Sign in" : "New here? Create an account"}
          </Text>
        </Pressable>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  wrap: { flexGrow: 1, backgroundColor: colors.bg, padding: 24, paddingTop: 40 },
  headRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start" },
  sub: { fontFamily: fonts.body, fontSize: 13, color: colors.muted, marginTop: 6 },
  field: {
    backgroundColor: colors.surface2,
    borderWidth: 1,
    borderColor: colors.lineSoft,
    borderRadius: 14,
    paddingVertical: 14,
    paddingHorizontal: 15,
    fontFamily: fonts.body,
    fontSize: 14,
    color: colors.cream,
  },
  err: { fontFamily: fonts.body, fontSize: 12, color: colors.live },
  googleBtn: {
    marginTop: 22,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 10,
    backgroundColor: "#FFFFFF",
    borderRadius: 14,
    paddingVertical: 14,
    paddingHorizontal: 16,
  },
  googleText: {
    fontFamily: fonts.semibold,
    fontSize: 15,
    color: "#1F1F1F",
  },
  dividerRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    marginTop: 20,
  },
  dividerLine: { flex: 1, height: 1, backgroundColor: colors.lineSoft },
  dividerText: { fontFamily: fonts.body, fontSize: 12, color: colors.dim },
  link: { textAlign: "center", fontFamily: fonts.semibold, fontSize: 13, color: colors.amber },
  x: {
    width: 34,
    height: 34,
    borderRadius: 17,
    borderWidth: 1,
    borderColor: colors.lineSoft,
    backgroundColor: colors.surface2,
    alignItems: "center",
    justifyContent: "center",
  },
  xText: { color: colors.muted, fontSize: 15 },
});
