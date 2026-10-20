// NATIVE Go Live broadcaster. Captures the phone camera + mic with
// react-native-webrtc and publishes straight to the Cloudflare Stream live input
// over WHIP (WebRTC-HTTP Ingestion) — no browser, no WebView, no website. What
// this publishes is exactly what the Live page plays.
//
// This file imports react-native-webrtc (a native module), so it must ONLY be
// loaded in a dev build / production app — never required in Expo Go. studio.tsx
// guards the require behind IS_EXPO_GO.

import React, { useCallback, useEffect, useRef, useState } from "react";
import { View, Text, Pressable, StyleSheet, Platform, PermissionsAndroid, ActivityIndicator } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Feather } from "@expo/vector-icons";
import {
  RTCPeerConnection,
  RTCSessionDescription,
  RTCView,
  mediaDevices,
  type MediaStream,
} from "react-native-webrtc";

import { fonts, type ThemeColors } from "../lib/theme";
import { useColors, useThemedStyles } from "../lib/ThemeContext";
import { STREAM_WHIP_URL, STREAM_CONFIGURED, API_BASE } from "../lib/config";
import { getFirebaseAuth } from "../lib/firebase";

type Status = "idle" | "starting" | "live" | "error";

async function ensurePermissions(): Promise<boolean> {
  if (Platform.OS !== "android") return true; // iOS prompts via getUserMedia + Info.plist
  try {
    const res = await PermissionsAndroid.requestMultiple([
      PermissionsAndroid.PERMISSIONS.CAMERA,
      PermissionsAndroid.PERMISSIONS.RECORD_AUDIO,
    ]);
    return (
      res["android.permission.CAMERA"] === "granted" &&
      res["android.permission.RECORD_AUDIO"] === "granted"
    );
  } catch {
    return false;
  }
}

// Non-trickle WHIP: let ICE finish gathering, then send one complete offer.
function waitForIce(pc: RTCPeerConnection): Promise<void> {
  return new Promise((resolve) => {
    if ((pc as any).iceGatheringState === "complete") return resolve();
    const check = () => {
      if ((pc as any).iceGatheringState === "complete") {
        (pc as any).removeEventListener?.("icegatheringstatechange", check);
        resolve();
      }
    };
    (pc as any).addEventListener?.("icegatheringstatechange", check);
    setTimeout(resolve, 2500); // don't hang if the event is missed
  });
}

// Best-effort: tell the backend to start/stop the simulcast relay (YouTube
// fan-out). The WHIP publish alone already makes the Cloudflare input live;
// this just mirrors the web studio and is ignored if the relay isn't set up.
async function notifyBackend(action: "start" | "stop") {
  try {
    const token = await getFirebaseAuth().currentUser?.getIdToken();
    await fetch(`${API_BASE}/api/simulcast/${action}`, {
      method: "POST",
      headers: token ? { Authorization: `Bearer ${token}` } : {},
    });
  } catch {
    /* relay not configured / offline — the direct publish still works */
  }
}

