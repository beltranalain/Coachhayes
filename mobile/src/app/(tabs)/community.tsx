// COMMUNITY — the real feed. Stories (shows), a working composer (text / photo /
// clip / poll), and posts with like / reply / save that call the live API. All
// icons are vector icons (no emojis).

import React, { useEffect, useState, useCallback, useRef } from "react";
import { View, Text, StyleSheet, FlatList, Pressable, ActivityIndicator, TextInput, Image as RNImage, ScrollView, Alert } from "react-native";
import { Image } from "expo-image";
import { Feather, Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import * as ImagePicker from "expo-image-picker";

import { colors, fonts, type ThemeColors } from "../../lib/theme";
import { useColors, useThemedStyles } from "../../lib/ThemeContext";
import {
  fetchFeed, fetchSeries, likePost, savePost, votePost, fetchComments, addComment, createPost,
  timeAgo, youtubeId, type FeedPost, type Series, type Comment,
} from "../../lib/api";
import { useAuth } from "../../lib/auth";
import { PlayTriangle, watchHref } from "../../components/PlayerCard";
import PlayerBreakdownCard from "../../components/PlayerBreakdownCard";

export default function CommunityScreen() {
  const colors = useColors();
  const styles = useThemedStyles(makeStyles);
  const router = useRouter();
  const { user, displayName } = useAuth();
  const uid = user?.uid;
  const [posts, setPosts] = useState<FeedPost[]>([]);
  const [series, setSeries] = useState<Series[]>([]);
  const [loading, setLoading] = useState(true);
  const [showFilter, setShowFilter] = useState<string | null>(null);
  const listRef = useRef<FlatList>(null);
  const composerRef = useRef<TextInput>(null);

  // Composer
  const [text, setText] = useState("");
  const [imageData, setImageData] = useState<string | null>(null);
  const [panel, setPanel] = useState<"poll" | null>(null);
  const [pollA, setPollA] = useState("");
  const [pollB, setPollB] = useState("");
  const [posting, setPosting] = useState(false);

  const requireAuth = useCallback(() => { router.push("/signin"); }, [router]);

  async function load() {
    try {
      const [f, s] = await Promise.all([fetchFeed("general"), fetchSeries()]);
      setPosts(f.posts || []); setSeries(s || []);
    } catch {} finally { setLoading(false); }
  }
  useEffect(() => { load(); }, []);

  function onCompose() {
    if (!user) return requireAuth();
    listRef.current?.scrollToOffset({ offset: 0, animated: true });
    setTimeout(() => composerRef.current?.focus(), 350);
  }

  function updatePost(id: string, patch: Partial<FeedPost>) {
    setPosts((ps) => ps.map((p) => (p.id === id ? { ...p, ...patch } : p)));
  }

  async function onLike(p: FeedPost) {
    if (!uid) return requireAuth();
    const liked = p.likedBy.includes(uid);
    const likedBy = liked ? p.likedBy.filter((x) => x !== uid) : [...p.likedBy, uid];
    updatePost(p.id, { likedBy, likes: likedBy.length }); // optimistic
    const r = await likePost(p.id);
    if (typeof r.likes === "number") updatePost(p.id, { likes: r.likes });
  }
  async function onSave(p: FeedPost) {
    if (!uid) return requireAuth();
    const saved = p.savedBy.includes(uid);
    const savedBy = saved ? p.savedBy.filter((x) => x !== uid) : [...p.savedBy, uid];
    updatePost(p.id, { savedBy });
    await savePost(p.id);
  }
  async function onVote(p: FeedPost, i: number) {
    if (!uid) return requireAuth();
    if (!p.poll || p.poll.votedBy?.[uid] !== undefined) return;
    updatePost(p.id, { poll: { ...p.poll, votedBy: { ...p.poll.votedBy, [uid]: i } } });
    await votePost(p.id, i);
  }

  async function pickImage() {
    if (!uid) return requireAuth();
    const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!perm.granted) { Alert.alert("Photos needed", "Allow photo access to attach an image."); return; }
    const res = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ["images"], allowsEditing: true, quality: 0.4, base64: true });
    if (!res.canceled && res.assets?.[0]?.base64) {
      const data = `data:image/jpeg;base64,${res.assets[0].base64}`;
      if (data.length > 880000) Alert.alert("Image too large", "Please choose a smaller image."); else { setImageData(data); setPanel(null); }
    }
  }

  async function submit() {
    if (!uid) return requireAuth();
    const poll = panel === "poll" && pollA.trim() && pollB.trim() ? { options: [pollA.trim(), pollB.trim()] } : null;
    if (!text.trim() && !imageData && !poll) { Alert.alert("Add something to post."); return; }
    setPosting(true);
    try {
      const r = await createPost({ text: text.trim(), image: imageData, poll });
      if (r.post) {
        setPosts((ps) => [r.post as FeedPost, ...ps]);
        setText(""); setImageData(null); setPollA(""); setPollB(""); setPanel(null);
      } else Alert.alert("Could not post", r.error || "Try again.");
    } finally { setPosting(false); }
  }

  const visible = showFilter ? posts.filter((p) => p.show === showFilter) : posts;

  const header = (
    <View>
      {series.length > 0 && (
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.stories}>
          {series.map((s) => {
            const on = showFilter === s.key;
            return (
              <Pressable key={s.key} onPress={() => setShowFilter(on ? null : s.key)} style={styles.story}>
                <View style={[styles.storyRing, on && { borderColor: colors.amber }]}>
                  {s.image ? <Image source={{ uri: s.image }} style={styles.storyImg} contentFit="cover" /> : <View style={styles.storyImg} />}
                </View>
                <Text style={[styles.storyLabel, on && { color: colors.amber }]} numberOfLines={1}>{s.title}</Text>
              </Pressable>
            );
          })}
        </ScrollView>
      )}

      {/* Composer */}
      <View style={styles.composer}>
        <View style={styles.cTop}>
          <View style={styles.cAv}><Text style={styles.cAvText}>{(user ? displayName : "?").slice(0, 1).toUpperCase()}</Text></View>
          <TextInput
            ref={composerRef}
            value={text} onChangeText={setText}
            placeholder={user ? "Say something…" : "Sign in to post…"}
            placeholderTextColor={colors.dim} style={styles.cInput} multiline
            onFocus={() => { if (!user) requireAuth(); }}
          />
        </View>

        {imageData && (
          <View style={styles.previewWrap}>
            <RNImage source={{ uri: imageData }} style={styles.preview} />
            <Pressable onPress={() => setImageData(null)} style={styles.previewX}><Feather name="x" size={14} color="#fff" /></Pressable>
          </View>
        )}
        {panel === "poll" && (
          <View style={{ gap: 8, marginTop: 10 }}>
            <TextInput value={pollA} onChangeText={setPollA} placeholder="Option 1" placeholderTextColor={colors.dim} style={styles.panelInput} />
            <TextInput value={pollB} onChangeText={setPollB} placeholder="Option 2" placeholderTextColor={colors.dim} style={styles.panelInput} />
          </View>
        )}

        <View style={styles.cRow}>
          <Pressable onPress={pickImage} style={styles.cChip}>
            <Feather name="image" size={14} color={colors.muted} /><Text style={styles.cChipText}>Photo</Text>
          </Pressable>
          <Pressable onPress={() => setPanel(panel === "poll" ? null : "poll")} style={[styles.cChip, panel === "poll" && styles.cChipOn]}>
            <Feather name="bar-chart-2" size={14} color={panel === "poll" ? colors.amber : colors.muted} /><Text style={[styles.cChipText, panel === "poll" && { color: colors.amber }]}>Poll</Text>
          </Pressable>
          <Pressable onPress={submit} disabled={posting} style={styles.postBtn}>
            <Text style={styles.postBtnText}>{posting ? "…" : "Post"}</Text>
          </Pressable>
        </View>
      </View>
    </View>
  );

  if (loading) return <View style={styles.center}><ActivityIndicator color={colors.amber} /></View>;

  return (
    <>
      <FlatList
        ref={listRef}
        data={visible}
        keyExtractor={(p) => p.id}
        ListHeaderComponent={header}
        contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: 90, paddingTop: 14 }}
        renderItem={({ item }) => (
          <PostCard post={item} uid={uid} onLike={() => onLike(item)} onSave={() => onSave(item)} onVote={(i) => onVote(item, i)}
            onPlay={(id, name) => router.push(watchHref(id, name) as never)} requireAuth={requireAuth} onCount={(n) => updatePost(item.id, { commentCount: n })} />
        )}
        ListEmptyComponent={<Text style={styles.empty}>No posts yet.</Text>}
      />

      {/* Compose FAB */}
      <Pressable onPress={onCompose} style={({ pressed }) => [styles.fab, pressed && { opacity: 0.9, transform: [{ scale: 0.96 }] }]} accessibilityLabel="New post">
        <Feather name="plus" size={26} color={colors.onAccent} />
      </Pressable>
    </>
  );
}

