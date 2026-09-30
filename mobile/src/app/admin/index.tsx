// Native Studio home. Lists only the admin screens the CURRENT ROLE may open
// (mirroring the web RBAC), shows the signed-in email + role, and a sign-out.
// Gated to admins by <AdminScaffold/>, which resolves the role via whoami.
//
// Matrix (as applicable to the app's screens):
//   owner / manager -> Schedule, Tips, Costs, Settings (+ Team for owner)
//   host            -> Schedule only
//   moderator       -> none of these data screens (they moderate via Go Live /
//                      chat), so they see an informational note instead.

import React from "react";
import { View, Text, Pressable, StyleSheet } from "react-native";
import { useRouter } from "expo-router";
import { colors, fonts, radii } from "../../lib/theme";
import { useAuth } from "../../lib/auth";
import { AdminScaffold, useAdminRole } from "../../components/AdminScaffold";
import { canAccess, type AdminScreen, type Role } from "../../lib/adminApi";

type Item = { label: string; hint: string; route: string; screen: AdminScreen };

const ITEMS: Item[] = [
  { label: "Schedule", hint: "Add or remove broadcasts", route: "/admin/schedule", screen: "schedule" },
  { label: "Tips", hint: "Support received from viewers", route: "/admin/tips", screen: "tips" },
  { label: "Costs", hint: "Estimated monthly spend", route: "/admin/costs", screen: "costs" },
  { label: "Settings", hint: "Integration status", route: "/admin/settings", screen: "settings" },
  { label: "Team", hint: "Manage staff access", route: "/admin/team", screen: "team" },
];

const ROLE_LABEL: Record<Role, string> = {
  owner: "Owner",
  manager: "Manager",
  host: "Host",
  moderator: "Moderator",
};

function AdminHomeInner() {
  const router = useRouter();
  const { user, logout } = useAuth();
  const { role } = useAdminRole();

  // Only list screens this role may open (defense in depth is on each screen).
  const items = ITEMS.filter((it) => canAccess(role, it.screen));

  return (
    <>
      <View style={styles.whoCard}>
        <Text style={styles.whoLabel}>Signed in as</Text>
        <Text style={styles.whoEmail} numberOfLines={1}>
          {user?.email ?? "—"}
        </Text>
        {role ? (
          <View style={styles.roleBadge}>
            <Text style={styles.roleBadgeText}>{ROLE_LABEL[role]}</Text>
          </View>
        ) : null}
      </View>

      {items.length > 0 ? (
        <View style={{ gap: 10, marginTop: 16 }}>
          {items.map((it) => (
            <Pressable
              key={it.route}
              onPress={() => router.push(it.route as never)}
              style={({ pressed }) => [styles.row, pressed && { opacity: 0.75 }]}
            >
              <View style={{ flex: 1 }}>
                <Text style={styles.rowLabel}>{it.label}</Text>
                <Text style={styles.rowHint}>{it.hint}</Text>
              </View>
              <Text style={styles.arrow}>›</Text>
            </Pressable>
          ))}
        </View>
      ) : (
        <View style={[styles.whoCard, { marginTop: 16 }]}>
          <Text style={styles.noteText}>
            {role === "moderator"
              ? "You moderate live shows from Go Live and the chat. There are no data screens for your role here."
              : "Your role does not have access to any Studio screens."}
          </Text>
        </View>
      )}

      <Pressable
        onPress={async () => {
          await logout();
          router.replace("/");
        }}
        style={({ pressed }) => [styles.signOut, pressed && { opacity: 0.75 }]}
      >
        <Text style={styles.signOutText}>Sign out</Text>
      </Pressable>
    </>
  );
}

export default function AdminHome() {
  return (
    <AdminScaffold eyebrow="Creator Studio" title="Admin">
      <AdminHomeInner />
    </AdminScaffold>
  );
}

const styles = StyleSheet.create({
  whoCard: {
    backgroundColor: colors.surface,
    borderColor: colors.lineSoft,
    borderWidth: 1,
    borderRadius: radii.lg,
    padding: 16,
  },
  whoLabel: {
    fontFamily: fonts.bold,
    fontSize: 10.5,
    letterSpacing: 2,
    color: colors.dim,
    textTransform: "uppercase",
  },
  whoEmail: { fontFamily: fonts.semibold, fontSize: 15, color: colors.cream, marginTop: 6 },
  roleBadge: {
    alignSelf: "flex-start",
    marginTop: 10,
    borderRadius: radii.pill,
    borderWidth: 1,
    borderColor: "rgba(245,165,36,0.5)",
    backgroundColor: "rgba(245,165,36,0.12)",
    paddingVertical: 4,
    paddingHorizontal: 11,
  },
  roleBadgeText: {
    fontFamily: fonts.bold,
    fontSize: 10.5,
    letterSpacing: 1.5,
    color: colors.amber,
    textTransform: "uppercase",
  },
  noteText: { fontFamily: fonts.body, fontSize: 13, color: colors.muted, lineHeight: 20 },
  row: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: colors.surface,
    borderColor: colors.lineSoft,
    borderWidth: 1,
    borderRadius: radii.lg,
    paddingVertical: 15,
    paddingHorizontal: 16,
  },
  rowLabel: { fontFamily: fonts.bold, fontSize: 15, color: colors.cream },
  rowHint: { fontFamily: fonts.body, fontSize: 12, color: colors.muted, marginTop: 3 },
  arrow: { fontFamily: fonts.body, fontSize: 22, color: colors.dim, marginLeft: 10 },
  signOut: {
    marginTop: 22,
    borderRadius: 14,
    borderWidth: 1.5,
    borderColor: "rgba(232,64,42,0.5)",
    backgroundColor: "rgba(232,64,42,0.08)",
    paddingVertical: 14,
    alignItems: "center",
  },
  signOutText: { fontFamily: fonts.bold, fontSize: 14, color: colors.live },
});
