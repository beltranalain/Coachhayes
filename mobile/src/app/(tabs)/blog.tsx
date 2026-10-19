// BLOG — published articles from the site, opening the full post in the browser.

import React, { useEffect, useState } from "react";
import { View, Text, StyleSheet, FlatList, Pressable, ActivityIndicator, Linking } from "react-native";
import { Image } from "expo-image";
import { LinearGradient } from "expo-linear-gradient";

import { colors, fonts } from "../../lib/theme";
import { API_BASE } from "../../lib/config";
import { fetchBlog, type BlogPost } from "../../lib/api";
import { Eyebrow } from "../../components/ui";

export default function BlogScreen() {
  const [posts, setPosts] = useState<BlogPost[]>([]);
  const [loading, setLoading] = useState(true);
  const site = API_BASE.replace(/\/$/, "");

  useEffect(() => {
    let alive = true;
    (async () => {
      try { const d = await fetchBlog(); if (alive) setPosts(d.posts || []); }
      catch {} finally { if (alive) setLoading(false); }
    })();
    return () => { alive = false; };
  }, []);

  const header = (
    <View style={{ paddingTop: 12, paddingBottom: 10 }}>
      <Eyebrow>The Blog</Eyebrow>
      <Text style={styles.h1}>From the sideline.</Text>
    </View>
  );

  if (loading) return <View style={styles.center}><ActivityIndicator color={colors.amber} /></View>;

  return (
    <FlatList
      data={posts}
      keyExtractor={(p) => p.id}
      ListHeaderComponent={header}
      contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: 28 }}
      renderItem={({ item }) => (
        <Pressable onPress={() => site && Linking.openURL(`${site}/blog/${item.slug}`)} style={({ pressed }) => [styles.row, pressed && { opacity: 0.85 }]}>
          {item.cover ? (
            <Image source={{ uri: item.cover }} style={styles.thumb} contentFit="cover" />
          ) : (
            <LinearGradient colors={["#1b1713", "#2a2016"]} style={styles.thumb} />
          )}
          <View style={{ flex: 1 }}>
            <Text style={styles.title} numberOfLines={2}>{item.title}</Text>
            <Text style={styles.meta}>{[item.category, item.readMins ? `${item.readMins} min read` : ""].filter(Boolean).join(" · ")}</Text>
          </View>
        </Pressable>
      )}
      ListEmptyComponent={<Text style={styles.empty}>No articles published yet.</Text>}
    />
  );
}

const styles = StyleSheet.create({
  center: { flex: 1, alignItems: "center", justifyContent: "center", backgroundColor: colors.bg },
  h1: { fontFamily: fonts.display, fontSize: 26, color: colors.cream, letterSpacing: -0.8, marginTop: 8 },
  row: { flexDirection: "row", gap: 12, alignItems: "center", paddingVertical: 13, borderTopWidth: 1, borderTopColor: colors.lineSoft },
  thumb: { width: 72, height: 54, borderRadius: 10, backgroundColor: colors.surface2 },
  title: { fontFamily: fonts.bold, fontSize: 14, lineHeight: 19, color: colors.cream },
  meta: { fontFamily: fonts.body, fontSize: 11.5, color: colors.muted, marginTop: 4 },
  empty: { fontFamily: fonts.body, color: colors.muted, fontSize: 13.5, textAlign: "center", paddingVertical: 40 },
});
