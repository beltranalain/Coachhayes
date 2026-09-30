// Shared shell for every native Studio screen: gates access by ROLE (mirroring
// the web RBAC), renders a consistent back bar + title, and handles the
// not-signed-in / not-authorized / not-allowed states gracefully. Keeps each
// admin route lean and visually consistent with the app.
//
// Role resolution: env owners (isAdminEmail) are fast-allowed as "owner" so the
// Studio stays reachable offline / before the API answers; everyone else is
// resolved via GET /api/admin/whoami. A signed-in account that is not on the
// team resolves to role: null and sees the not-authorized state. The resolved
// role is exposed via a context (useAdminRole) so the admin home + screens can
// gate their nav/content, and each screen may pass `require` to independently
// refuse a role that is not allowed (defense in depth).

import React, { createContext, useContext, useEffect, useState } from "react";
import {
  View,
  Text,
  Pressable,
  StyleSheet,
  ScrollView,
  ActivityIndicator,
  type RefreshControlProps,
} from "react-native";
import { useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { colors, fonts, radii } from "../lib/theme";
import { useAuth } from "../lib/auth";
import { isAdminEmail } from "../lib/admin";
import { fetchWhoami, canAccess, type Role, type AdminScreen } from "../lib/adminApi";
import { Eyebrow, Display, Body, AmberButton } from "./ui";

// ---- Role context -----------------------------------------------------------
// `role` is the resolved role (or null once resolution finishes and the account
// is not on the team). `resolving` is true while whoami is in flight.
type AdminRoleValue = { role: Role | null; resolving: boolean };
const AdminRoleContext = createContext<AdminRoleValue>({ role: null, resolving: true });

export function useAdminRole(): AdminRoleValue {
  return useContext(AdminRoleContext);
}

function BackChevron() {
  return (
    <View style={{ width: 10, height: 10, transform: [{ rotate: "45deg" }] }}>
      <View style={styles.chevron} />
    </View>
  );
}

// Wrap an admin screen's content. Renders the gate first; only allowed roles
// see the children. Pass `require` to gate a specific screen to certain roles.
export function AdminScaffold({
  eyebrow,
  title,
  children,
  scroll = true,
  refreshControl,
  require: requireScreen,
}: {
  eyebrow: string;
  title: string;
  children: React.ReactNode;
  scroll?: boolean;
  refreshControl?: React.ReactElement<RefreshControlProps>;
  // Which screen this is, for the capability matrix. Omit for the admin home
  // (any resolved role may see it; the home lists only what the role can open).
  require?: AdminScreen;
}) {
  const router = useRouter();
  const { user, ready } = useAuth();

  // Resolve the caller's role. Env owners are fast-allowed as "owner"; everyone
  // else is resolved via whoami. Non-team accounts resolve to null.
  const [role, setRole] = useState<Role | null>(null);
  const [resolving, setResolving] = useState(true);

  useEffect(() => {
    let cancelled = false;
    if (!ready) return;
    if (!user) {
      setRole(null);
      setResolving(false);
      return;
    }
    if (isAdminEmail(user.email)) {
      // Fast-allow env owners without waiting on the network.
      setRole("owner");
      setResolving(false);
      return;
    }
    setResolving(true);
    (async () => {
      try {
        const who = await fetchWhoami();
        if (!cancelled) setRole(who.role ?? null);
      } catch {
        if (!cancelled) setRole(null);
      } finally {
        if (!cancelled) setResolving(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [ready, user]);

  const header = (
    <View style={styles.topbar}>
      <Pressable
        onPress={() => router.back()}
        hitSlop={10}
        accessibilityLabel="Back"
        style={({ pressed }) => [styles.backBtn, pressed && { opacity: 0.7 }]}
      >
        <BackChevron />
      </Pressable>
      <View style={{ flex: 1 }}>
        <Eyebrow>{eyebrow}</Eyebrow>
        <Display style={styles.title}>{title}</Display>
      </View>
    </View>
  );

  // Screen is allowed when there's a role and (no `require` gate, or the matrix
  // permits it). The admin home passes no `require`, so any resolved role sees
  // it and decides its own nav.
  const allowed = !!role && (!requireScreen || canAccess(role, requireScreen));

  let body: React.ReactNode;
  if (!ready || resolving) {
    body = <ActivityIndicator color={colors.amber} style={{ marginTop: 24 }} />;
  } else if (!user) {
    body = (
      <View style={styles.gate}>
        <Body>You need to sign in with an admin account to use the Studio.</Body>
        <View style={{ marginTop: 16 }}>
          <AmberButton label="Sign in" onPress={() => router.push("/signin")} />
        </View>
      </View>
    );
  } else if (!role) {
    body = (
      <View style={styles.gate}>
        <Body>
          This account is not authorized for the Studio. Sign in with an admin
          account to continue.
        </Body>
      </View>
    );
  } else if (!allowed) {
    // Signed in with a valid role, but this screen isn't in that role's matrix.
    body = (
      <View style={styles.gate}>
        <Body>Your role does not have access to this screen.</Body>
        <View style={{ marginTop: 16 }}>
          <AmberButton label="Back to Studio" onPress={() => router.replace("/admin" as never)} />
        </View>
      </View>
    );
  } else {
    body = children;
  }

  const value: AdminRoleValue = { role, resolving };

  const content = scroll ? (
    <ScrollView contentContainerStyle={styles.scroll} refreshControl={refreshControl}>
      {header}
      {body}
      <View style={{ height: 24 }} />
    </ScrollView>
  ) : (
    <View style={styles.plain}>
      {header}
      {body}
    </View>
  );

  return <AdminRoleContext.Provider value={value}>{content}</AdminRoleContext.Provider>;
}

// Small labelled card wrapper used across the admin screens.
export function AdminSectionTitle({ children }: { children: React.ReactNode }) {
  return <Text style={styles.sectionTitle}>{children}</Text>;
}

// A safe-area top spacer so admin routes (outside the tabs layout) clear the
// status bar / notch.
export function AdminTopInset() {
  const insets = useSafeAreaInsets();
  return <View style={{ height: insets.top }} />;
}

const styles = StyleSheet.create({
  scroll: { padding: 16, paddingBottom: 40 },
  plain: { flex: 1, padding: 16 },
  topbar: { flexDirection: "row", alignItems: "flex-start", gap: 12, marginBottom: 18, marginTop: 4 },
  backBtn: {
    width: 38,
    height: 38,
    borderRadius: radii.md,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: colors.lineSoft,
    backgroundColor: colors.surface,
  },
  chevron: {
    width: 10,
    height: 10,
    borderLeftWidth: 2,
    borderBottomWidth: 2,
    borderColor: colors.muted,
  },
  title: { fontSize: 34, lineHeight: 34, marginTop: 6 },
  gate: {
    backgroundColor: colors.surface,
    borderColor: colors.lineSoft,
    borderWidth: 1,
    borderRadius: radii.lg,
    padding: 18,
  },
  sectionTitle: {
    fontFamily: fonts.bold,
    fontSize: 13,
    color: colors.cream,
    marginBottom: 10,
    marginTop: 6,
  },
});
