// LIVE screen — matches the mockup's Live layout.
//
// Player states (automatic, no manual toggle):
//   SCHEDULED  -> a cover thumbnail (ArtWell) with a play icon + "LIVE SOON"
//                 chip, "NEXT LIVE SHOW", the show name, a live countdown, and
//                 "Starts automatically when the show goes live."
//   LIVE       -> plays the Cloudflare Stream iframe embed inside a WebView
//                 (mirrors the website; more reliable than raw native HLS).
//   OFF AIR    -> nothing scheduled and not live.
//
// Below the player: the show title with a minimize/collapse chevron (collapsing
// hides the action pills + destination chips), then the merged Site + YouTube
// live chat over the same WebSocket (tips as amber pills), and a chat input row
// with a small amber "$" tip button next to Send. Player stays pinned while the
// chat scrolls.

import React, { useEffect, useMemo, useRef, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  Pressable,
  FlatList,
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Platform,
  Linking,
  useWindowDimensions,
} from "react-native";
import { WebView } from "react-native-webview";
import { useRouter } from "expo-router";

import { colors, fonts, radii } from "../../lib/theme";
import { STREAM_IFRAME_URL } from "../../lib/config";
import {
  fetchStreamStatus,
  fetchSiteConfig,
  upcoming,
  countdownLabel,
  formatWhen,
  type ScheduleItem,
} from "../../lib/api";
import { useChat, type ChatMessage } from "../../lib/useChat";
import { useAuth } from "../../lib/auth";
import { useBranding } from "../../lib/branding";
import { getFirebaseAuth } from "../../lib/firebase";
import { sendTip } from "../../lib/tips";
import { ArtWell, Eyebrow, Dot } from "../../components/ui";
import { TipSheet } from "../../components/TipSheet";

