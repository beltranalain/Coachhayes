// "Join the show" — the NATIVE guest / green-room flow. This is the app's mirror
// of the website's join page (New Company/web/app/join/[room]/page.tsx): the
// guest publishes their camera + mic to Cloudflare Realtime and pulls the host's
// feed, over the SAME backend protocol (see src/lib/realtimeNative.ts).
//
// EXPO GO GUARD: react-native-webrtc is a native module that CRASHES in Expo Go.
// So NOTHING at this file's module top level may touch it. All WebRTC pieces
// (realtimeNative + RTCView + mediaDevices) are require()d lazily inside the
// component, only when IS_EXPO_GO === false. In Expo Go we show a friendly note.

import React, { useCallback, useEffect, useRef, useState } from "react";
import {
  View,
  Text,
  TextInput,
  StyleSheet,
  Pressable,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
  ActivityIndicator,
  FlatList,
} from "react-native";
import { useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { colors, fonts, radii } from "../lib/theme";
import { IS_EXPO_GO } from "../lib/env";
import { CHAT_WS_URL } from "../lib/config";
import { useAuth } from "../lib/auth";
import { getFirebaseAuth } from "../lib/firebase";
import { useChat, type ChatMessage } from "../lib/useChat";
import { AmberButton, Eyebrow, Display } from "../components/ui";

// The studio signaling room. The website announces guests on `rt-main` (studio
// signaling), while chat lives in the `live` room — so we use `rt-main` here for
// the guest signaling WS and the normal `live` room (via useChat) for chat.
const SIGNAL_ROOM = "rt-main";
const SIGNAL_WS = `${CHAT_WS_URL}/room/${SIGNAL_ROOM}/ws`;

type AV = "both" | "video" | "audio" | "neither";
type Participant = {
  id: string;
  name: string;
  role: string;
  sessionId?: string;
  hasVideo: boolean;
  hasAudio: boolean;
};

// A minimal, stable id (crypto.randomUUID isn't guaranteed in RN).
function makeId() {
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
}

export default function JoinScreen() {
  const insets = useSafeAreaInsets();

  // In Expo Go, WebRTC would crash — bail out to a friendly note before touching
  // anything native.
  if (IS_EXPO_GO) {
    return <ExpoGoNote />;
  }
  return <GuestJoin topInset={insets.top} />;
}

// ---- Expo Go fallback -------------------------------------------------------
function ExpoGoNote() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  return (
    <View style={[styles.wrap, { paddingTop: insets.top + 40 }]}>
      <View style={styles.headRow}>
        <View>
          <Eyebrow>Green room</Eyebrow>
          <Display style={{ fontSize: 30, marginTop: 6 }}>Join the show</Display>
        </View>
        <Pressable onPress={() => router.back()} style={styles.x}>
          <Text style={styles.xText}>✕</Text>
        </Pressable>
      </View>
      <Text style={[styles.sub, { marginTop: 20 }]}>
        Joining the show needs the installed app (not Expo Go). Open a dev or
        production build to go on air with your camera and mic.
      </Text>
    </View>
  );
}

