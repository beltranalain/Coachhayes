// ADMIN · EVALUATIONS — Coach's voice-to-report tool. Pick a film submission,
// record your read of the film (Whisper transcribes it), let AI write the full
// Honest Evaluation from your words, set free / locked, and publish.

import React, { useEffect, useState } from "react";
import { View, Text, StyleSheet, Pressable, TextInput, ActivityIndicator, Alert } from "react-native";
import {
  useAudioRecorder, useAudioRecorderState, RecordingPresets, AudioModule, setAudioModeAsync,
} from "expo-audio";

import { colors, fonts } from "../../lib/theme";
import { AdminScaffold } from "../../components/AdminScaffold";
import {
  fetchSubmissions, transcribeAudio, generateEvaluation, savePlayerEval,
  type Submission, type EvaluationDraft,
} from "../../lib/adminApi";

export default function EvaluationsScreen() {
  return (
    <AdminScaffold eyebrow="Coach Hayes · Control Room" title="Evaluations" require="evaluations">
      <Inner />
    </AdminScaffold>
  );
}

function metaOf(s: Submission): string {
  return [s.position, s.school, s.state, s.classYear].filter(Boolean).join(" · ");
}
function fmtDur(ms: number): string {
  const t = Math.floor(ms / 1000); return `${Math.floor(t / 60)}:${String(t % 60).padStart(2, "0")}`;
}