function PostCard({ post, uid, onLike, onSave, onVote, onPlay, requireAuth, onCount }: {
  post: FeedPost; uid?: string; onLike: () => void; onSave: () => void; onVote: (i: number) => void;
  onPlay: (id: string, name: string) => void; requireAuth: () => void; onCount: (n: number) => void;
}) {
  const colors = useColors();
  const styles = useThemedStyles(makeStyles);
  const clipId = youtubeId(post.clip || undefined);
  const liked = !!uid && post.likedBy.includes(uid);
  const saved = !!uid && post.savedBy.includes(uid);

  const [open, setOpen] = useState(false);
  const [comments, setComments] = useState<Comment[]>([]);
  const [cText, setCText] = useState("");
  const [loadingC, setLoadingC] = useState(false);

  async function toggleReplies() {
    const next = !open; setOpen(next);
    if (next && comments.length === 0) {
      setLoadingC(true);
      try { const d = await fetchComments(post.id); setComments(d.comments || []); } catch {} finally { setLoadingC(false); }
    }
  }
  async function send() {
    if (!uid) return requireAuth();
    const t = cText.trim(); if (!t) return;
    setCText("");
    const r = await addComment(post.id, t);
    if (r.comment) { setComments((c) => [...c, r.comment as Comment]); onCount((post.commentCount || 0) + 1); }
  }

  const pollTotal = post.poll ? Object.keys(post.poll.votedBy || {}).length : 0;
  const myVote = post.poll && uid ? post.poll.votedBy?.[uid] : undefined;

  return (
    <View style={styles.post}>
      <View style={styles.pHead}>
        {post.picture ? <Image source={{ uri: post.picture }} style={styles.pAv} contentFit="cover" /> : <View style={styles.pAvFallback}><Text style={styles.pAvText}>{(post.author || "?").slice(0, 1).toUpperCase()}</Text></View>}
        <View style={{ flex: 1 }}>
          <Text style={styles.pAuthor}>{post.author}</Text>
          <Text style={styles.pTime}>{timeAgo(post.ts)}</Text>
        </View>
      </View>

      {post.kind === "player" && post.player ? (
        <PlayerBreakdownCard p={post.player} />
      ) : (
        !!post.text && <Text style={styles.pText}>{post.text}</Text>
      )}

      {post.image ? (
        <Image source={{ uri: post.image }} style={styles.pImage} contentFit="cover" />
      ) : clipId ? (
        <Pressable onPress={() => onPlay(clipId, post.author)} style={styles.clip}>
          <Image source={{ uri: `https://i.ytimg.com/vi/${clipId}/hqdefault.jpg` }} style={styles.clipThumb} contentFit="cover" />
          <View style={styles.clipPlay}><PlayTriangle /></View>
        </Pressable>
      ) : null}

      {post.poll && (
        <View style={{ marginTop: 11, gap: 7 }}>
          {post.poll.options.map((o, i) => {
            const count = Object.values(post.poll!.votedBy || {}).filter((v) => v === i).length;
            const pct = pollTotal ? Math.round((count / pollTotal) * 100) : 0;
            const voted = myVote !== undefined;
            return (
              <Pressable key={i} onPress={() => onVote(i)} style={styles.pollOpt}>
                {voted && <View style={[styles.pollFill, { width: `${pct}%` }, myVote === i && { backgroundColor: "rgba(200,169,107,0.28)" }]} />}
                <Text style={styles.pollLabel}>{o}</Text>
                {voted && <Text style={styles.pollPct}>{pct}%</Text>}
              </Pressable>
            );
          })}
          <Text style={styles.pTime}>{pollTotal} vote{pollTotal === 1 ? "" : "s"}{!uid ? " · sign in to vote" : ""}</Text>
        </View>
      )}

      <View style={styles.pActions}>
        <Pressable onPress={onLike} hitSlop={8} style={styles.action}>
          <Ionicons name={liked ? "heart" : "heart-outline"} size={18} color={liked ? colors.live : colors.muted} />
          {post.likes > 0 && <Text style={styles.actionText}>{post.likes}</Text>}
        </Pressable>
        <Pressable onPress={toggleReplies} hitSlop={8} style={styles.action}>
          <Feather name="message-circle" size={17} color={colors.muted} />
          <Text style={styles.actionText}>Reply{post.commentCount > 0 ? ` ${post.commentCount}` : ""}</Text>
        </Pressable>
        <Pressable onPress={onSave} hitSlop={8} style={[styles.action, { marginLeft: "auto" }]}>
          <Feather name="bookmark" size={17} color={saved ? colors.amber : colors.muted} />
          <Text style={[styles.actionText, saved && { color: colors.amber }]}>{saved ? "Saved" : "Save"}</Text>
        </Pressable>
      </View>

      {open && (
        <View style={styles.comments}>
          {loadingC ? <ActivityIndicator color={colors.amber} style={{ marginVertical: 8 }} /> : comments.length === 0 ? (
            <Text style={styles.noReplies}>No replies yet. Be the first.</Text>
          ) : comments.map((c) => (
            <View key={c.id} style={styles.comment}>
              <View style={styles.cmAv}><Text style={styles.cmAvText}>{(c.author || "?").slice(0, 1).toUpperCase()}</Text></View>
              <Text style={styles.cmBody}><Text style={styles.cmName}>{c.author} </Text>{c.text}<Text style={styles.cmTime}>  {timeAgo(c.ts)}</Text></Text>
            </View>
          ))}
          <View style={styles.replyRow}>
            <TextInput value={cText} onChangeText={setCText} placeholder={uid ? "Add a reply…" : "Sign in to reply"} placeholderTextColor={colors.dim} style={styles.replyInput} onFocus={() => { if (!uid) requireAuth(); }} onSubmitEditing={send} returnKeyType="send" />
            <Pressable onPress={send} style={styles.replySend}><Text style={styles.replySendText}>Send</Text></Pressable>
          </View>
        </View>
      )}
    </View>
  );
}