export default function LiveBroadcaster({ onClose }: { onClose: () => void }) {
  const colors = useColors();
  const styles = useThemedStyles(makeStyles);
  const insets = useSafeAreaInsets();

  const [status, setStatus] = useState<Status>("idle");
  const [error, setError] = useState("");
  const [streamUrl, setStreamUrl] = useState<string | null>(null);
  const [facing, setFacing] = useState<"user" | "environment">("user");
  const [muted, setMuted] = useState(false);

  const pcRef = useRef<RTCPeerConnection | null>(null);
  const streamRef = useRef<MediaStream | null>(null);

  const cleanup = useCallback(() => {
    try { streamRef.current?.getTracks().forEach((t) => t.stop()); } catch {}
    try { pcRef.current?.close(); } catch {}
    streamRef.current = null;
    pcRef.current = null;
    setStreamUrl(null);
  }, []);

  useEffect(() => () => cleanup(), [cleanup]);

  const start = useCallback(async () => {
    if (!STREAM_CONFIGURED) { setStatus("error"); setError("The live stream isn't configured yet (Cloudflare Stream codes are missing)."); return; }
    setStatus("starting"); setError("");
    try {
      const ok = await ensurePermissions();
      if (!ok) throw new Error("Camera and microphone access are required to go live.");

      const media = await mediaDevices.getUserMedia({
        audio: true,
        video: { frameRate: 30, facingMode: facing, width: 1280, height: 720 },
      });
      streamRef.current = media as unknown as MediaStream;
      setStreamUrl((media as any).toURL());

      const pc = new RTCPeerConnection({ iceServers: [{ urls: "stun:stun.cloudflare.com:3478" }] });
      pcRef.current = pc;
      media.getTracks().forEach((t) => pc.addTrack(t, media));

      (pc as any).addEventListener?.("connectionstatechange", () => {
        const st = (pc as any).connectionState;
        if (st === "connected") setStatus("live");
        else if (st === "failed" || st === "closed") {
          setStatus((s) => (s === "live" || s === "starting" ? "error" : s));
          if ((pc as any).connectionState === "failed") setError("The connection dropped. Check your signal and try again.");
        }
      });

      const offer = await pc.createOffer({});
      await pc.setLocalDescription(offer);
      await waitForIce(pc);

      const res = await fetch(STREAM_WHIP_URL, {
        method: "POST",
        headers: { "Content-Type": "application/sdp" },
        body: (pc.localDescription as any)?.sdp || (offer as any).sdp,
      });
      if (!res.ok) throw new Error(`The stream server rejected the broadcast (${res.status}).`);
      const answer = await res.text();
      await pc.setRemoteDescription(new RTCSessionDescription({ type: "answer", sdp: answer }));

      notifyBackend("start");
      // connectionstatechange -> "connected" flips status to "live".
    } catch (e: any) {
      cleanup();
      setStatus("error");
      setError(e?.message || "Could not start the broadcast.");
    }
  }, [facing, cleanup]);

  const stop = useCallback(() => {
    notifyBackend("stop");
    cleanup();
    setStatus("idle");
  }, [cleanup]);

  const flip = useCallback(() => {
    const track: any = streamRef.current?.getVideoTracks?.()[0];
    try { track?._switchCamera?.(); } catch {}
    setFacing((f) => (f === "user" ? "environment" : "user"));
  }, []);

  const toggleMute = useCallback(() => {
    const track: any = streamRef.current?.getAudioTracks?.()[0];
    if (track) { track.enabled = muted; setMuted((m) => !m); }
  }, [muted]);

  const previewing = Boolean(streamUrl);

  return (
    <View style={styles.root}>
      {previewing ? (
        <RTCView streamURL={streamUrl!} style={StyleSheet.absoluteFill} objectFit="cover" mirror={facing === "user"} />
      ) : (
        <View style={[StyleSheet.absoluteFill, styles.placeholder]} />
      )}

      {/* Top bar */}
      <View style={[styles.topBar, { paddingTop: insets.top + 8 }]}>
        {status === "live" ? (
          <View style={styles.liveBadge}><View style={styles.liveDot} /><Text style={styles.liveText}>LIVE</Text></View>
        ) : (
          <Text style={styles.topTitle}>Go Live</Text>
        )}
        <Pressable onPress={() => { cleanup(); onClose(); }} hitSlop={10} style={styles.closeBtn}>
          <Feather name="x" size={20} color="#fff" />
        </Pressable>
      </View>

      {/* Error / status message */}
      {status === "error" && !!error && (
        <View style={[styles.msgWrap, { top: insets.top + 60 }]}>
          <Text style={styles.msgText}>{error}</Text>
        </View>
      )}

      {/* Bottom controls */}
      <View style={[styles.controls, { paddingBottom: insets.bottom + 18 }]}>
        {status === "live" ? (
          <View style={styles.liveControls}>
            <Pressable onPress={toggleMute} style={styles.roundBtn}>
              <Feather name={muted ? "mic-off" : "mic"} size={22} color="#fff" />
            </Pressable>
            <Pressable onPress={stop} style={styles.stopBtn}>
              <View style={styles.stopSquare} />
              <Text style={styles.stopText}>End broadcast</Text>
            </Pressable>
            <Pressable onPress={flip} style={styles.roundBtn}>
              <Feather name="refresh-cw" size={20} color="#fff" />
            </Pressable>
          </View>
        ) : (
          <Pressable onPress={start} disabled={status === "starting"} style={({ pressed }) => [styles.goBtn, pressed && { opacity: 0.9 }, status === "starting" && { opacity: 0.7 }]}>
            {status === "starting" ? (
              <><ActivityIndicator color={colors.onAccent} /><Text style={styles.goText}>Starting…</Text></>
            ) : (
              <><View style={styles.goDot} /><Text style={styles.goText}>{status === "error" ? "Try again" : "Go Live"}</Text></>
            )}
          </Pressable>
        )}
        <Text style={styles.hint}>Streams straight from your phone to your Live page. Screen-share isn&apos;t available on mobile.</Text>
      </View>
    </View>
  );
}