function Inner() {
  const [subs, setSubs] = useState<Submission[]>([]);
  const [loading, setLoading] = useState(true);
  const [sel, setSel] = useState<Submission | null>(null);

  const [transcript, setTranscript] = useState("");
  const [draft, setDraft] = useState<EvaluationDraft | null>(null);
  const [access, setAccess] = useState<"free" | "locked">("free");
  const [price, setPrice] = useState("");
  const [busy, setBusy] = useState("");
  const [msg, setMsg] = useState("");

  const recorder = useAudioRecorder(RecordingPresets.HIGH_QUALITY);
  const recState = useAudioRecorderState(recorder);

  async function load() {
    try { const d = await fetchSubmissions(); setSubs((d.submissions || []).filter((s) => s.status === "new" || s.status === "reviewing")); }
    catch { /* not authorized / offline */ } finally { setLoading(false); }
  }
  useEffect(() => { load(); }, []);

  function pick(s: Submission) {
    setSel(s); setTranscript(""); setDraft(null); setAccess("free"); setPrice(""); setMsg("");
  }
  function reset() { setSel(null); setTranscript(""); setDraft(null); setMsg(""); }

  async function toggleRecord() {
    try {
      if (recState.isRecording) {
        await recorder.stop();
        const uri = recorder.uri;
        if (uri) await runTranscribe(uri);
        return;
      }
      const perm = await AudioModule.requestRecordingPermissionsAsync();
      if (!perm.granted) { Alert.alert("Microphone needed", "Allow mic access to record your read of the film."); return; }
      await setAudioModeAsync({ playsInSilentMode: true, allowsRecording: true });
      await recorder.prepareToRecordAsync();
      recorder.record();
      setMsg("");
    } catch { setMsg("Could not start recording."); }
  }

  async function runTranscribe(uri: string) {
    setBusy("transcribe"); setMsg("");
    try {
      const r = await transcribeAudio(uri);
      if (r.ok && r.text) setTranscript((t) => (t ? `${t}\n\n${r.text}` : r.text!).trim());
      else setMsg(r.error || "Transcription failed.");
    } catch { setMsg("Transcription failed."); } finally { setBusy(""); }
  }

  async function generate() {
    if (!sel) return;
    setBusy("gen"); setMsg("");
    try {
      const r = await generateEvaluation({
        submissionId: sel.id, playerName: sel.playerName, position: sel.position, school: sel.school,
        city: sel.city, state: sel.state, classYear: sel.classYear, heightIn: sel.heightIn, weightLb: sel.weightLb,
        videoUrl: sel.videoUrl, notes: sel.notes, transcript,
      });
      if (r.ok && r.evaluation) { setDraft(r.evaluation); setMsg("Draft written. Review, set access, then publish."); }
      else setMsg(r.error || "Could not generate the evaluation.");
    } catch { setMsg("Could not generate the evaluation."); } finally { setBusy(""); }
  }

  async function publish() {
    if (!sel || !draft) return;
    setBusy("pub"); setMsg("");
    try {
      const r = await savePlayerEval({
        name: sel.playerName, position: sel.position, school: sel.school, city: sel.city, state: sel.state,
        classYear: sel.classYear, heightIn: sel.heightIn, weightLb: sel.weightLb, videoUrl: sel.videoUrl,
        evaluation: draft, evalAccess: access, evalPrice: price, fromSubmissionId: sel.id, published: true, announce: false,
      });
      if (r.ok) { setMsg("Published."); reset(); load(); }
      else setMsg(r.error || "Publish failed.");
    } catch { setMsg("Publish failed."); } finally { setBusy(""); }
  }

  if (loading) return <ActivityIndicator color={colors.amber} style={{ marginTop: 20 }} />;

  // ---- Submission list ----
  if (!sel) {
    return (
      <View>
        {!!msg && <Text style={styles.msg}>{msg}</Text>}
        <Text style={styles.section}>Film submissions</Text>
        <Text style={styles.hint}>Pick a submission, record your read, and AI writes the report from your words.</Text>
        {subs.length === 0 ? (
          <Text style={styles.empty}>No submissions waiting. They arrive from the public Rankings page.</Text>
        ) : subs.map((s) => (
          <Pressable key={s.id} onPress={() => pick(s)} style={({ pressed }) => [styles.subRow, pressed && { opacity: 0.8 }]}>
            <View style={{ flex: 1 }}>
              <Text style={styles.subName}>{s.playerName}</Text>
              <Text style={styles.subMeta}>{metaOf(s)}</Text>
            </View>
            <Text style={styles.arrow}>›</Text>
          </Pressable>
        ))}
      </View>
    );
  }

  // ---- Evaluate flow ----
  return (
    <View>
      {!!msg && <Text style={styles.msg}>{msg}</Text>}

      <View style={styles.playerCard}>
        <Text style={styles.subName}>{sel.playerName}</Text>
        <Text style={styles.subMeta}>{metaOf(sel)}</Text>
      </View>

      <Text style={styles.section}>Coach&apos;s read of the film</Text>
      <View style={styles.recRow}>
        <Pressable onPress={toggleRecord} disabled={busy === "transcribe"} style={({ pressed }) => [styles.recBtn, recState.isRecording && styles.recBtnOn, pressed && { opacity: 0.85 }]}>
          <View style={[styles.recDot, recState.isRecording && { borderRadius: 3, width: 12, height: 12 }]} />
          <Text style={styles.recText}>{recState.isRecording ? `Stop · ${fmtDur(recState.durationMillis || 0)}` : busy === "transcribe" ? "Transcribing…" : "Record"}</Text>
        </Pressable>
        <Pressable onPress={generate} disabled={busy === "gen"} style={({ pressed }) => [styles.genBtn, pressed && { opacity: 0.9 }]}>
          <Text style={styles.genText}>{busy === "gen" ? "Writing…" : "Generate with AI"}</Text>
        </Pressable>
      </View>

      <TextInput
        value={transcript}
        onChangeText={setTranscript}
        placeholder="Record your read, or type notes here. AI builds the evaluation from this plus the profile."
        placeholderTextColor={colors.dim}
        multiline
        style={styles.transcript}
      />

      {draft && (
        <View style={styles.preview}>
          <Text style={styles.previewLabel}>Generated evaluation</Text>
          {!!draft.projection && <Text style={styles.previewProj}>Projection: {draft.projection}</Text>}
          {!!draft.finalAssessment && <Text style={styles.previewText} numberOfLines={5}>{draft.finalAssessment}</Text>}
          <Text style={styles.previewMeta}>{draft.strengths.length} strengths · {draft.improvements.length} to improve · {draft.recommendedTargets.length} targets</Text>
        </View>
      )}

      <Text style={styles.section}>Access</Text>
      <View style={styles.accessRow}>
        <Pressable onPress={() => setAccess("free")} style={[styles.accPill, access === "free" && styles.accPillOn]}><Text style={[styles.accText, access === "free" && styles.accTextOn]}>Free — anyone</Text></Pressable>
        <Pressable onPress={() => setAccess("locked")} style={[styles.accPill, access === "locked" && styles.accPillOn]}><Text style={[styles.accText, access === "locked" && styles.accTextOn]}>Locked — paid</Text></Pressable>
      </View>
      {access === "locked" && (
        <TextInput value={price} onChangeText={setPrice} placeholder="Price to show, e.g. $49" placeholderTextColor={colors.dim} style={styles.priceInput} />
      )}

      <View style={styles.footer}>
        <Pressable onPress={publish} disabled={!draft || busy === "pub"} style={({ pressed }) => [styles.pubBtn, (!draft || busy === "pub") && { opacity: 0.5 }, pressed && { opacity: 0.9 }]}>
          <Text style={styles.pubText}>{busy === "pub" ? "Publishing…" : "Save & publish"}</Text>
        </Pressable>
        <Pressable onPress={reset} style={({ pressed }) => [styles.cancelBtn, pressed && { opacity: 0.8 }]}><Text style={styles.cancelText}>Cancel</Text></Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  msg: { fontFamily: fonts.semibold, fontSize: 12.5, color: colors.amber, backgroundColor: "rgba(200,169,107,0.1)", borderRadius: 10, padding: 11, marginBottom: 14 },
  section: { fontFamily: fonts.bold, fontSize: 13, color: colors.cream, marginTop: 10, marginBottom: 6 },
  hint: { fontFamily: fonts.body, fontSize: 12, color: colors.muted, marginBottom: 12 },
  empty: { fontFamily: fonts.body, fontSize: 13, color: colors.muted, paddingVertical: 10 },

  subRow: { flexDirection: "row", alignItems: "center", backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.line, borderRadius: 14, padding: 15, marginBottom: 10 },
  subName: { fontFamily: fonts.bold, fontSize: 14.5, color: colors.cream },
  subMeta: { fontFamily: fonts.body, fontSize: 12, color: colors.muted, marginTop: 3 },
  arrow: { fontFamily: fonts.body, fontSize: 22, color: colors.dim },

  playerCard: { backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.line, borderRadius: 14, padding: 14, marginBottom: 8 },

  recRow: { flexDirection: "row", gap: 9, marginBottom: 10 },
  recBtn: { flexDirection: "row", alignItems: "center", gap: 8, borderWidth: 1, borderColor: colors.line, backgroundColor: colors.surface, borderRadius: 12, paddingVertical: 11, paddingHorizontal: 15 },
  recBtnOn: { borderColor: colors.live, backgroundColor: "rgba(255,69,58,0.1)" },
  recDot: { width: 11, height: 11, borderRadius: 6, backgroundColor: colors.live },
  recText: { fontFamily: fonts.bold, fontSize: 13, color: colors.cream },
  genBtn: { flex: 1, alignItems: "center", justifyContent: "center", backgroundColor: colors.amber, borderRadius: 12, paddingVertical: 11 },
  genText: { fontFamily: fonts.bold, fontSize: 13, color: "#171204" },

  transcript: { minHeight: 90, backgroundColor: colors.surface2, borderWidth: 1, borderColor: colors.line, borderRadius: 12, padding: 12, fontFamily: fonts.body, fontSize: 13, color: colors.cream, textAlignVertical: "top" },

  preview: { backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.line, borderRadius: 14, padding: 14, marginTop: 12 },
  previewLabel: { fontFamily: fonts.bold, fontSize: 11, letterSpacing: 1, color: colors.amber, textTransform: "uppercase", marginBottom: 8 },
  previewProj: { fontFamily: fonts.semibold, fontSize: 13, color: colors.cream, marginBottom: 6 },
  previewText: { fontFamily: fonts.body, fontSize: 12.5, lineHeight: 19, color: colors.muted },
  previewMeta: { fontFamily: fonts.body, fontSize: 11.5, color: colors.dim, marginTop: 8 },

  accessRow: { flexDirection: "row", gap: 8 },
  accPill: { borderWidth: 1, borderColor: colors.line, borderRadius: 999, paddingVertical: 8, paddingHorizontal: 14, backgroundColor: colors.surface },
  accPillOn: { backgroundColor: colors.amber, borderColor: colors.amber },
  accText: { fontFamily: fonts.semibold, fontSize: 12.5, color: colors.muted },
  accTextOn: { color: "#171204" },
  priceInput: { marginTop: 10, backgroundColor: colors.surface2, borderWidth: 1, borderColor: colors.line, borderRadius: 10, paddingVertical: 10, paddingHorizontal: 13, fontFamily: fonts.body, fontSize: 13, color: colors.cream },

  footer: { flexDirection: "row", gap: 10, marginTop: 18 },
  pubBtn: { flex: 1, alignItems: "center", backgroundColor: colors.amber, borderRadius: 12, paddingVertical: 13 },
  pubText: { fontFamily: fonts.bold, fontSize: 14, color: "#171204" },
  cancelBtn: { alignItems: "center", justifyContent: "center", borderWidth: 1, borderColor: colors.line, borderRadius: 12, paddingVertical: 13, paddingHorizontal: 20 },
  cancelText: { fontFamily: fonts.semibold, fontSize: 13.5, color: colors.cream },
});