// ---- The real green room (dev / production build only) ----------------------
function GuestJoin({ topInset }: { topInset: number }) {
  const router = useRouter();
  const { user, displayName } = useAuth();
  const { messages, count, connected, send } = useChat();

  const [name, setName] = useState(user ? displayName : "");
  const [av, setAv] = useState<AV>("both");
  const [joined, setJoined] = useState(false);
  const [status, setStatus] = useState("");
  const [roster, setRoster] = useState<Participant[]>([]);
  const [hostLive, setHostLive] = useState(false);
  const [hasMic, setHasMic] = useState(false);
  const [hasCam, setHasCam] = useState(false);
  const [micOn, setMicOn] = useState(true);
  const [camOn, setCamOn] = useState(true);
  const [busy, setBusy] = useState(false);
  // toURL() strings for the two RTCViews. Kept in state so a re-render swaps the
  // stream in the native view once tracks arrive.
  const [localUrl, setLocalUrl] = useState<string | null>(null);
  const [hostUrl, setHostUrl] = useState<string | null>(null);

  const [draft, setDraft] = useState("");
  const listRef = useRef<FlatList<ChatMessage>>(null);

  // WebRTC state — all opaque refs so nothing native is created until join().
  const rtc = useRef<any>(null);
  const ws = useRef<WebSocket | null>(null);
  const localStream = useRef<any>(null);
  const hostStream = useRef<any>(null);
  const meId = useRef<string>("");
  const subscribed = useRef<Set<string>>(new Set());
  // Lazily-loaded native module handles.
  const rtcMod = useRef<any>(null);
  const nativeMod = useRef<any>(null);

  // Load react-native-webrtc + our native realtime client lazily. Safe here
  // because this component only mounts when IS_EXPO_GO === false.
  function loadNative() {
    if (!rtcMod.current) rtcMod.current = require("react-native-webrtc");
    if (!nativeMod.current) nativeMod.current = require("../lib/realtimeNative");
    return { rtc: rtcMod.current, native: nativeMod.current };
  }

  const chatName = (name.trim() || displayName || "Guest").slice(0, 40);

  async function join() {
    setBusy(true);
    setStatus("Joining...");
    meId.current = makeId();
    const wantVideo = av === "both" || av === "video";
    const wantAudio = av === "both" || av === "audio";

    const { rtc: RTC, native } = loadNative();
    const { mediaDevices, MediaStream } = RTC;
    const { RealtimeSession } = native;

    try {
      if (wantVideo || wantAudio) {
        const stream = await mediaDevices.getUserMedia({
          video: wantVideo,
          audio: wantAudio,
        });
        localStream.current = stream;
        const hasA = stream.getAudioTracks().length > 0;
        const hasV = stream.getVideoTracks().length > 0;
        setHasMic(hasA);
        setHasCam(hasV);
        if (hasV) setLocalUrl(stream.toURL());
      }
    } catch {
      setStatus("Camera/mic permission denied. You can still join with them off.");
    }

    let sessionId: string | undefined;
    try {
      const session = new RealtimeSession((_sid: string, track: any) => {
        // Accumulate the host's video + audio into one stream and show it.
        const ms = hostStream.current || new MediaStream();
        ms.addTrack(track);
        hostStream.current = ms;
        if (track.kind === "video") setHostLive(true);
        setHostUrl(ms.toURL());
      });
      rtc.current = session;
      if (localStream.current) {
        await session.publish(localStream.current);
        sessionId = session.sessionId; // set by publish (Cloudflare creates it there)
      }
    } catch {
      // Realtime not configured / no media — still join the room roster.
    }

    const participant: Participant = {
      id: meId.current,
      name: chatName,
      role: "guest",
      sessionId,
      hasVideo: wantVideo,
      hasAudio: wantAudio,
    };

    try {
      const sock = new WebSocket(SIGNAL_WS);
      ws.current = sock;
      sock.onopen = () =>
        sock.send(JSON.stringify({ type: "studio", action: "join", participant }));
      sock.onmessage = (e) => {
        let d: any;
        try {
          d = JSON.parse(e.data as string);
        } catch {
          return;
        }
        if (d.type === "studio" && d.action === "roster") {
          setRoster(d.participants || []);
          // Subscribe to the host's video + audio together (one serialized
          // negotiation) so the guest can see AND hear the host.
          const host = (d.participants || []).find(
            (p: Participant) => p.role === "host" && p.sessionId
          );
          if (host && !subscribed.current.has(host.sessionId) && rtc.current) {
            subscribed.current.add(host.sessionId);
            rtc.current.pull(host.sessionId, ["video", "audio"]).catch(() => {});
          }
        }
      };
    } catch {
      // Signaling unavailable — the guest is still publishing; host may not see them.
    }

    setJoined(true);
    setBusy(false);
    setStatus("You're in. The host can see you and will bring you on air.");
  }

  // Toggle the local mic / camera by enabling/disabling the published track
  // (keeps the connection + track slot; just stops sending media).
  function toggleMic() {
    const track = localStream.current?.getAudioTracks?.()[0];
    if (!track) return;
    track.enabled = !track.enabled;
    setMicOn(track.enabled);
  }
  function toggleCam() {
    const track = localStream.current?.getVideoTracks?.()[0];
    if (!track) return;
    track.enabled = !track.enabled;
    setCamOn(track.enabled);
  }

  // Leave: tear everything down and return to the pre-join screen.
  const teardown = useCallback(() => {
    try { ws.current?.close(); } catch {}
    try { rtc.current?.close(); } catch {}
    try { localStream.current?.getTracks?.().forEach((t: any) => t.stop()); } catch {}
    ws.current = null;
    rtc.current = null;
    localStream.current = null;
    hostStream.current = null;
    subscribed.current = new Set();
  }, []);

  function leave() {
    teardown();
    setRoster([]);
    setHostLive(false);
    setLocalUrl(null);
    setHostUrl(null);
    setJoined(false);
    setStatus("");
  }

  // Always clean up native resources on unmount.
  useEffect(() => () => teardown(), [teardown]);

  useEffect(() => {
    if (messages.length) listRef.current?.scrollToEnd({ animated: true });
  }, [messages.length]);

  function onSend() {
    const uid = getFirebaseAuth().currentUser?.uid || meId.current || "guest";
    if (send(chatName, draft, uid)) setDraft("");
  }

  // ---- Pre-join -------------------------------------------------------------
  if (!joined) {
    const options: { key: AV; label: string }[] = [
      { key: "both", label: "Video + audio" },
      { key: "video", label: "Video only" },
      { key: "audio", label: "Audio only" },
      { key: "neither", label: "Neither" },
    ];
    return (
      <KeyboardAvoidingView
        style={{ flex: 1, backgroundColor: colors.bg }}
        behavior={Platform.OS === "ios" ? "padding" : undefined}
      >
        <ScrollView
          contentContainerStyle={[styles.wrap, { paddingTop: topInset + 16 }]}
          keyboardShouldPersistTaps="handled"
        >
          <View style={styles.headRow}>
            <View>
              <Eyebrow>Green room</Eyebrow>
              <Display style={{ fontSize: 30, marginTop: 6 }}>Join the show</Display>
            </View>
            <Pressable onPress={() => router.back()} style={styles.x}>
              <Text style={styles.xText}>✕</Text>
            </Pressable>
          </View>

          <Text style={styles.sub}>
            You&apos;ve been invited onto the show. Pick how you want to come in.
          </Text>

          <View style={{ gap: 14, marginTop: 22 }}>
            <View style={{ gap: 8 }}>
              <Text style={styles.label}>Your name</Text>
              <TextInput
                value={name}
                onChangeText={setName}
                placeholder="Your name"
                placeholderTextColor={colors.dim}
                style={styles.field}
                maxLength={40}
              />
            </View>

            <View style={{ gap: 8 }}>
              <Text style={styles.label}>Camera &amp; mic</Text>
              <View style={styles.avRow}>
                {options.map((opt) => {
                  const active = av === opt.key;
                  return (
                    <Pressable
                      key={opt.key}
                      onPress={() => setAv(opt.key)}
                      style={({ pressed }) => [
                        styles.avBtn,
                        active && styles.avBtnActive,
                        pressed && !active && { opacity: 0.8 },
                      ]}
                    >
                      <Text style={[styles.avBtnText, active && { color: "#1a1205" }]}>
                        {opt.label}
                      </Text>
                    </Pressable>
                  );
                })}
              </View>
            </View>

            <View style={{ marginTop: 8 }}>
              <AmberButton label={busy ? "…" : "Join the show"} onPress={join} disabled={busy} />
            </View>
            {status ? <Text style={styles.note}>{status}</Text> : null}
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    );
  }

  // ---- Joined (green room) --------------------------------------------------
  const RTCView = rtcMod.current?.RTCView;
  return (
    <View style={{ flex: 1, backgroundColor: colors.bg, paddingTop: topInset }}>
      <View style={[styles.greenHead, { paddingHorizontal: 16 }]}>
        <View>
          <Eyebrow>Green room</Eyebrow>
          <Text style={styles.greenTitle}>You&apos;re in the show</Text>
        </View>
        <Pressable onPress={leave} style={styles.leaveBtn}>
          <Text style={styles.leaveText}>Leave the show</Text>
        </Pressable>
      </View>

      {/* Stage: host fills it; the guest's own camera sits in the corner. */}
      <View style={styles.stage}>
        {RTCView && hostUrl ? (
          <RTCView streamURL={hostUrl} objectFit="cover" style={StyleSheet.absoluteFill} />
        ) : null}
        {!hostLive && (
          <View style={styles.stageWait}>
            <ActivityIndicator color={colors.amber} />
            <Text style={styles.waitText}>Connecting to the host...</Text>
          </View>
        )}

        {/* Corner self preview */}
        <View style={styles.self}>
          {RTCView && hasCam && camOn && localUrl ? (
            <RTCView
              streamURL={localUrl}
              objectFit="cover"
              mirror
              zOrder={1}
              style={StyleSheet.absoluteFill}
            />
          ) : (
            <View style={styles.selfOff}>
              <Text style={styles.selfOffText}>Camera off</Text>
            </View>
          )}
          <Text style={styles.selfTag}>You</Text>
        </View>

        {(hasMic || hasCam) && (
          <View style={styles.controls}>
            {hasMic && (
              <Pressable onPress={toggleMic} style={[styles.ctrl, !micOn && styles.ctrlOff]}>
                <Text style={styles.ctrlText}>{micOn ? "Mute" : "Unmute"}</Text>
              </Pressable>
            )}
            {hasCam && (
              <Pressable onPress={toggleCam} style={[styles.ctrl, !camOn && styles.ctrlOff]}>
                <Text style={styles.ctrlText}>{camOn ? "Camera off" : "Camera on"}</Text>
              </Pressable>
            )}
          </View>
        )}
      </View>

      {status ? <Text style={[styles.note, { paddingHorizontal: 16 }]}>{status}</Text> : null}

      {/* Roster + live chat below the stage. */}
      <View style={styles.roster}>
        <Text style={styles.panelTitle}>In the room</Text>
        {roster.length === 0 ? (
          <Text style={styles.rosterEmpty}>Waiting for the host and other guests…</Text>
        ) : (
          roster.map((p) => (
            <View key={p.id} style={styles.rosterRow}>
              <Text style={styles.rosterName}>
                {p.name}
                {p.role === "host" ? " (host)" : ""}
              </Text>
              <Text style={styles.rosterMeta}>
                {p.hasVideo ? "video" : "no video"} · {p.hasAudio ? "audio" : "muted"}
              </Text>
            </View>
          ))
        )}
      </View>

      <View style={styles.chatWrap}>
        <View style={styles.chatHead}>
          <Text style={styles.panelTitle}>Live chat</Text>
          <Text style={styles.chatCount}>
            {connected ? (count != null ? `${count} watching` : "Live") : "Connecting…"}
          </Text>
        </View>
        <FlatList
          ref={listRef}
          data={messages}
          keyExtractor={(m) => m.id}
          style={{ flex: 1 }}
          contentContainerStyle={{ paddingVertical: 8, gap: 8 }}
          renderItem={({ item }) => (
            <View style={styles.msgRow}>
              <Text style={styles.msgName}>{item.name}</Text>
              <Text style={styles.msgText}>
                {item.tip ? <Text style={styles.tip}>${item.tip} </Text> : null}
                {item.text}
              </Text>
            </View>
          )}
        />
        <View style={styles.composer}>
          <TextInput
            value={draft}
            onChangeText={setDraft}
            placeholder="Say something…"
            placeholderTextColor={colors.dim}
            style={styles.composerInput}
            onSubmitEditing={onSend}
            returnKeyType="send"
            maxLength={280}
          />
          <Pressable onPress={onSend} style={styles.sendBtn}>
            <Text style={styles.sendText}>Send</Text>
          </Pressable>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { flexGrow: 1, backgroundColor: colors.bg, padding: 24, paddingTop: 40 },
  headRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start" },
  sub: { fontFamily: fonts.body, fontSize: 13, color: colors.muted, marginTop: 6, lineHeight: 20 },
  label: { fontFamily: fonts.semibold, fontSize: 12, color: colors.muted },
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
  avRow: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  avBtn: {
    borderRadius: radii.pill,
    borderWidth: 1,
    borderColor: colors.line,
    backgroundColor: colors.surface,
    paddingVertical: 9,
    paddingHorizontal: 14,
  },
  avBtnActive: { backgroundColor: colors.amber, borderColor: colors.amber },
  avBtnText: { fontFamily: fonts.semibold, fontSize: 12, color: colors.cream },
  note: { fontFamily: fonts.body, fontSize: 12.5, color: colors.amber, marginTop: 14, lineHeight: 19 },
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

  // Joined view
  greenHead: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    paddingVertical: 12,
  },
  greenTitle: { fontFamily: fonts.display, color: colors.cream, textTransform: "uppercase", fontSize: 24, marginTop: 4 },
  leaveBtn: {
    borderRadius: 11,
    borderWidth: 1,
    borderColor: colors.line,
    backgroundColor: colors.surface,
    paddingVertical: 9,
    paddingHorizontal: 14,
  },
  leaveText: { fontFamily: fonts.bold, fontSize: 12, color: colors.cream },
  stage: {
    marginHorizontal: 16,
    aspectRatio: 16 / 10,
    borderRadius: radii.lg,
    overflow: "hidden",
    backgroundColor: "#050403",
    borderWidth: 1,
    borderColor: colors.lineSoft,
  },
  stageWait: { position: "absolute", top: 0, left: 0, right: 0, bottom: 0, alignItems: "center", justifyContent: "center", gap: 10 },
  waitText: { fontFamily: fonts.body, fontSize: 13, color: colors.muted },
  self: {
    position: "absolute",
    right: 12,
    bottom: 12,
    width: 96,
    height: 128,
    borderRadius: 12,
    overflow: "hidden",
    backgroundColor: colors.surface2,
    borderWidth: 1,
    borderColor: colors.line,
  },
  selfOff: { position: "absolute", top: 0, left: 0, right: 0, bottom: 0, alignItems: "center", justifyContent: "center" },
  selfOffText: { fontFamily: fonts.body, fontSize: 11, color: colors.dim },
  selfTag: {
    position: "absolute",
    left: 6,
    bottom: 6,
    fontFamily: fonts.semibold,
    fontSize: 10,
    color: colors.cream,
    backgroundColor: "rgba(6,5,5,0.6)",
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 6,
    overflow: "hidden",
  },
  controls: { position: "absolute", left: 12, bottom: 12, flexDirection: "row", gap: 8 },
  ctrl: {
    borderRadius: radii.pill,
    backgroundColor: "rgba(6,5,5,0.66)",
    borderWidth: 1,
    borderColor: colors.line,
    paddingVertical: 8,
    paddingHorizontal: 13,
  },
  ctrlOff: { backgroundColor: "rgba(232,64,42,0.75)", borderColor: colors.live },
  ctrlText: { fontFamily: fonts.semibold, fontSize: 12, color: colors.cream },

  roster: { paddingHorizontal: 16, paddingTop: 16 },
  panelTitle: { fontFamily: fonts.semibold, fontSize: 13, color: colors.cream, marginBottom: 8 },
  rosterEmpty: { fontFamily: fonts.body, fontSize: 12, color: colors.dim },
  rosterRow: { flexDirection: "row", justifyContent: "space-between", paddingVertical: 5 },
  rosterName: { fontFamily: fonts.medium, fontSize: 13, color: colors.cream },
  rosterMeta: { fontFamily: fonts.body, fontSize: 11, color: colors.dim },

  chatWrap: { flex: 1, marginTop: 12, borderTopWidth: 1, borderTopColor: colors.lineSoft, paddingHorizontal: 16, paddingTop: 12 },
  chatHead: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  chatCount: { fontFamily: fonts.body, fontSize: 11, color: colors.dim },
  msgRow: { flexDirection: "row", flexWrap: "wrap", gap: 6 },
  msgName: { fontFamily: fonts.semibold, fontSize: 13, color: colors.amber },
  msgText: { fontFamily: fonts.body, fontSize: 13, color: colors.cream, flexShrink: 1 },
  tip: { fontFamily: fonts.bold, color: colors.highlight },
  composer: { flexDirection: "row", gap: 8, paddingVertical: 10 },
  composerInput: {
    flex: 1,
    backgroundColor: colors.surface2,
    borderWidth: 1,
    borderColor: colors.lineSoft,
    borderRadius: 12,
    paddingVertical: 10,
    paddingHorizontal: 13,
    fontFamily: fonts.body,
    fontSize: 13,
    color: colors.cream,
  },
  sendBtn: {
    borderRadius: 12,
    backgroundColor: colors.amber,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 16,
  },
  sendText: { fontFamily: fonts.bold, fontSize: 13, color: "#1a1205" },
});