const makeStyles = (colors: ThemeColors) => StyleSheet.create({
  root: { flex: 1, backgroundColor: "#000" },
  placeholder: { backgroundColor: "#0A0A0C", alignItems: "center", justifyContent: "center" },
  topBar: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: 16, paddingBottom: 12 },
  topTitle: { fontFamily: fonts.display, fontSize: 22, color: "#fff", textTransform: "uppercase" },
  liveBadge: { flexDirection: "row", alignItems: "center", gap: 7, backgroundColor: "#FF453A", borderRadius: 999, paddingVertical: 5, paddingHorizontal: 11 },
  liveDot: { width: 7, height: 7, borderRadius: 4, backgroundColor: "#fff" },
  liveText: { fontFamily: fonts.bold, fontSize: 12, color: "#fff", letterSpacing: 1 },
  closeBtn: { width: 36, height: 36, borderRadius: 18, alignItems: "center", justifyContent: "center", backgroundColor: "rgba(0,0,0,0.45)" },
  msgWrap: { position: "absolute", left: 16, right: 16, backgroundColor: "rgba(255,69,58,0.92)", borderRadius: 12, padding: 12 },
  msgText: { fontFamily: fonts.semibold, fontSize: 13, color: "#fff", textAlign: "center" },
  controls: { position: "absolute", left: 0, right: 0, bottom: 0, paddingHorizontal: 20, alignItems: "center", gap: 12 },
  goBtn: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 10, backgroundColor: colors.amber, borderRadius: 999, paddingVertical: 16, paddingHorizontal: 40, minWidth: 220 },
  goDot: { width: 12, height: 12, borderRadius: 6, backgroundColor: colors.onAccent },
  goText: { fontFamily: fonts.bold, fontSize: 16, color: colors.onAccent },
  liveControls: { flexDirection: "row", alignItems: "center", gap: 22 },
  roundBtn: { width: 54, height: 54, borderRadius: 27, alignItems: "center", justifyContent: "center", backgroundColor: "rgba(0,0,0,0.5)", borderWidth: 1, borderColor: "rgba(255,255,255,0.25)" },
  stopBtn: { flexDirection: "row", alignItems: "center", gap: 9, backgroundColor: "#FF453A", borderRadius: 999, paddingVertical: 14, paddingHorizontal: 26 },
  stopSquare: { width: 14, height: 14, borderRadius: 3, backgroundColor: "#fff" },
  stopText: { fontFamily: fonts.bold, fontSize: 15, color: "#fff" },
  hint: { fontFamily: fonts.body, fontSize: 11.5, color: "rgba(255,255,255,0.75)", textAlign: "center", paddingHorizontal: 20 },
});
