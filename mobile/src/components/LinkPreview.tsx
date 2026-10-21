// Link preview card for community posts: shows the site's thumbnail instead of a
// raw www address. Fetches Open Graph data via the shared /api/link-preview.

import React, { useEffect, useState } from "react";
import { View, Text, StyleSheet, Pressable } from "react-native";
import { Image } from "expo-image";
import { useRouter } from "expo-router";
import { fonts, type ThemeColors } from "../lib/theme";
import { useColors, useThemedStyles } from "../lib/ThemeContext";
import { fetchLinkPreview, type LinkPreviewData } from "../lib/api";

function hostOf(u: string): string {
  return u.replace(/^https?:\/\//i, "").replace(/^www\./i, "").split("/")[0];
}

export default function LinkPreview({ url }: { url: string }) {
  const colors = useColors();
  const styles = useThemedStyles(makeStyles);
  const router = useRouter();
  const [p, setP] = useState<LinkPreviewData | null>(null);
  const [dead, setDead] = useState(false);

  useEffect(() => {
    let alive = true;
    fetchLinkPreview(url).then((d) => { if (!alive) return; if (d) setP(d); else setDead(true); });
    return () => { alive = false; };
  }, [url]);

  if (dead) return null;
  const host = p?.site || hostOf(url);

  return (
    <Pressable onPress={() => router.push(`/web?url=${encodeURIComponent(url)}&title=${encodeURIComponent(host)}` as never)} style={styles.card}>
      {p?.image ? (
        <Image source={{ uri: p.image }} style={styles.img} contentFit="cover" />
      ) : (
        <View style={[styles.img, styles.imgNone]}><Text style={styles.imgNoneText}>{(host[0] || "·").toUpperCase()}</Text></View>
      )}
      <View style={styles.body}>
        <Text style={styles.site} numberOfLines={1}>{host}</Text>
        <Text style={styles.title} numberOfLines={2}>{p ? (p.title || host) : "Loading preview…"}</Text>
      </View>
    </Pressable>
  );
}

const makeStyles = (colors: ThemeColors) => StyleSheet.create({
  // Full-width banner on top (centered), text below — matches the website card.
  card: { borderWidth: 1, borderColor: colors.line, borderRadius: 12, overflow: "hidden", marginTop: 11, backgroundColor: colors.surface2 },
  img: { width: "100%", aspectRatio: 1.91, backgroundColor: colors.surface },
  imgNone: { alignItems: "center", justifyContent: "center", aspectRatio: 2.6 },
  imgNoneText: { fontFamily: fonts.display, fontSize: 30, color: colors.muted },
  body: { padding: 12, minWidth: 0 },
  site: { fontFamily: fonts.body, fontSize: 11, color: colors.muted },
  title: { fontFamily: fonts.semibold, fontSize: 13.5, color: colors.cream, marginTop: 2, lineHeight: 18 },
});