const makeStyles = (colors: ThemeColors) => StyleSheet.create({
  center: { flex: 1, alignItems: "center", justifyContent: "center", backgroundColor: colors.bg },
  empty: { fontFamily: fonts.body, color: colors.muted, fontSize: 13.5, textAlign: "center", paddingVertical: 40 },

  fab: { position: "absolute", right: 18, bottom: 22, width: 56, height: 56, borderRadius: 28, backgroundColor: colors.amber, alignItems: "center", justifyContent: "center", shadowColor: "#000", shadowOpacity: 0.4, shadowRadius: 10, shadowOffset: { width: 0, height: 5 }, elevation: 8 },

  stories: { gap: 14, paddingBottom: 14, paddingRight: 4 },
  story: { alignItems: "center", width: 62 },
  storyRing: { width: 56, height: 56, borderRadius: 28, borderWidth: 2, borderColor: colors.line, padding: 2 },
  storyImg: { width: "100%", height: "100%", borderRadius: 26, backgroundColor: colors.surface2 },
  storyLabel: { fontSize: 10, color: colors.muted, marginTop: 5, fontFamily: fonts.medium, maxWidth: 62 },

  composer: { borderWidth: 1, borderColor: colors.line, borderRadius: 16, padding: 14, marginBottom: 14, backgroundColor: colors.surface },
  cTop: { flexDirection: "row", gap: 11, alignItems: "flex-start" },
  cAv: { width: 34, height: 34, borderRadius: 17, backgroundColor: colors.amber, alignItems: "center", justifyContent: "center" },
  cAvText: { fontFamily: fonts.bold, fontSize: 13, color: colors.onAccent },
  cInput: { flex: 1, fontFamily: fonts.body, fontSize: 14, color: colors.cream, paddingTop: 7, minHeight: 34, maxHeight: 120 },
  previewWrap: { marginTop: 10, position: "relative" },
  preview: { width: "100%", height: 160, borderRadius: 12, backgroundColor: colors.surface2 },
  previewX: { position: "absolute", top: 8, right: 8, width: 26, height: 26, borderRadius: 13, backgroundColor: "rgba(0,0,0,0.65)", alignItems: "center", justifyContent: "center" },
  panelInput: { marginTop: 10, backgroundColor: colors.surface2, borderWidth: 1, borderColor: colors.line, borderRadius: 10, paddingVertical: 9, paddingHorizontal: 12, fontFamily: fonts.body, fontSize: 13, color: colors.cream },
  cRow: { flexDirection: "row", alignItems: "center", gap: 8, borderTopWidth: 1, borderTopColor: colors.lineSoft, paddingTop: 12, marginTop: 12 },
  cChip: { flex: 1, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 6, borderWidth: 1, borderColor: colors.line, borderRadius: 999, paddingVertical: 9 },
  cChipOn: { borderColor: colors.amber },
  cChipText: { fontFamily: fonts.semibold, fontSize: 12.5, color: colors.muted },
  postBtn: { flex: 1, alignItems: "center", justifyContent: "center", backgroundColor: colors.amber, borderWidth: 1, borderColor: colors.amber, borderRadius: 999, paddingVertical: 9 },
  postBtnText: { fontFamily: fonts.bold, fontSize: 13, color: colors.onAccent },

  post: { backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.line, borderRadius: 16, padding: 14, marginBottom: 14 },
  pHead: { flexDirection: "row", alignItems: "center", gap: 10, marginBottom: 10 },
  pAv: { width: 34, height: 34, borderRadius: 17 },
  pAvFallback: { width: 34, height: 34, borderRadius: 17, backgroundColor: colors.surface2, alignItems: "center", justifyContent: "center" },
  pAvText: { fontFamily: fonts.bold, fontSize: 12, color: colors.amber },
  pAuthor: { fontFamily: fonts.bold, fontSize: 13.5, color: colors.cream },
  pTime: { fontFamily: fonts.body, fontSize: 11, color: colors.muted, marginTop: 1 },
  pText: { fontFamily: fonts.body, fontSize: 13.5, lineHeight: 20, color: colors.cream },

  pImage: { width: "100%", aspectRatio: 16 / 10, borderRadius: 12, marginTop: 11, backgroundColor: colors.surface2 },
  clip: { marginTop: 11, borderRadius: 12, overflow: "hidden", aspectRatio: 16 / 9, backgroundColor: "#000", alignItems: "center", justifyContent: "center" },
  clipThumb: { position: "absolute", top: 0, left: 0, right: 0, bottom: 0 },
  clipPlay: { width: 48, height: 34, borderRadius: 9, backgroundColor: "#e21f1f", alignItems: "center", justifyContent: "center" },

  pollOpt: { position: "relative", borderWidth: 1, borderColor: colors.line, borderRadius: 10, paddingVertical: 10, paddingHorizontal: 12, overflow: "hidden", flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  pollFill: { position: "absolute", left: 0, top: 0, bottom: 0, backgroundColor: "rgba(245,245,247,0.07)" },
  pollLabel: { fontFamily: fonts.semibold, fontSize: 13, color: colors.cream },
  pollPct: { fontFamily: fonts.bold, fontSize: 12.5, color: colors.muted },

  pActions: { flexDirection: "row", alignItems: "center", gap: 20, marginTop: 12 },
  action: { flexDirection: "row", alignItems: "center", gap: 6 },
  actionText: { fontFamily: fonts.semibold, fontSize: 12.5, color: colors.muted },

  comments: { marginTop: 12, borderTopWidth: 1, borderTopColor: colors.lineSoft, paddingTop: 12, gap: 10 },
  noReplies: { fontFamily: fonts.body, fontSize: 12.5, color: colors.dim },
  comment: { flexDirection: "row", gap: 9, alignItems: "flex-start" },
  cmAv: { width: 26, height: 26, borderRadius: 13, backgroundColor: colors.surface2, alignItems: "center", justifyContent: "center", marginTop: 1 },
  cmAvText: { fontFamily: fonts.bold, fontSize: 10, color: colors.amber },
  cmBody: { flex: 1, fontFamily: fonts.body, fontSize: 13, lineHeight: 18, color: colors.cream },
  cmName: { fontFamily: fonts.bold },
  cmTime: { fontFamily: fonts.body, fontSize: 11, color: colors.dim },
  replyRow: { flexDirection: "row", gap: 8, alignItems: "center", marginTop: 2 },
  replyInput: { flex: 1, backgroundColor: colors.surface2, borderWidth: 1, borderColor: colors.line, borderRadius: 999, paddingVertical: 8, paddingHorizontal: 13, fontFamily: fonts.body, fontSize: 12.5, color: colors.cream },
  replySend: { backgroundColor: colors.surface2, borderWidth: 1, borderColor: colors.line, borderRadius: 999, paddingVertical: 8, paddingHorizontal: 14 },
  replySendText: { fontFamily: fonts.bold, fontSize: 12, color: colors.cream },
});
