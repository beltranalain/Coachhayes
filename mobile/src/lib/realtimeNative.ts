// Native (react-native-webrtc) Cloudflare Realtime (Calls) session. This is a
// FAITHFUL port of the website's browser client (New Company/web/lib/
// realtimeClient.ts) so the app speaks the EXACT same backend protocol:
//
//   - one RTCPeerConnection that publishes local tracks (sendonly transceivers)
//     and pulls remote tracks through the SFU;
//   - every Cloudflare call goes through our /api/realtime proxy with the shape
//     { action, sessionId, body } — actions "session", "tracks", "renegotiate";
//   - ontrack maps transceiver.mid -> remote sessionId so callers can tell which
//     participant a remote track belongs to;
//   - pulls are serialized on a single `chain` promise (a peer connection can
//     only run one offer/answer exchange at a time — concurrent pulls glare and
//     silently fail), and requiresImmediateRenegotiation is handled inline.
//
// IMPORTANT: react-native-webrtc is a NATIVE module and CRASHES in Expo Go, so
// this file MUST only ever be imported lazily (require/import) from code paths
// that already checked IS_EXPO_GO === false. Do not import it at module top
// level from anything that loads in Expo Go.

import {
  RTCPeerConnection,
  MediaStream,
  type MediaStreamTrack,
} from "react-native-webrtc";
import { API_BASE } from "./config";

export type RemoteTrackHandler = (sessionId: string, track: MediaStreamTrack) => void;

// Same ICE config as the web client.
const RTC_CONFIG = {
  iceServers: [{ urls: "stun:stun.cloudflare.com:3478" }],
  bundlePolicy: "max-bundle" as const,
};

// All Cloudflare traffic goes through the shared /api/realtime proxy. Unlike the
// web (which fetches a relative "/api/realtime"), the app must use the absolute
// API_BASE so requests hit the same Vercel backend.
function api(action: string, sessionId?: string, body?: unknown) {
  return fetch(`${API_BASE}/api/realtime`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ action, sessionId, body }),
  }).then((r) => r.json());
}

// Resolve once ICE gathering is complete, with a 2.5s fallback (some networks
// never fire "complete"; the partial candidates are enough for the SFU).
function iceComplete(pc: RTCPeerConnection): Promise<void> {
  return new Promise((resolve) => {
    if (pc.iceGatheringState === "complete") return resolve();
    let done = false;
    const finish = () => {
      if (done) return;
      done = true;
      pc.onicegatheringstatechange = null;
      resolve();
    };
    // react-native-webrtc types the `on*` setters (not addEventListener), so we
    // use the setter here. It behaves the same for a single listener.
    pc.onicegatheringstatechange = () => {
      if (pc.iceGatheringState === "complete") finish();
    };
    setTimeout(finish, 2500);
  });
}

export class RealtimeSession {
  pc: RTCPeerConnection;
  sessionId = "";
  private midToSession = new Map<string, string>();
  // Serialize renegotiations: a single RTCPeerConnection can only run one
  // offer/answer exchange at a time. Concurrent pulls would otherwise collide
  // (glare) and silently fail. Every pull runs through this chain in order.
  private chain: Promise<unknown> = Promise.resolve();

  constructor(private onRemoteTrack: RemoteTrackHandler) {
    this.pc = new RTCPeerConnection(RTC_CONFIG);
    // The track event carries the transceiver whose mid we mapped to a remote
    // sessionId. react-native-webrtc types the `ontrack` setter (not
    // addEventListener), so we use it — same behavior as the web client's
    // pc.ontrack.
    this.pc.ontrack = ((e: any) => {
      const mid = e?.transceiver?.mid || "";
      const sid = this.midToSession.get(mid) || "unknown";
      if (e?.track) this.onRemoteTrack(sid, e.track);
    }) as never;
  }

  // Deprecated: the session is created during publish() (Cloudflare requires an
  // offer on sessions/new). Kept so older callers don't break.
  async create(): Promise<string> {
    return this.sessionId;
  }

  // Publish local audio/video. Creates the SFU session (with the offer) and then
  // registers the track names. Returns the track names ("video"/"audio").
  async publish(stream: MediaStream): Promise<string[]> {
    const entries = stream.getTracks().map((t) => ({
      trackName: t.kind, // "audio" | "video"
      transceiver: this.pc.addTransceiver(t, { direction: "sendonly" }),
    }));

    // 1) Create the session WITH an offer that carries the transceivers.
    await this.pc.setLocalDescription(await this.pc.createOffer());
    await iceComplete(this.pc);
    const sess = await api("session", undefined, {
      sessionDescription: { type: "offer", sdp: this.pc.localDescription!.sdp },
    });
    if (!sess?.sessionId) throw new Error("Realtime session failed (is it configured?)");
    this.sessionId = sess.sessionId;
    if (sess.sessionDescription) await this.pc.setRemoteDescription(sess.sessionDescription);

    // 2) Register the track names (mid -> trackName) with a fresh offer.
    const tracks = entries.map((e) => ({ location: "local", mid: e.transceiver.mid, trackName: e.trackName }));
    await this.pc.setLocalDescription(await this.pc.createOffer());
    const d = await api("tracks", this.sessionId, {
      sessionDescription: { type: "offer", sdp: this.pc.localDescription!.sdp },
      tracks,
    });
    if (d?.sessionDescription) await this.pc.setRemoteDescription(d.sessionDescription);
    return entries.map((e) => e.trackName);
  }

  // Pull one or more of a remote participant's tracks ("video"/"audio"). Pass an
  // array to pull both in a SINGLE negotiation (avoids a second renegotiation
  // and the glare it can cause). Runs on the serialized chain.
  async pull(remoteSessionId: string, trackName: string | string[]): Promise<void> {
    const names = Array.isArray(trackName) ? trackName : [trackName];
    const run = this.chain.then(() => this.doPull(remoteSessionId, names));
    this.chain = run.catch(() => {}); // keep the chain alive even if one pull fails
    return run;
  }

  private async doPull(remoteSessionId: string, names: string[]): Promise<void> {
    const d = await api("tracks", this.sessionId, {
      tracks: names.map((trackName) => ({ location: "remote", sessionId: remoteSessionId, trackName })),
    });
    (d?.tracks || []).forEach((t: any) => {
      if (t.mid) this.midToSession.set(t.mid, remoteSessionId);
    });
    if (d?.requiresImmediateRenegotiation && d?.sessionDescription) {
      await this.pc.setRemoteDescription(d.sessionDescription);
      const answer = await this.pc.createAnswer();
      await this.pc.setLocalDescription(answer);
      await api("renegotiate", this.sessionId, {
        sessionDescription: { type: "answer", sdp: this.pc.localDescription!.sdp },
      });
    }
  }

  close() {
    try { this.pc.close(); } catch {}
  }
}
