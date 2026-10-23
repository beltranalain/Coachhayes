// ADMIN · EVALUATIONS — Coach's voice-to-report tool. Pick a film submission,
// record your read of the film (Whisper transcribes it), let AI write the full
// Honest Evaluation from your words, set free / locked, and publish.

import React, { useEffect, useState } from "react";
import { View, Text, StyleSheet, Pressable, TextInput, ActivityIndicator, Alert } from "react-native";
import {
  useAudioRecorder, useAudioRecorderState, RecordingPresets, AudioModule, setAudioModeAsync, } from "expo-audio";
import * as Clipboard from "expo-clipboard";

import { colors, fonts, type ThemeColors } from "../../lib/theme";
import { useColors, useThemedStyles } from "../../lib/ThemeContext";
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
  const colors = useColors();
  const styles = useThemedStyles(makeStyles);
  const [subs, setSubs] = useState<Submission[]>([]);
  const [loading, setLoading] = useState(true);
  const [sel, setSel] = useState<Submission | null>(null);

  const [transcript, setTranscript] = useState("");
  const [draft, setDraft] = useState<EvaluationDraft | null>(null);
  const [access, setAccess] = useState<"free" | "locked">("free");
  const [price, setPrice] = useState("");
  const [busy, setBusy] = useState("");
  const [msg, setMsg] = useState("");
  const [paste, setPaste] = useState("");
  const [copied, setCopied] = useState(false);

  const recorder = useAudioRecorder(RecordingPresets.HIGH_QUALITY);
  const recState = useAudioRecorderState(recorder);

  async function load() {
    try { const d = await fetchSubmissions(); setSubs((d.submissions || []).filter((s) => s.status === "new" || s.status === "reviewing")); }
    catch { /* not authorized / offline */ } finally { setLoading(false); }
  }
  useEffect(() => { load(); }, []);

  function pick(s: Submission) {
    setSel(s); setTranscript(""); setDraft(null); setAccess("free"); setPrice(""); setMsg(""); setPaste(""); setCopied(false);
  }
  function reset() { setSel(null); setTranscript(""); setDraft(null); setMsg(""); setPaste(""); setCopied(false); }

  // ---- ChatGPT fallback (no server AI / no timeout) ----
  // Build a prompt the coach can paste into the ChatGPT app, then paste the
  // reply back here to fill the draft. Same JSON shape the AI writer returns.
  function chatGptPrompt(): string {
    if (!sel) return "";
    const ht = sel.heightIn ? `${Math.floor(sel.heightIn / 12)}'${sel.heightIn % 12}"` : "";
    const lines = [
      `Player: ${sel.playerName || "—"}`,
      sel.position && `Position: ${sel.position}`,
      [sel.school, sel.city, sel.state].filter(Boolean).join(", ") && `School: ${[sel.school, sel.city, sel.state].filter(Boolean).join(", ")}`,
      sel.classYear && `Class: ${sel.classYear}`,
      ht && `Height: ${ht}`,
      sel.weightLb && `Weight: ${sel.weightLb} lb`,
      sel.videoUrl && `Film: ${sel.videoUrl}`,
      sel.notes && `Notes: ${sel.notes}`,
    ].filter(Boolean).join("\n");
    return [
      "You are an experienced high school football recruiting evaluator. Write an honest scouting evaluation of this recruit from the profile and film below. Use a neutral third-person voice — do NOT write in the first person and do NOT attribute it to any person. Pick ONE overall tier. No emojis.",
      "",
      lines,
      "",
      'Reply with ONLY a JSON object (no markdown, no extra text) using exactly these keys: {"size": string, "speed": string, "effort": string, "positionAnalysis": string, "strengths": string[], "improvements": string[], "recommendedTargets": string[], "additionalComments": string, "developmentPriorities": string[], "finalAssessment": string, "projection": string}.',
    ].join("\n");
  }

  async function copyPrompt() {
    const p = chatGptPrompt();
    if (!p) return;
    try { await Clipboard.setStringAsync(p); setCopied(true); setTimeout(() => setCopied(false), 2000); }
    catch { setMsg("Couldn't copy — long-press the box above to copy it manually."); }
  }

  function fillFromPaste() {
    const t = paste.trim();
    if (!t) { setMsg("Paste ChatGPT's reply into the box first."); return; }
    const a = t.indexOf("{"), b = t.lastIndexOf("}");
    if (a < 0 || b < 0) { setMsg("Paste ChatGPT's full reply (it should include the { … } block)."); return; }
    let j: any;
    try { j = JSON.parse(t.slice(a, b + 1)); } catch { setMsg("Couldn't read that — copy ChatGPT's whole reply and try again."); return; }
    const s = (x: any) => (typeof x === "string" ? x : "");
    const arr = (x: any): string[] =>
      Array.isArray(x) ? x.map(String).map((v) => v.trim()).filter(Boolean)
      : typeof x === "string" ? x.split("\n").map((v) => v.trim()).filter(Boolean)
      : [];
    setDraft({
      size: s(j.size), speed: s(j.speed), effort: s(j.effort), positionAnalysis: s(j.positionAnalysis),
      strengths: arr(j.strengths), improvements: arr(j.improvements), recommendedTargets: arr(j.recommendedTargets),
      additionalComments: s(j.additionalComments), developmentPriorities: arr(j.developmentPriorities),
      finalAssessment: s(j.finalAssessment), projection: s(j.projection), evaluatedOn: "",
    });
    setPaste(""); setMsg("Filled from ChatGPT. Review below, set access, then publish.");
  }

  async function toggleRecord() {
    try {
      if (recState.isRecording) {
        await recorder.stop();
        // expo-audio can leave recorder.uri null for a beat right after stop —
        // don't silently no-op; surface it so recording never looks "dead".
        const uri = recorder.uri;
        if (uri) await runTranscribe(uri);
        else setMsg("The recording didn't save. Try again and hold Record a moment before speaking.");
        return;
      }
      const perm = await AudioModule.requestRecordingPermissionsAsync();
      if (!perm.granted) { Alert.alert("Microphone needed", "Allow mic access to record your read of the film."); return; }
      await setAudioModeAsync({ playsInSilentMode: true, allowsRecording: true });
      await recorder.prepareToRecordAsync();
      recorder.record();
      setMsg("");
    } catch { setMsg(recState.isRecording ? "Could not save the recording — try again." : "Could not start recording — check mic permissions."); }
  }

  async function runTranscribe(uri: string) {
    setBusy("transcribe"); setMsg("");
    try {
      const r = await transcribeAudio(uri);
      const text = (r.text || "").trim();
      if (r.ok && text) setTranscript((t) => (t ? `${t}\n\n${text}` : text));
      else if (r.ok) setMsg("No speech detected — move closer to the mic and talk a bit louder, then record again.");
      else setMsg(r.error || "Transcription failed.");
    } catch { setMsg("Transcription failed — check your connection and try again."); } finally { setBusy(""); }
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
          <Text style={styles.genText}>{busy === "gen" ? "Writing…" : "Generate"}</Text>
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

      <View style={styles.gptBox}>
        <Text style={styles.gptLabel}>Or use ChatGPT</Text>
        <Text style={styles.gptHint}>No internet AI needed here. Copy the prompt, paste it into ChatGPT, then paste its reply back below and tap Fill.</Text>
        <View style={styles.recRow}>
          <Pressable onPress={copyPrompt} style={({ pressed }) => [styles.gptCopy, pressed && { opacity: 0.85 }]}>
            <Text style={styles.gptCopyText}>{copied ? "Copied ✓" : "Copy ChatGPT prompt"}</Text>
          </Pressable>
          <Pressable onPress={fillFromPaste} style={({ pressed }) => [styles.gptFill, pressed && { opacity: 0.9 }]}>
            <Text style={styles.gptFillText}>Fill from paste</Text>
          </Pressable>
        </View>
        <TextInput
          value={paste}
          onChangeText={setPaste}
          placeholder="Paste ChatGPT's reply here…"
          placeholderTextColor={colors.dim}
          multiline
          style={styles.transcript}
        />
      </View>

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

const makeStyles = (colors: ThemeColors) => StyleSheet.create({
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
  genText: { fontFamily: fonts.bold, fontSize: 13, color: colors.onAccent },

  transcript: { minHeight: 90, backgroundColor: colors.surface2, borderWidth: 1, borderColor: colors.line, borderRadius: 12, padding: 12, fontFamily: fonts.body, fontSize: 13, color: colors.cream, textAlignVertical: "top" },

  gptBox: { backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.line, borderRadius: 14, padding: 14, marginTop: 12 },
  gptLabel: { fontFamily: fonts.bold, fontSize: 13, color: colors.cream, marginBottom: 4 },
  gptHint: { fontFamily: fonts.body, fontSize: 12, color: colors.muted, lineHeight: 17, marginBottom: 10 },
  gptCopy: { flex: 1, alignItems: "center", justifyContent: "center", backgroundColor: colors.surface2, borderWidth: 1, borderColor: colors.line, borderRadius: 12, paddingVertical: 11 },
  gptCopyText: { fontFamily: fonts.bold, fontSize: 13, color: colors.cream },
  gptFill: { flex: 1, alignItems: "center", justifyContent: "center", backgroundColor: colors.amber, borderRadius: 12, paddingVertical: 11 },
  gptFillText: { fontFamily: fonts.bold, fontSize: 13, color: colors.onAccent },

  preview: { backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.line, borderRadius: 14, padding: 14, marginTop: 12 },
  previewLabel: { fontFamily: fonts.bold, fontSize: 11, letterSpacing: 1, color: colors.amber, textTransform: "uppercase", marginBottom: 8 },
  previewProj: { fontFamily: fonts.semibold, fontSize: 13, color: colors.cream, marginBottom: 6 },
  previewText: { fontFamily: fonts.body, fontSize: 12.5, lineHeight: 19, color: colors.muted },
  previewMeta: { fontFamily: fonts.body, fontSize: 11.5, color: colors.dim, marginTop: 8 },

  accessRow: { flexDirection: "row", gap: 8 },
  accPill: { borderWidth: 1, borderColor: colors.line, borderRadius: 999, paddingVertical: 8, paddingHorizontal: 14, backgroundColor: colors.surface },
  accPillOn: { backgroundColor: colors.amber, borderColor: colors.amber },
  accText: { fontFamily: fonts.semibold, fontSize: 12.5, color: colors.muted },
  accTextOn: { color: colors.onAccent },
  priceInput: { marginTop: 10, backgroundColor: colors.surface2, borderWidth: 1, borderColor: colors.line, borderRadius: 10, paddingVertical: 10, paddingHorizontal: 13, fontFamily: fonts.body, fontSize: 13, color: colors.cream },

  footer: { flexDirection: "row", gap: 10, marginTop: 18 },
  pubBtn: { flex: 1, alignItems: "center", backgroundColor: colors.amber, borderRadius: 12, paddingVertical: 13 },
  pubText: { fontFamily: fonts.bold, fontSize: 14, color: colors.onAccent },
  cancelBtn: { alignItems: "center", justifyContent: "center", borderWidth: 1, borderColor: colors.line, borderRadius: 12, paddingVertical: 13, paddingHorizontal: 20 },
  cancelText: { fontFamily: fonts.semibold, fontSize: 13.5, color: colors.cream },
});
