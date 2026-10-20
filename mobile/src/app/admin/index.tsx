// Control Room — the admin hub. Lists only what the signed-in role may open
// (mirrors the web RBAC); Go Live + Post to Locker Room + Evaluations up top.
// Gated to admins by <AdminScaffold/> (resolves the role via whoami).

import React from "react";
import { View, Text, Pressable, StyleSheet } from "react-native";
import { useRouter } from "expo-router";
import { Feather } from "@expo/vector-icons";
import { fonts, radii, type ThemeColors } from "../../lib/theme";
import { useColors, useThemedStyles } from "../../lib/ThemeContext";
import { useAuth } from "../../lib/auth";
import { AdminScaffold, useAdminRole } from "../../components/AdminScaffold";
import { canAccess, type AdminScreen, type Role } from "../../lib/adminApi";

type Item = { label: string; hint: string; route: string; screen: AdminScreen; icon: keyof typeof Feather.glyphMap; live?: boolean };

const ITEMS: Item[] = [
  { label: "Go Live", hint: "Broadcast from your phone", route: "/studio", screen: "studio", icon: "video", live: true },
  { label: "Evaluations", hint: "Record, AI writes it, publish", route: "/admin/evaluations", screen: "evaluations", icon: "file-text" },
  { label: "Post to Locker Room", hint: "Share with the community", route: "/community", screen: "locker", icon: "users" },
  { label: "Schedule", hint: "Add or remove broadcasts", route: "/admin/schedule", screen: "schedule", icon: "calendar" },
  { label: "Tips", hint: "Support received from viewers", route: "/admin/tips", screen: "tips", icon: "dollar-sign" },
  { label: "Costs", hint: "Estimated monthly spend", route: "/admin/costs", screen: "costs", icon: "pie-chart" },
  { label: "Settings", hint: "Integration status", route: "/admin/settings", screen: "settings", icon: "sliders" },
  { label: "Team", hint: "Manage staff access", route: "/admin/team", screen: "team", icon: "shield" },
];

const ROLE_LABEL: Record<Role, string> = { owner: "Owner", manager: "Manager", host: "Host", moderator: "Moderator" };

function AdminHomeInner() {
  const colors = useColors();
  const styles = useThemedStyles(makeStyles);
  const router = useRouter();
  const { user, logout } = useAuth();
  const { role } = useAdminRole();

  const items = ITEMS.filter((it) => canAccess(role, it.screen));

  return (
    <>
      <View style={styles.whoCard}>
        <Text style={styles.whoLabel}>Signed in as</Text>
        <Text style={styles.whoEmail} numberOfLines={1}>{user?.email ?? "—"}</Text>
        {role ? <View style={styles.roleBadge}><Text style={styles.roleBadgeText}>{ROLE_LABEL[role]}</Text></View> : null}
      </View>

      <View style={{ gap: 11, marginTop: 16 }}>
        {items.map((it) => (
          <Pressable key={it.route} onPress={() => router.push(it.route as never)} style={({ pressed }) => [styles.row, pressed && { opacity: 0.8 }]}>
            <View style={[styles.ic, it.live && styles.icLive]}>
              <Feather name={it.icon} size={19} color={it.live ? colors.live : colors.amber} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.rowLabel}>{it.label}</Text>
              <Text style={styles.rowHint}>{it.hint}</Text>
            </View>
            <Feather name="chevron-right" size={20} color={colors.dim} />
          </Pressable>
        ))}
        {items.length === 0 && (
          <View style={styles.whoCard}>
            <Text style={styles.rowHint}>Your role doesn&apos;t have access to any Control Room screens.</Text>
          </View>
        )}
      </View>

      <Pressable onPress={async () => { await logout(); router.replace("/" as never); }} style={({ pressed }) => [styles.signOut, pressed && { opacity: 0.8 }]}>
        <Text style={styles.signOutText}>Sign out</Text>
      </Pressable>
    </>
  );
}

export default function AdminHome() {
  return (
    <AdminScaffold eyebrow="Coach Hayes · Control Room" title="Control Room">
      <AdminHomeInner />
    </AdminScaffold>
  );
}

const makeStyles = (colors: ThemeColors) => StyleSheet.create({
  whoCard: { backgroundColor: colors.surface, borderColor: colors.line, borderWidth: 1, borderRadius: radii.lg, padding: 16 },
  whoLabel: { fontFamily: fonts.bold, fontSize: 10.5, letterSpacing: 1.6, color: colors.dim, textTransform: "uppercase" },
  whoEmail: { fontFamily: fonts.semibold, fontSize: 15, color: colors.cream, marginTop: 6 },
  roleBadge: { alignSelf: "flex-start", marginTop: 10, borderRadius: radii.pill, borderWidth: 1, borderColor: colors.line, backgroundColor: colors.surface2, paddingVertical: 4, paddingHorizontal: 11 },
  roleBadgeText: { fontFamily: fonts.bold, fontSize: 10.5, letterSpacing: 1, color: colors.amber, textTransform: "uppercase" },

  row: { flexDirection: "row", alignItems: "center", gap: 13, backgroundColor: colors.surface, borderColor: colors.line, borderWidth: 1, borderRadius: 16, padding: 14 },
  ic: { width: 40, height: 40, borderRadius: 11, backgroundColor: colors.surface2, alignItems: "center", justifyContent: "center" },
  icLive: { backgroundColor: colors.surface2 },
  rowLabel: { fontFamily: fonts.bold, fontSize: 14.5, color: colors.cream, letterSpacing: -0.2 },
  rowHint: { fontFamily: fonts.body, fontSize: 12, color: colors.muted, marginTop: 3 },

  signOut: { marginTop: 22, borderRadius: 14, borderWidth: 1.5, borderColor: "rgba(232,64,42,0.5)", backgroundColor: "rgba(232,64,42,0.08)", paddingVertical: 14, alignItems: "center" },
  signOutText: { fontFamily: fonts.bold, fontSize: 14, color: colors.live },
});
