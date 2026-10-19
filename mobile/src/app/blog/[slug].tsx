// In-app blog article reader — renders the post's HTML inside the app (a themed
// WebView), so the Blog stays inside the app instead of opening the browser.

import React, { useEffect, useMemo, useState } from "react";
import { View, Text, StyleSheet, ActivityIndicator, Pressable } from "react-native";
import { WebView } from "react-native-webview";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { colors, fonts } from "../../lib/theme";
import { fetchBlogPost, timeAgo, type BlogArticle } from "../../lib/api";

// Wrap the stored post HTML in a dark, readable document styled like the app.
function docHtml(a: BlogArticle): string {
  return `<!doctype html><html><head><meta charset="utf-8"/>
  <meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=1"/>
  <style>
    :root{color-scheme:dark}
    html,body{margin:0;background:#000;color:#F5F5F7;
      font-family:-apple-system,"Segoe UI",Roboto,system-ui,sans-serif;
      font-size:16px;line-height:1.7;-webkit-text-size-adjust:100%}
    body{padding:4px 2px 40px}
    h1,h2,h3{color:#fff;line-height:1.25;letter-spacing:-0.3px;margin:24px 0 10px}
    h1{font-size:24px} h2{font-size:20px} h3{font-size:17px}
    p{margin:0 0 16px;color:#d8d2c9}
    a{color:#C8A96B;text-decoration:none}
    img,video,iframe{max-width:100%!important;height:auto;border-radius:12px;margin:10px 0}
    ul,ol{padding-left:20px;color:#d8d2c9} li{margin-bottom:8px}
    blockquote{border-left:3px solid #C8A96B;margin:16px 0;padding:4px 0 4px 16px;color:#b7b1a8}
    hr{border:none;border-top:1px solid rgba(245,245,247,.13);margin:22px 0}
    code,pre{background:#131316;border-radius:8px;padding:2px 6px;font-size:14px}
  </style></head><body>${a.content || ""}</body></html>`;
}

export default function BlogArticleScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { slug, title: paramTitle } = useLocalSearchParams<{ slug: string; title?: string }>();
  const [article, setArticle] = useState<BlogArticle | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let alive = true;
    (async () => {
      try { const d = await fetchBlogPost(String(slug)); if (alive) setArticle(d.post ?? null); }
      catch {} finally { if (alive) setLoading(false); }
    })();
    return () => { alive = false; };
  }, [slug]);

  const html = useMemo(() => (article ? docHtml(article) : ""), [article]);

  return (
    <View style={{ flex: 1, backgroundColor: colors.bg, paddingTop: insets.top }}>
      <View style={styles.topbar}>
        <Pressable onPress={() => router.back()} hitSlop={10} style={styles.back}>
          <Text style={styles.chevron}>‹</Text><Text style={styles.backText}>Blog</Text>
        </Pressable>
      </View>

      {loading ? (
        <View style={styles.center}><ActivityIndicator color={colors.amber} /></View>
      ) : !article ? (
        <View style={styles.center}><Text style={styles.none}>Couldn&apos;t load this article.</Text></View>
      ) : (
        <>
          <View style={styles.header}>
            <Text style={styles.kick}>{[article.category, article.readMins ? `${article.readMins} min read` : "", article.publishedAt ? timeAgo(article.publishedAt) : ""].filter(Boolean).join(" · ")}</Text>
            <Text style={styles.title}>{article.title || paramTitle}</Text>
            {!!article.author && <Text style={styles.author}>By {article.author}</Text>}
          </View>
          <WebView
            originWhitelist={["*"]}
            source={{ html }}
            style={{ flex: 1, backgroundColor: colors.bg }}
            showsVerticalScrollIndicator={false}
          />
        </>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  topbar: { height: 48, flexDirection: "row", alignItems: "center", paddingHorizontal: 14, borderBottomWidth: 1, borderBottomColor: colors.lineSoft },
  back: { flexDirection: "row", alignItems: "center", gap: 6 },
  chevron: { fontFamily: fonts.medium, fontSize: 24, color: colors.cream, marginTop: -3 },
  backText: { fontFamily: fonts.semibold, fontSize: 15, color: colors.cream },
  center: { flex: 1, alignItems: "center", justifyContent: "center" },
  none: { fontFamily: fonts.body, fontSize: 13.5, color: colors.muted },
  header: { paddingHorizontal: 16, paddingTop: 16, paddingBottom: 10 },
  kick: { fontFamily: fonts.bold, fontSize: 10.5, letterSpacing: 1.6, textTransform: "uppercase", color: colors.amber },
  title: { fontFamily: fonts.display, fontSize: 26, color: colors.cream, letterSpacing: -0.6, marginTop: 8 },
  author: { fontFamily: fonts.body, fontSize: 12.5, color: colors.muted, marginTop: 8 },
});