export default function LiveScreen() {
  const router = useRouter();
  const { user, displayName } = useAuth();
  const branding = useBranding();
  const { messages, count, connected, send } = useChat();

  const [live, setLive] = useState(false);
  const [checked, setChecked] = useState(false);
  const [next, setNext] = useState<ScheduleItem | null>(null);
  const [, tick] = useState(0);
  const [draft, setDraft] = useState("");
  const [tipOpen, setTipOpen] = useState(false);
  const [collapsed, setCollapsed] = useState(false);
  const listRef = useRef<FlatList<ChatMessage>>(null);

  // Poll live status (matches the site's ~4s server cache cadence).
  useEffect(() => {
    let alive = true;
    async function poll() {
      try {
        const s = await fetchStreamStatus();
        if (alive) setLive(Boolean(s.live));
      } catch {
        /* keep last known state */
      } finally {
        if (alive) setChecked(true);
      }
    }
    poll();
    const id = setInterval(poll, 8000);
    return () => {
      alive = false;
      clearInterval(id);
    };
  }, []);

  // Load the schedule for the "next show" card + countdown (soonest future item).
  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const cfg = await fetchSiteConfig();
        const up = upcoming(cfg.schedule || []);
        if (alive) setNext(up[0] ?? null);
      } catch {
        /* leave null -> OFF AIR */
      }
    })();
    return () => {
      alive = false;
    };
  }, []);

  // 1s ticker so the countdown updates.
  useEffect(() => {
    const id = setInterval(() => tick((n) => n + 1), 1000);
    return () => clearInterval(id);
  }, []);

  useEffect(() => {
    if (messages.length) listRef.current?.scrollToEnd({ animated: true });
  }, [messages.length]);

  const canSend = connected && Boolean(user);

  // Title shown over the player region. Prefer a scheduled show name, then the
  // brand's channel bug / site name.
  const showTitle = useMemo(() => {
    if (next?.title) return next.title;
    return branding.siteName || "Your Studio";
  }, [next, branding.siteName]);

  function onSend() {
    if (!user) {
      router.push("/signin");
      return;
    }
    const uid = getFirebaseAuth().currentUser?.uid || "";
    if (send(displayName, draft, uid)) setDraft("");
  }

  async function onTip(amount: number, message: string) {
    setTipOpen(false);
    if (!user) {
      router.push("/signin");
      return;
    }
    const uid = getFirebaseAuth().currentUser?.uid || "";
    const res = await sendTip({ amount, message, name: displayName, uid });
    if (res.status === "paid") {
      Alert.alert("Thanks for the tip", "It will show up live in the chat.");
    } else if (res.status === "unavailable") {
      Alert.alert("Tips unavailable", res.message);
    } else if (res.status === "error") {
      Alert.alert("Tip failed", res.message);
    }
  }

  const status: "live" | "scheduled" | "off" = live ? "live" : next ? "scheduled" : "off";

  const { width, height } = useWindowDimensions();
  const isLandscape = width > height;

  // Shared player node (WebView video / scheduled / off-air) used by both layouts.
  const playerContent = (
    <>
      {status === "live" ? (
        <>
          <WebView
            source={{ uri: STREAM_IFRAME_URL }}
            style={[StyleSheet.absoluteFill, { backgroundColor: "#0b0a09" }]}
            allowsInlineMediaPlayback={true}
            mediaPlaybackRequiresUserAction={false}
            javaScriptEnabled={true}
            domStorageEnabled={true}
            allowsFullscreenVideo={true}
            scrollEnabled={false}
          />
          <View style={styles.liveBadge} pointerEvents="none">
            <Dot color="#fff" />
            <Text style={styles.liveBadgeText}>LIVE</Text>
          </View>
        </>
      ) : status === "scheduled" ? (
        <PlayerScheduled next={next!} />
      ) : (
        <PlayerOffAir checked={checked} />
      )}
    </>
  );

  // Shared composer (input + tip + send), reused in portrait + landscape.
  const composer = (
    <View style={styles.composer}>
      {canSend ? (
        <TextInput
          value={draft}
          onChangeText={setDraft}
          placeholder={`Chatting as ${displayName}`}
          placeholderTextColor={colors.dim}
          style={styles.input}
          maxLength={500}
          onSubmitEditing={onSend}
          returnKeyType="send"
        />
      ) : user ? (
        <View style={[styles.input, styles.inputDisabled]}>
          <Text style={styles.inputPlaceholder}>Connecting…</Text>
        </View>
      ) : (
        <Pressable
          onPress={() => router.push("/signin")}
          accessibilityLabel="Sign in to chat"
          style={({ pressed }) => [styles.input, styles.signInField, pressed && { opacity: 0.8 }]}
        >
          <Text style={styles.signInFieldText}>Sign in to chat</Text>
        </Pressable>
      )}
      <Pressable
        onPress={() => (user ? setTipOpen(true) : router.push("/signin"))}
        accessibilityLabel="Send a tip"
        style={({ pressed }) => [styles.tipBtn, pressed && { opacity: 0.8 }]}
      >
        <Text style={styles.tipBtnText}>$</Text>
      </Pressable>
      <Pressable onPress={onSend} style={({ pressed }) => [styles.sendBtn, pressed && { opacity: 0.8 }]}>
        <Text style={styles.sendText}>Send</Text>
      </Pressable>
    </View>
  );

  // ---- Landscape: video left ~64%, chat sidebar right ~36% ------------------
  if (isLandscape) {
    return (
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === "ios" ? "padding" : undefined}
      >
        <View style={styles.landRoot}>
          <View style={styles.landPlayer}>{playerContent}</View>

          <View style={styles.landChat}>
            <View style={styles.landChatHead}>
              <Eyebrow>
                Live Chat{"  "}
                <Text style={styles.chatCount}>
                  {connected ? `${count ?? 1} here` : "connecting…"}
                </Text>
              </Eyebrow>
              <Text style={styles.siteTag}>Site + YouTube</Text>
            </View>

            <FlatList
              ref={listRef}
              data={messages}
              keyExtractor={(m) => m.id}
              style={{ flex: 1 }}
              contentContainerStyle={{ padding: 14, gap: 9, flexGrow: 1 }}
              renderItem={({ item }) => <ChatRow msg={item} />}
              ListEmptyComponent={
                <Text style={styles.empty}>
                  {connected ? "No messages yet. Say hello." : "Connecting to live chat…"}
                </Text>
              }
            />

            <View style={styles.landComposerWrap}>{composer}</View>
          </View>
        </View>

        <TipSheet visible={tipOpen} onClose={() => setTipOpen(false)} onSubmit={onTip} />
      </KeyboardAvoidingView>
    );
  }

  // The scrolling body above the chat list (title + collapsible chips).
  const Header = (
    <View style={styles.body}>
      <View style={styles.titleRow}>
        <View style={{ flex: 1 }}>
          {!collapsed && <Text style={styles.titleEyebrow}>{branding.siteName || "Your Studio"}</Text>}
          <Text style={collapsed ? styles.titleCollapsed : styles.titleMain} numberOfLines={collapsed ? 1 : 2}>
            {showTitle}
          </Text>
        </View>
        <Pressable
          onPress={() => setCollapsed((v) => !v)}
          hitSlop={8}
          accessibilityLabel={collapsed ? "Expand title" : "Minimize title"}
          style={({ pressed }) => [styles.titleToggle, pressed && { opacity: 0.7 }]}
        >
          <Chevron up={collapsed} />
        </Pressable>
      </View>

      {!collapsed && (
        <View style={styles.rowScroll}>
          <Pressable
            onPress={() => Linking.openURL(`https://www.youtube.com/results?search_query=${encodeURIComponent(branding.siteName || "")}`)}
            style={({ pressed }) => [styles.pill, pressed && { opacity: 0.8 }]}
          >
            <Text style={styles.pillText}>Watch on YouTube</Text>
          </Pressable>
          <Pressable style={({ pressed }) => [styles.pill, pressed && { opacity: 0.8 }]}>
            <Text style={styles.pillText}>Notify me</Text>
          </Pressable>
        </View>
      )}

      {!collapsed && (
        <View style={styles.destRow}>
          <View style={styles.destChip}>
            <Dot color={colors.live} glow />
            <Text style={styles.destText}>Here · own site</Text>
          </View>
          <View style={styles.destChip}>
            <Dot color={colors.live} glow />
            <Text style={styles.destText}>YouTube · simulcast</Text>
          </View>
          <View style={styles.destChip}>
            <Dot color={colors.dim} />
            <Text style={styles.destText}>Facebook · off</Text>
          </View>
        </View>
      )}

      <View style={styles.chatHead}>
        <Eyebrow>
          Live Chat{"  "}
          <Text style={styles.chatCount}>{connected ? `${count ?? 1} here` : "connecting…"}</Text>
        </Eyebrow>
        <Text style={styles.siteTag}>Site + YouTube</Text>
      </View>
    </View>
  );

  return (
    <KeyboardAvoidingView
      style={{ flex: 1 }}
      behavior={Platform.OS === "ios" ? "padding" : undefined}
      keyboardVerticalOffset={90}
    >
      {/* Pinned player */}
      <View style={styles.pin}>
        <View style={styles.player}>{playerContent}</View>
      </View>

      {/* Chat list with the collapsible title header pinned above it */}
      <FlatList
        ref={listRef}
        data={messages}
        keyExtractor={(m) => m.id}
        style={{ flex: 1 }}
        ListHeaderComponent={Header}
        contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: 16, gap: 9, flexGrow: 1 }}
        renderItem={({ item }) => <ChatRow msg={item} />}
        ListEmptyComponent={
          <Text style={styles.empty}>
            {connected ? "No messages yet. Say hello." : "Connecting to live chat…"}
          </Text>
        }
      />

      {/* Composer with an inline tip ($) button next to Send */}
      <View style={styles.composerWrap}>{composer}</View>

      <TipSheet visible={tipOpen} onClose={() => setTipOpen(false)} onSubmit={onTip} />
    </KeyboardAvoidingView>
  );
}

