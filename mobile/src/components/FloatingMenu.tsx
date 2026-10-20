// Menu panel (matches the mock): a clean dropdown under the header with a "MENU"
// label, large text rows, a divider, the gold Control Room entry (admins), and
// the account / sign-in row at the bottom. Open state lives in a small context
// so the header's menu button can drive the overlay the layout renders on top.

import React, { createContext, useContext, useMemo, useState } from "react";
import { View, Text, Pressable, StyleSheet, Modal } from "react-native";
import { usePathname, useRouter } from "expo-router";
import { colors, fonts, type ThemeColors } from "../lib/theme";
import { useColors, useThemedStyles } from "../lib/ThemeContext";
import { useAuth } from "../lib/auth";
import { isAdminEmail } from "../lib/admin";

type MenuContextValue = { open: boolean; setOpen: (v: boolean) => void; toggle: () => void };
const MenuContext = createContext<MenuContextValue>({ open: false, setOpen: () => {}, toggle: () => {} });

export function MenuProvider({ children }: { children: React.ReactNode }) {
  const colors = useColors();
  const styles = useThemedStyles(makeStyles);
  const [open, setOpen] = useState(false);
  const value = useMemo<MenuContextValue>(() => ({ open, setOpen, toggle: () => setOpen((v) => !v) }), [open]);
  return <MenuContext.Provider value={value}>{children}</MenuContext.Provider>;
}
export function useMenu(): MenuContextValue {
  return useContext(MenuContext);
}

const SECTIONS = [
  { label: "The Locker Room", route: "/community", match: ["/community", "/", "/index"] },
  { label: "Rankings", route: "/rankings", match: ["/rankings", "/evaluation"] },
  { label: "Live", route: "/live", match: ["/live"] },
  { label: "Blog", route: "/blog", match: ["/blog"] },
  { label: "Membership", route: "/membership", match: ["/membership"] },
];

export function FloatingMenuOverlay({ topInset }: { topInset: number }) {
  const colors = useColors();
  const styles = useThemedStyles(makeStyles);
  const { open, setOpen } = useMenu();
  const router = useRouter();
  const pathname = usePathname();
  const { user, displayName, logout } = useAuth();
  const isAdmin = isAdminEmail(user?.email);

  function isActive(match: string[]) {
    return match.some((m) => (m === "/" ? pathname === "/" || pathname === "/index" : pathname.startsWith(m)));
  }
  function go(route: string) { setOpen(false); router.push(route as never); }
  async function signOut() { setOpen(false); await logout(); router.replace("/" as never); }

  return (
    <Modal visible={open} transparent animationType="fade" onRequestClose={() => setOpen(false)}>
      <Pressable style={styles.scrim} onPress={() => setOpen(false)}>
        <Pressable style={[styles.panel, { top: topInset + 6 }]} onPress={() => {}}>
          <Text style={styles.label}>Menu</Text>

          {SECTIONS.map((s) => {
            const active = isActive(s.match);
            return (
              <Pressable key={s.route} onPress={() => go(s.route)} style={({ pressed }) => [styles.row, pressed && styles.rowPressed]}>
                <Text style={[styles.item, active && styles.itemActive]}>{s.label}</Text>
              </Pressable>
            );
          })}

          {isAdmin && (
            <>
              <View style={styles.sep} />
              <Pressable onPress={() => go("/admin")} style={({ pressed }) => [styles.row, pressed && styles.rowPressed]}>
                <Text style={styles.control}>Control Room · Evaluations</Text>
              </Pressable>
            </>
          )}

          <View style={styles.sep} />
          {user ? (
            <View style={styles.acctWrap}>
              <View style={{ flex: 1 }}>
                <Text style={styles.acctName} numberOfLines={1}>{displayName}</Text>
                <Text style={styles.acctSub} numberOfLines={1}>{user.email}</Text>
              </View>
              <Pressable onPress={signOut} hitSlop={8}><Text style={styles.signOut}>Sign out</Text></Pressable>
            </View>
          ) : (
            <Pressable onPress={() => go("/signin")} style={({ pressed }) => [styles.row, pressed && styles.rowPressed]}>
              <Text style={styles.signIn}>Sign in</Text>
            </Pressable>
          )}
        </Pressable>
      </Pressable>
    </Modal>
  );
}

const makeStyles = (colors: ThemeColors) => StyleSheet.create({
  scrim: { flex: 1, backgroundColor: "rgba(0,0,0,0.5)" },
  panel: {
    position: "absolute", left: 12, right: 12,
    backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.line, borderRadius: 20,
    paddingVertical: 10, paddingHorizontal: 6,
    shadowColor: "#000", shadowOpacity: 0.55, shadowRadius: 30, shadowOffset: { width: 0, height: 24 }, elevation: 16,
  },
  label: { fontFamily: fonts.bold, fontSize: 10.5, letterSpacing: 2, color: colors.dim, textTransform: "uppercase", paddingHorizontal: 14, paddingTop: 4, paddingBottom: 6 },
  row: { paddingVertical: 12, paddingHorizontal: 14, borderRadius: 12 },
  rowPressed: { backgroundColor: colors.surface2 },
  item: { fontFamily: fonts.semibold, fontSize: 18, color: colors.cream, letterSpacing: -0.3 },
  itemActive: { color: colors.amber },
  sep: { height: 1, backgroundColor: colors.line, marginVertical: 6, marginHorizontal: 10 },
  control: { fontFamily: fonts.bold, fontSize: 15, color: colors.amber },
  acctWrap: { flexDirection: "row", alignItems: "center", paddingVertical: 10, paddingHorizontal: 14, gap: 12 },
  acctName: { fontFamily: fonts.bold, fontSize: 14, color: colors.cream },
  acctSub: { fontFamily: fonts.body, fontSize: 12, color: colors.muted, marginTop: 2 },
  signOut: { fontFamily: fonts.bold, fontSize: 13, color: colors.live },
  signIn: { fontFamily: fonts.bold, fontSize: 16, color: colors.amber },
});
