// COMMUNITY — the public feed (room: general), matching the mock: a composer
// prompt and posts with text, images and playable clips.

import React, { useEffect, useState } from "react";
import { View, Text, StyleSheet, FlatList, Pressable, ActivityIndicator, Linking } from "react-native";
import { Image } from "expo-image";
import { useRouter } from "expo-router";

import { colors, fonts } from "../../lib/theme";
import { fetchFeed, timeAgo, youtubeId, type FeedPost } from "../../lib/api";
import { useAuth } from "../../lib/auth";
import { VideoModal, PlayTriangle } from "../../components/PlayerCard";
import PlayerBreakdownCard from "../../components/PlayerBreakdownCard";

export default function CommunityScreen() {
  const router = useRouter();
  const { user, displayName } = useAuth();
  const [posts, setPosts] = useState<FeedPost[]>([]);
  const [loading, setLoading] = useState(true);
  const [playing, setPlaying] = useState<{ id: string; name: string } | null>(null);

  useEffect(() => {
    let alive = true;
    (async () => {
      try { const d = await fetchFeed("general"); if (alive) setPosts(d.posts || []); }
      catch {} finally { if (alive) setLoading(false); }
    })();
    return () => { alive = false; };
  }, []);

  const composer = (
    <Pressable onPress={() => { if (!user) router.push("/signin"); }} style={styles.composer}>
      <View style={styles.cAv}><Text style={styles.cAvText}>{(user ? displayName : "?").slice(0, 1).toUpperCase()}</Text></View>
      <Text style={styles.cPrompt}>{user ? "Say something…" : "Sign in to post…"}</Text>
    </Pressable>
  );

  if (loading) {
    return <View style={styles.center}><ActivityIndicator color={colors.amber} /></View>;
  }

  return (
    <>
      <FlatList
        data={posts}
        keyExtractor={(p) => p.id}
        ListHeaderComponent={composer}
        contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: 28, paddingTop: 14 }}
        renderItem={({ item }) => <PostCard post={item} onPlay={(id, name) => setPlaying({ id, name })} />}
        ListEmptyComponent={<Text style={styles.empty}>No posts yet. Be the first to say something.</Text>}
      />
      <VideoModal playing={playing} onClose={() => setPlaying(null)} />
    </>
  );
}

function PostCard({ post, onPlay }: { post: FeedPost; onPlay: (id: string, name: string) => void }) {
  const clipId = youtubeId(post.clip || undefined);
  return (
    <View style={styles.post}>
      <View style={styles.pHead}>
        {post.picture ? (
          <Image source={{ uri: post.picture }} style={styles.pAv} contentFit="cover" />
        ) : (
          <View style={styles.pAvFallback}><Text style={styles.pAvText}>{(post.author || "?").slice(0, 1).toUpperCase()}</Text></View>
        )}
        <View style={{ flex: 1 }}>
          <Text style={styles.pAuthor}>{post.author}</Text>
          <Text style={styles.pTime}>{timeAgo(post.ts)}{post.show?.title ? ` · ${post.show.title}` : ""}</Text>
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

      <View style={styles.pActions}>
        <Text style={styles.pAction}>♥ {post.likes || 0}</Text>
        <Text style={styles.pAction}>Reply</Text>
        <Text style={[styles.pAction, { marginLeft: "auto" }]}>Save</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  center: { flex: 1, alignItems: "center", justifyContent: "center", backgroundColor: colors.bg },
  empty: { fontFamily: fonts.body, color: colors.muted, fontSize: 13.5, textAlign: "center", paddingVertical: 40 },

  composer: { flexDirection: "row", alignItems: "center", gap: 11, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.line, borderRadius: 16, padding: 14, marginBottom: 14 },
  cAv: { width: 34, height: 34, borderRadius: 17, backgroundColor: colors.amber, alignItems: "center", justifyContent: "center" },
  cAvText: { fontFamily: fonts.bold, fontSize: 13, color: "#171204" },
  cPrompt: { fontFamily: fonts.body, fontSize: 13.5, color: colors.muted },

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

  pActions: { flexDirection: "row", alignItems: "center", gap: 18, marginTop: 11 },
  pAction: { fontFamily: fonts.semibold, fontSize: 12.5, color: colors.muted },
});