// ---- Player states ----------------------------------------------------------

function PlayerScheduled({ next }: { next: ScheduleItem }) {
  return (
    <View style={StyleSheet.absoluteFill}>
      {/* Full-bleed cover art behind the poster thumbnail. */}
      <ArtWell well="amber" radius={0} style={[StyleSheet.absoluteFill, { opacity: 0.55 }]} />
      <View style={styles.scheduled}>
        {/* Visible cover thumbnail (poster) with play icon + LIVE SOON chip. */}
        <View style={styles.thumbWrap}>
          <ArtWell well="amber" radius={12} style={StyleSheet.absoluteFill} />
          <View style={styles.thumbChip}>
            <Text style={styles.thumbChipText}>LIVE SOON</Text>
          </View>
          <View style={styles.playBtn}>
            <PlayTriangle />
          </View>
        </View>
        <Text style={styles.eyeAmber}>NEXT LIVE SHOW</Text>
        <Text style={styles.showTitle} numberOfLines={2}>
          {next.title}
        </Text>
        <Text style={styles.count}>
          {formatWhen(next)} · {countdownLabel(next.startsAt)}
        </Text>
        <Text style={styles.idleSub}>Starts automatically when the show goes live.</Text>
      </View>
    </View>
  );
}

function PlayerOffAir({ checked }: { checked: boolean }) {
  if (!checked) {
    return (
      <View style={styles.idle}>
        <ActivityIndicator color={colors.amber} />
        <Text style={styles.idleSub}>Checking the stream…</Text>
      </View>
    );
  }
  return (
    <View style={styles.idle}>
      <View style={styles.ring} />
      <Text style={styles.offAir}>OFF AIR</Text>
      <Text style={styles.idleSub}>Starts automatically when the show goes live.</Text>
    </View>
  );
}

