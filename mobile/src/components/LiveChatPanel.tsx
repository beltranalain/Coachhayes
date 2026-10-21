// Live chat for the app's Live tab — the SAME merged chat as the website: site
// messages (Durable Object WebSocket) + the coach's YouTube live chat (read-only
// mirror), interleaved by time. Signed-in viewers can send to the site chat.

import React, { useEffect, useRef, useState } from "react";
import { View, Text, TextInput, Pressable, ScrollView, StyleSheet } from "react-native";
import { useRouter } from "expo-router";
import { Feather } from "@expo/vector-icons";
import { fonts, type ThemeColors } from "../lib/theme";
import { useColors, useThemedStyles } from "../lib/ThemeContext";
import { useAuth } from "../lib/auth";
import { getFirebaseAuth } from "../lib/firebase";
import { useChat } from "../lib/useChat";

export default function LiveChatPanel({ hostName = "Coach Hayes" }: { hostName?: string }) {
  const colors = useColors();
  const styles = useThemedStyles(makeStyles);
  const router = useRouter();
  const { user, displayName } = useAuth();
  const { messages, count, connected, send } = useChat();
  const [draft, setDraft] = useState("");
  const scrollRef = useRef<ScrollView>(null);

  useEffect(() => { scrollRef.current?.scrollToEnd({ animated: true }); }, [messages.length]);

  const name = (displayName || user?.email?.split("@")[0] || "Viewer").slice(0, 40);
  function onSend() {
    if (!user) { router.push("/signin" as never); return; }
    const uid = getFirebaseAuth().currentUser?.uid || "";
    if (send(name, draft, uid)) setDraft("");
  }

  const recent = messages.slice(-60);

  return (
    <View style={styles.wrap}>
      <View style={styles.head}>
        <Text style={styles.title}>Live chat</Text>
        <Text style={styles.sub}>{connected ? `${count ?? 1} here · Site + YouTube` : "Connecting…"}</Text>
      </View>

      <ScrollView ref={scrollRef} style={styles.body} nestedScrollEnabled contentContainerStyle={{ gap: 9, paddingVertical: 8 }}>
        {recent.length === 0 ? (
          <Text style={styles.empty}>No messages yet. Say hello.</Text>
        ) : (
          recent.map((m) =>
            m.tip ? (
              <View key={m.id} style={styles.tipRow}>
                <Text style={styles.tipText}>{m.name} sent ${m.tip}</Text>
                {!!m.text && <Text style={styles.tipMsg}> {m.text}</Text>}
              </View>
            ) : (
              <View key={m.id} style={styles.msgRow}>
                {m.source === "youtube"
                  ? <Feather name="youtube" size={13} color="#FF0000" style={{ marginTop: 2 }} />
                  : <View style={styles.siteDot} />}
                <Text style={styles.msg}>
                  <Text style={[styles.msgName, m.name === hostName && { color: colors.amber }]}>{m.name} </Text>
                  {m.text}
                </Text>
              </View>
            )
          )
        )}
      </ScrollView>

      <View style={styles.composer}>
        <TextInput
          value={draft}
          onChangeText={setDraft}
          placeholder={user ? `Chatting as ${name}` : "Sign in to chat"}
          placeholderTextColor={colors.dim}
          style={styles.input}
          onSubmitEditing={onSend}
          returnKeyType="send"
          maxLength={280}
        />
        <Pressable onPress={onSend} style={({ pressed }) => [styles.sendBtn, pressed && { opacity: 0.9 }]}>
          <Text style={styles.sendText}>Send</Text>
        </Pressable>
      </View>
    </View>
  );
}

const makeStyles = (colors: ThemeColors) => StyleSheet.create({
  wrap: { marginTop: 14, borderWidth: 1, borderColor: colors.line, borderRadius: 16, backgroundColor: colors.surface, overflow: "hidden" },
  head: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", paddingHorizontal: 14, paddingVertical: 11, borderBottomWidth: 1, borderBottomColor: colors.line },
  title: { fontFamily: fonts.bold, fontSize: 14, color: colors.cream },
  sub: { fontFamily: fonts.body, fontSize: 11, color: colors.dim },
  body: { maxHeight: 300, paddingHorizontal: 14 },
  empty: { fontFamily: fonts.body, fontSize: 13, color: colors.muted, paddingVertical: 10 },
  msgRow: { flexDirection: "row", gap: 7, alignItems: "flex-start" },
  siteDot: { width: 11, height: 11, borderRadius: 3, backgroundColor: colors.amber, marginTop: 3 },
  msg: { flex: 1, fontFamily: fonts.body, fontSize: 13, color: colors.cream, lineHeight: 18 },
  msgName: { fontFamily: fonts.bold, color: colors.cream },
  tipRow: { backgroundColor: "rgba(200,169,107,0.12)", borderRadius: 9, padding: 9 },
  tipText: { fontFamily: fonts.bold, fontSize: 12.5, color: colors.amber },
  tipMsg: { fontFamily: fonts.body, fontSize: 12.5, color: colors.cream },
  composer: { flexDirection: "row", gap: 8, padding: 10, borderTopWidth: 1, borderTopColor: colors.line },
  input: { flex: 1, backgroundColor: colors.surface2, borderWidth: 1, borderColor: colors.line, borderRadius: 11, paddingVertical: 9, paddingHorizontal: 12, fontFamily: fonts.body, fontSize: 13, color: colors.cream },
  sendBtn: { borderRadius: 11, backgroundColor: colors.amber, alignItems: "center", justifyContent: "center", paddingHorizontal: 16 },
  sendText: { fontFamily: fonts.bold, fontSize: 13, color: colors.onAccent },
});
