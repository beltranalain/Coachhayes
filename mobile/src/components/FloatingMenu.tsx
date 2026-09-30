// Floating top-left menu (from the mockup's .menu-panel). A hamburger button in
// the header toggles this; it renders a dark glass panel with the four sections,
// highlights the active one in amber, navigates on tap and closes on outside tap.
//
// The open/close state lives in a small context so the header button (which is
// rendered inside the shared ScreenHeader) can drive the overlay that the layout
// renders on top of everything.

import React, { createContext, useContext, useMemo, useState } from "react";
import { View, Text, Pressable, StyleSheet, Modal } from "react-native";
import { usePathname, useRouter } from "expo-router";
import { colors, fonts, radii } from "../lib/theme";
import { LiveIcon, ShowsIcon, ScheduleIcon, ArchiveIcon } from "./TabIcon";
import { useAuth } from "../lib/auth";
import { isAdminEmail } from "../lib/admin";

type MenuContextValue = {
  open: boolean;
  setOpen: (v: boolean) => void;
  toggle: () => void;
};

const MenuContext = createContext<MenuContextValue>({
  open: false,
  setOpen: () => {},
  toggle: () => {},
});

export function MenuProvider({ children }: { children: React.ReactNode }) {
  const [open, setOpen] = useState(false);
  const value = useMemo<MenuContextValue>(
    () => ({ open, setOpen, toggle: () => setOpen((v) => !v) }),
    [open]
  );
  return <MenuContext.Provider value={value}>{children}</MenuContext.Provider>;
}

export function useMenu(): MenuContextValue {
  return useContext(MenuContext);
}

// The four sections. `match` is used against the current pathname to mark active.
const SECTIONS = [
  { key: "live", label: "Live", route: "/" as const, match: ["/", "/index"] },
  { key: "shows", label: "Shows", route: "/shows" as const, match: ["/shows"] },
  { key: "schedule", label: "Schedule", route: "/schedule" as const, match: ["/schedule"] },
  { key: "archive", label: "Archive", route: "/archive" as const, match: ["/archive"] },
];

// Simple camera mark for the "Join the show" entry (View-based, no SVG).
function JoinIcon({ color }: { color: string }) {
  return (
    <View style={{ width: 20, height: 20, alignItems: "center", justifyContent: "center" }}>
      <View style={{ width: 18, height: 13, borderRadius: 4, borderWidth: 2, borderColor: color }} />
      <View style={{ position: "absolute", width: 5, height: 5, borderRadius: 3, borderWidth: 1.6, borderColor: color }} />
    </View>
  );
}

// Broadcast mark for "Go Live (Studio)": a solid record dot with a ring around
// it (View-based, no SVG). Reads as "on air" and stays distinct from the Admin
// gear mark.
function StudioIcon({ color }: { color: string }) {
  return (
    <View style={{ width: 20, height: 20, alignItems: "center", justifyContent: "center" }}>
      <View style={{ width: 18, height: 18, borderRadius: 9, borderWidth: 1.6, borderColor: color }} />
      <View style={{ position: "absolute", width: 9, height: 9, borderRadius: 4.5, backgroundColor: color }} />
    </View>
  );
}

// Simple gear-ish mark for the Admin entry (View-based, no SVG/native module).
function AdminIcon({ color }: { color: string }) {
  return (
    <View style={{ width: 20, height: 20, alignItems: "center", justifyContent: "center" }}>
      <View style={{ width: 16, height: 16, borderRadius: 8, borderWidth: 2, borderColor: color }} />
      <View style={{ position: "absolute", width: 6, height: 6, borderRadius: 3, backgroundColor: color }} />
    </View>
  );
}

function SectionIcon({ name, color }: { name: string; color: string }) {
  switch (name) {
    case "live":
      return <LiveIcon color={color} size={20} />;
    case "shows":
      return <ShowsIcon color={color} size={20} />;
    case "schedule":
      return <ScheduleIcon color={color} size={20} />;
    case "admin":
      return <AdminIcon color={color} />;
    case "studio":
      return <StudioIcon color={color} />;
    case "join":
      return <JoinIcon color={color} />;
    default:
      return <ArchiveIcon color={color} size={20} />;
  }
}

// Full-screen overlay: a dim scrim + the glass menu panel anchored top-left.
// `topInset` positions the panel just under the header (like the mockup's 98px).
export function FloatingMenuOverlay({ topInset }: { topInset: number }) {
  const { open, setOpen } = useMenu();
  const router = useRouter();
  const pathname = usePathname();
  const { user } = useAuth();

  function isActive(match: string[]) {
    return match.some((m) => (m === "/" ? pathname === "/" || pathname === "/index" : pathname.startsWith(m)));
  }

  function go(route: string) {
    setOpen(false);
    router.push(route as never);
  }

  // "Join the show" (native guest / green-room flow) appears for any signed-in
  // user. The "Go Live (Studio)" and Admin entries only appear for signed-in
  // admin emails (as on web).
  const isAdmin = isAdminEmail(user?.email);
  const sections = [
    ...SECTIONS,
    ...(user ? [{ key: "join", label: "Join the show", route: "/join", match: ["/join"] }] : []),
    ...(isAdmin
      ? [{ key: "studio", label: "Go Live (Studio)", route: "/studio", match: ["/studio"] }]
      : []),
    ...(isAdmin ? [{ key: "admin", label: "Admin", route: "/admin", match: ["/admin"] }] : []),
  ];

  return (
    <Modal visible={open} transparent animationType="fade" onRequestClose={() => setOpen(false)}>
      <Pressable style={styles.scrim} onPress={() => setOpen(false)}>
        {/* Stop propagation so taps inside the panel don't close it. */}
        <Pressable style={[styles.panel, { top: topInset + 6 }]} onPress={() => {}}>
          {sections.map((s) => {
            const active = isActive(s.match);
            const color = active ? colors.amber : colors.muted;
            return (
              <Pressable
                key={s.key}
                onPress={() => go(s.route)}
                style={({ pressed }) => [
                  styles.item,
                  active && styles.itemActive,
                  pressed && !active && { backgroundColor: "rgba(243,239,231,0.06)" },
                ]}
              >
                <SectionIcon name={s.key} color={color} />
                <Text style={[styles.itemLabel, { color }]}>{s.label}</Text>
              </Pressable>
            );
          })}
        </Pressable>
      </Pressable>
    </Modal>
  );
}

const styles = StyleSheet.create({
  scrim: {
    flex: 1,
    backgroundColor: "rgba(6,5,5,0.28)",
  },
  panel: {
    position: "absolute",
    left: 14,
    minWidth: 194,
    gap: 2,
    padding: 8,
    backgroundColor: "rgba(20,17,16,0.98)",
    borderWidth: 1,
    borderColor: colors.line,
    borderRadius: radii.lg,
    shadowColor: "#000",
    shadowOpacity: 0.6,
    shadowRadius: 24,
    shadowOffset: { width: 0, height: 22 },
    elevation: 12,
  },
  item: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    width: "100%",
    paddingVertical: 11,
    paddingLeft: 12,
    paddingRight: 16,
    borderRadius: 11,
  },
  itemActive: { backgroundColor: "rgba(245,165,36,0.12)" },
  itemLabel: { fontFamily: fonts.semibold, fontSize: 14 },
});