// ---- Small glyphs (View-based, no SVG dependency) ---------------------------

function PlayTriangle() {
  return (
    <View
      style={{
        width: 0,
        height: 0,
        marginLeft: 3,
        borderTopWidth: 7,
        borderBottomWidth: 7,
        borderLeftWidth: 12,
        borderTopColor: "transparent",
        borderBottomColor: "transparent",
        borderLeftColor: "rgba(243,239,231,0.92)",
      }}
    />
  );
}

function Chevron({ up }: { up?: boolean }) {
  // A simple chevron built from two rotated bars.
  return (
    <View style={{ width: 14, height: 8, alignItems: "center", justifyContent: "center", transform: [{ rotate: up ? "180deg" : "0deg" }] }}>
      <View style={{ position: "absolute", left: 1, width: 8, height: 2, backgroundColor: colors.muted, borderRadius: 2, transform: [{ rotate: "45deg" }] }} />
      <View style={{ position: "absolute", right: 1, width: 8, height: 2, backgroundColor: colors.muted, borderRadius: 2, transform: [{ rotate: "-45deg" }] }} />
    </View>
  );
}

// ---- Chat rows --------------------------------------------------------------

function ChatRow({ msg }: { msg: ChatMessage }) {
  if (msg.tip) {
    return (
      <View style={styles.tipMsg}>
        <Text style={styles.tipAmt}>${msg.tip.toFixed(msg.tip % 1 ? 2 : 0)}</Text>
        <Text style={styles.tipWho}>
          {msg.name}
          {msg.text ? <Text style={styles.tipText}> · {msg.text}</Text> : null}
        </Text>
      </View>
    );
  }
  return (
    <View style={styles.msg}>
      <View style={styles.tag}>
        <Text style={styles.tagText}>SITE</Text>
      </View>
      <Text style={styles.msgBody}>
        <Text style={styles.msgName}>{msg.name} </Text>
        <Text style={styles.msgText}>{msg.text}</Text>
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  pin: { padding: 10, borderBottomWidth: 1, borderBottomColor: colors.lineSoft, backgroundColor: colors.bg },
  player: {
    aspectRatio: 16 / 10,
    borderRadius: radii.lg,
    overflow: "hidden",
    backgroundColor: "#0b0a09",
    borderWidth: 1,
    borderColor: colors.lineSoft,
  },
  liveBadge: {
    position: "absolute",
    top: 8,
    left: 8,
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    backgroundColor: "rgba(232,64,42,0.92)",
    borderRadius: 6,
    paddingVertical: 3,
    paddingHorizontal: 7,
  },
  liveBadgeText: { fontFamily: fonts.bold, color: "#fff", fontSize: 9, letterSpacing: 1.4 },

  idle: { flex: 1, alignItems: "center", justifyContent: "center", gap: 10, padding: 16 },
  ring: {
    width: 34,
    height: 34,
    borderRadius: 17,
    borderWidth: 3,
    borderColor: "rgba(245,165,36,0.18)",
    borderTopColor: colors.amber,
  },
  offAir: { fontFamily: fonts.display, fontSize: 46, color: colors.cream },
  idleSub: { fontFamily: fonts.body, fontSize: 11.5, color: colors.muted, textAlign: "center" },

  scheduled: { flex: 1, alignItems: "center", justifyContent: "flex-end", gap: 6, padding: 18 },
  thumbWrap: {
    width: 120,
    height: 78,
    borderRadius: 12,
    overflow: "hidden",
    marginBottom: 8,
    borderWidth: 1,
    borderColor: "rgba(245,165,36,0.5)",
    alignItems: "center",
    justifyContent: "center",
  },
  thumbChip: {
    position: "absolute",
    top: 6,
    left: 6,
    backgroundColor: colors.amber,
    borderRadius: 5,
    paddingVertical: 2,
    paddingHorizontal: 6,
  },
  thumbChipText: { fontFamily: fonts.bold, fontSize: 8, letterSpacing: 1.2, color: "#1a1205" },
  playBtn: {
    width: 34,
    height: 34,
    borderRadius: 17,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(10,9,8,0.32)",
    borderWidth: 1,
    borderColor: "rgba(243,239,231,0.45)",
  },
  eyeAmber: { fontFamily: fonts.bold, fontSize: 9.5, letterSpacing: 2, color: colors.amber },
  showTitle: { fontFamily: fonts.display, fontSize: 26, color: colors.cream, textAlign: "center" },
  count: { fontFamily: fonts.display, fontSize: 18, color: colors.amber, marginTop: 1, textAlign: "center" },

  body: { paddingTop: 14 },
  titleRow: { flexDirection: "row", alignItems: "flex-start", gap: 10 },
  titleEyebrow: { fontFamily: fonts.bold, fontSize: 10.5, letterSpacing: 2, color: colors.amber, textTransform: "uppercase", marginBottom: 4 },
  titleMain: { fontFamily: fonts.display, fontSize: 30, color: colors.cream, textTransform: "uppercase", lineHeight: 30 },
  titleCollapsed: { fontFamily: fonts.display, fontSize: 16, color: colors.cream, textTransform: "uppercase" },
  titleToggle: {
    width: 30,
    height: 30,
    borderRadius: 15,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: colors.line,
    backgroundColor: colors.surface,
    marginTop: 2,
  },

  rowScroll: { flexDirection: "row", flexWrap: "wrap", gap: 8, marginTop: 16 },
  pill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 7,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: colors.line,
    backgroundColor: colors.surface,
    paddingVertical: 9,
    paddingHorizontal: 14,
  },
  pillText: { fontFamily: fonts.semibold, fontSize: 12, color: colors.cream },
  destRow: { flexDirection: "row", flexWrap: "wrap", gap: 8, marginTop: 12 },
  destChip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 7,
    borderWidth: 1,
    borderColor: colors.lineSoft,
    backgroundColor: colors.surface,
    borderRadius: 999,
    paddingVertical: 7,
    paddingHorizontal: 11,
  },
  destText: { fontFamily: fonts.semibold, fontSize: 11, color: colors.muted },

  chatHead: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginTop: 18,
    marginBottom: 4,
  },
  chatCount: { fontFamily: fonts.semibold, color: colors.muted, letterSpacing: 0 },
  siteTag: { fontFamily: fonts.body, fontSize: 11, color: colors.dim },
  empty: { fontFamily: fonts.body, fontSize: 13, color: colors.muted },

  msg: { flexDirection: "row", gap: 8, alignItems: "flex-start" },
  tag: {
    borderWidth: 1,
    borderColor: colors.lineSoft,
    borderRadius: 5,
    paddingVertical: 2,
    paddingHorizontal: 5,
    marginTop: 1,
  },
  tagText: { fontFamily: fonts.bold, fontSize: 8.5, letterSpacing: 1, color: colors.dim },
  msgBody: { flex: 1, fontSize: 12.5, lineHeight: 18 },
  msgName: { fontFamily: fonts.bold, color: colors.cream },
  msgText: { fontFamily: fonts.body, color: colors.muted },
  tipMsg: {
    flexDirection: "row",
    alignItems: "center",
    gap: 9,
    borderWidth: 1,
    borderColor: "rgba(245,165,36,0.5)",
    backgroundColor: "rgba(245,165,36,0.08)",
    borderRadius: 12,
    paddingVertical: 9,
    paddingHorizontal: 12,
  },
  tipAmt: { fontFamily: fonts.display, fontSize: 16, color: colors.amber },
  tipWho: { flex: 1, fontFamily: fonts.bold, fontSize: 12.5, color: colors.cream },
  tipText: { fontFamily: fonts.body, color: colors.muted },

  composerWrap: {
    paddingHorizontal: 16,
    paddingTop: 8,
    paddingBottom: 12,
    borderTopWidth: 1,
    borderTopColor: colors.lineSoft,
    backgroundColor: colors.bg,
  },
  composer: { flexDirection: "row", alignItems: "center", gap: 8 },
  input: {
    flex: 1,
    backgroundColor: colors.surface2,
    borderWidth: 1,
    borderColor: colors.lineSoft,
    borderRadius: 999,
    paddingVertical: 10,
    paddingHorizontal: 14,
    fontFamily: fonts.body,
    fontSize: 12.5,
    color: colors.cream,
  },
  inputDisabled: { justifyContent: "center" },
  inputPlaceholder: { fontFamily: fonts.body, fontSize: 12.5, color: colors.dim },
  signInField: { justifyContent: "center", borderColor: "rgba(245,165,36,0.45)" },
  signInFieldText: { fontFamily: fonts.semibold, fontSize: 12.5, color: colors.amber },

  // ---- Landscape layout ----
  landRoot: { flex: 1, flexDirection: "row", backgroundColor: colors.bg },
  landPlayer: {
    flex: 0.64,
    height: "100%",
    backgroundColor: "#0b0a09",
    borderRightWidth: 1,
    borderRightColor: colors.lineSoft,
    overflow: "hidden",
  },
  landChat: { flex: 0.36, height: "100%", backgroundColor: colors.bg },
  landChatHead: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingTop: 14,
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: colors.lineSoft,
  },
  landComposerWrap: {
    paddingHorizontal: 16,
    paddingTop: 10,
    paddingBottom: 12,
    borderTopWidth: 1,
    borderTopColor: colors.lineSoft,
    backgroundColor: colors.bg,
  },
  sendBtn: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.line,
    borderRadius: 999,
    paddingVertical: 10,
    paddingHorizontal: 16,
  },
  sendText: { fontFamily: fonts.bold, fontSize: 12, color: colors.cream },
  tipBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.amber,
  },
  tipBtnText: { fontFamily: fonts.bold, fontSize: 18, color: colors.bg },
});
