// Native Studio - Team (OWNER ONLY). Lists the current team (email + role
// badge), lets an owner add a member (email + role), change a member's role,
// and remove a member. Env / protected owners are shown as protected and can't
// be edited or removed. Reads /api/admin/team (GET) and writes via POST with
// the owner's Bearer token. Gated by <AdminScaffold require="team">.

import React, { useEffect, useState } from "react";
import {
  View,
  Text,
  TextInput,
  Pressable,
  StyleSheet,
  RefreshControl,
  ActivityIndicator,
} from "react-native";
import { colors, fonts, radii } from "../../lib/theme";
import {
  fetchTeam,
  saveTeamMember,
  type TeamMember,
  type Role,
} from "../../lib/adminApi";
import { AdminScaffold } from "../../components/AdminScaffold";
import { AmberButton } from "../../components/ui";

const ROLES: { id: Role; label: string }[] = [
  { id: "owner", label: "Owner" },
  { id: "manager", label: "Manager" },
  { id: "host", label: "Host" },
  { id: "moderator", label: "Moderator" },
];

const ROLE_LABEL: Record<Role, string> = {
  owner: "Owner",
  manager: "Manager",
  host: "Host",
  moderator: "Moderator",
};

function RoleBadge({ role }: { role: Role }) {
  return (
    <View style={styles.badge}>
      <Text style={styles.badgeText}>{ROLE_LABEL[role]}</Text>
    </View>
  );
}

// A small inline role picker (pills) used both in the add-form and per-member.
function RolePicker({
  value,
  onChange,
  disabled,
}: {
  value: Role;
  onChange: (r: Role) => void;
  disabled?: boolean;
}) {
  return (
    <View style={styles.roleRow}>
      {ROLES.map((r) => {
        const active = value === r.id;
        return (
          <Pressable
            key={r.id}
            onPress={() => !disabled && onChange(r.id)}
            disabled={disabled}
            style={({ pressed }) => [
              styles.rolePill,
              active && styles.rolePillActive,
              pressed && !disabled && { opacity: 0.8 },
              disabled && { opacity: 0.5 },
            ]}
          >
            <Text style={[styles.rolePillText, active && { color: "#1a1205" }]}>{r.label}</Text>
          </Pressable>
        );
      })}
    </View>
  );
}

function TeamInner() {
  const [members, setMembers] = useState<TeamMember[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [demo, setDemo] = useState(false);

  // Add-form state.
  const [email, setEmail] = useState("");
  const [role, setRole] = useState<Role>("moderator");

  async function load() {
    try {
      const res = await fetchTeam();
      setMembers(res.members ?? []);
      setDemo(res.configured === false);
    } catch (e: any) {
      setMessage(e?.message === "not-authorized" ? "Not authorized." : "Could not load the team.");
    }
  }

  useEffect(() => {
    (async () => {
      await load();
      setLoading(false);
    })();
  }, []);

  async function apply(action: "add" | "remove" | "setRole", targetEmail: string, targetRole?: Role) {
    setBusy(true);
    setMessage("");
    try {
      const res = await saveTeamMember(action, targetEmail, targetRole);
      if (res.error) {
        setMessage(res.error);
      } else if (res.demo) {
        setMessage("Preview only - connect Firebase to save.");
        setDemo(true);
      } else {
        setMessage(
          action === "remove" ? "Member removed." : action === "add" ? "Member added." : "Role updated."
        );
      }
      // Prefer the server's returned list; otherwise re-fetch.
      if (res.members) setMembers(res.members);
      else await load();
    } catch (e: any) {
      setMessage(e?.message === "not-authorized" ? "Not authorized." : "Could not save.");
    } finally {
      setBusy(false);
    }
  }

  async function addMember() {
    const e = email.trim().toLowerCase();
    if (!e || !e.includes("@")) {
      setMessage("Enter a valid email.");
      return;
    }
    await apply("add", e, role);
    setEmail("");
    setRole("moderator");
  }

  return (
    <>
      {message ? <Text style={styles.msg}>{message}</Text> : null}
      {demo ? (
        <View style={styles.card}>
          <Text style={styles.muted}>
            Team is running in preview mode. Connect Firebase on the backend to persist changes.
          </Text>
        </View>
      ) : null}

      {/* Add a member */}
      <View style={styles.panel}>
        <Text style={styles.panelTitle}>Add a team member</Text>
        <Text style={styles.panelSub}>They sign in with this email to get the access below.</Text>

        <Text style={styles.label}>Email</Text>
        <TextInput
          value={email}
          onChangeText={setEmail}
          placeholder="name@example.com"
          placeholderTextColor={colors.dim}
          style={styles.field}
          autoCapitalize="none"
          autoCorrect={false}
          keyboardType="email-address"
        />

        <Text style={styles.label}>Role</Text>
        <RolePicker value={role} onChange={setRole} disabled={busy} />

        <View style={{ marginTop: 14 }}>
          <AmberButton label={busy ? "Saving…" : "Add member"} onPress={addMember} disabled={busy} />
        </View>
      </View>

      {/* Current team */}
      <Text style={styles.listHeading}>Current team</Text>
      {loading ? (
        <ActivityIndicator color={colors.amber} style={{ marginTop: 18 }} />
      ) : members.length === 0 ? (
        <View style={styles.card}>
          <Text style={styles.muted}>No team members yet. Add one above.</Text>
        </View>
      ) : (
        members.map((m) => (
          <View key={m.email} style={styles.member}>
            <View style={styles.memberTop}>
              <View style={{ flex: 1 }}>
                <Text style={styles.memberEmail} numberOfLines={1}>
                  {m.email}
                </Text>
                <View style={styles.memberMeta}>
                  <RoleBadge role={m.role} />
                  {m.protected ? <Text style={styles.protectedTag}>Protected owner</Text> : null}
                </View>
              </View>
              {!m.protected ? (
                <Pressable
                  onPress={() => apply("remove", m.email)}
                  disabled={busy}
                  hitSlop={8}
                  style={({ pressed }) => [styles.removeBtn, pressed && { opacity: 0.7 }]}
                >
                  <Text style={styles.removeText}>Remove</Text>
                </Pressable>
              ) : null}
            </View>

            {!m.protected ? (
              <RolePicker
                value={m.role}
                onChange={(r) => {
                  if (r !== m.role) apply("setRole", m.email, r);
                }}
                disabled={busy}
              />
            ) : (
              <Text style={styles.protectedNote}>
                Set in the backend environment - manage this owner there.
              </Text>
            )}
          </View>
        ))
      )}
    </>
  );
}

export default function AdminTeamScreen() {
  const [refreshing] = useState(false);
  return (
    <AdminScaffold
      eyebrow="Staff Access"
      title="Team"
      require="team"
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => {}} tintColor={colors.amber} />}
    >
      <TeamInner />
    </AdminScaffold>
  );
}

const styles = StyleSheet.create({
  msg: { fontFamily: fonts.semibold, fontSize: 12.5, color: colors.amber, marginBottom: 12 },
  card: {
    backgroundColor: colors.surface,
    borderColor: colors.lineSoft,
    borderWidth: 1,
    borderRadius: radii.lg,
    padding: 16,
    marginBottom: 12,
  },
  muted: { fontFamily: fonts.body, fontSize: 13, color: colors.muted, lineHeight: 20 },
  panel: {
    backgroundColor: colors.surface,
    borderColor: colors.lineSoft,
    borderWidth: 1,
    borderRadius: radii.lg,
    padding: 16,
  },
  panelTitle: { fontFamily: fonts.bold, fontSize: 15, color: colors.cream },
  panelSub: { fontFamily: fonts.body, fontSize: 12, color: colors.muted, marginTop: 4, marginBottom: 8 },
  label: {
    fontFamily: fonts.bold,
    fontSize: 10.5,
    letterSpacing: 1.5,
    color: colors.dim,
    textTransform: "uppercase",
    marginTop: 12,
    marginBottom: 6,
  },
  field: {
    backgroundColor: colors.surface2,
    borderWidth: 1,
    borderColor: colors.lineSoft,
    borderRadius: 12,
    paddingVertical: 12,
    paddingHorizontal: 14,
    fontFamily: fonts.body,
    fontSize: 14,
    color: colors.cream,
  },
  roleRow: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  rolePill: {
    borderRadius: radii.pill,
    borderWidth: 1,
    borderColor: colors.line,
    backgroundColor: colors.surface2,
    paddingVertical: 8,
    paddingHorizontal: 14,
  },
  rolePillActive: { backgroundColor: colors.amber, borderColor: colors.amber },
  rolePillText: { fontFamily: fonts.semibold, fontSize: 12, color: colors.cream },
  listHeading: { fontFamily: fonts.bold, fontSize: 13, color: colors.cream, marginTop: 24, marginBottom: 12 },
  member: {
    backgroundColor: colors.surface,
    borderColor: colors.lineSoft,
    borderWidth: 1,
    borderRadius: radii.lg,
    padding: 14,
    marginBottom: 11,
    gap: 12,
  },
  memberTop: { flexDirection: "row", alignItems: "flex-start", gap: 12 },
  memberEmail: { fontFamily: fonts.bold, fontSize: 14, color: colors.cream },
  memberMeta: { flexDirection: "row", alignItems: "center", gap: 8, marginTop: 6 },
  badge: {
    borderRadius: radii.pill,
    borderWidth: 1,
    borderColor: "rgba(245,165,36,0.5)",
    backgroundColor: "rgba(245,165,36,0.12)",
    paddingVertical: 3,
    paddingHorizontal: 10,
  },
  badgeText: {
    fontFamily: fonts.bold,
    fontSize: 10,
    letterSpacing: 1.2,
    color: colors.amber,
    textTransform: "uppercase",
  },
  protectedTag: { fontFamily: fonts.semibold, fontSize: 11, color: colors.dim },
  protectedNote: { fontFamily: fonts.body, fontSize: 11.5, color: colors.dim, lineHeight: 16 },
  removeBtn: {
    borderRadius: 10,
    borderWidth: 1,
    borderColor: colors.lineSoft,
    backgroundColor: colors.surface2,
    paddingVertical: 8,
    paddingHorizontal: 12,
    flexShrink: 0,
  },
  removeText: { fontFamily: fonts.semibold, fontSize: 12, color: colors.muted },
});
