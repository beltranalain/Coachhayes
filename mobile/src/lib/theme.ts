// Design tokens lifted from the web mockup (mockup/ios-app-mock.html) so the
// native app matches the site's dark, cinematic look.

// Light + dark palettes, aligned with the website's tokens (hayes-ds.css). Dark =
// pure-black + tan accent; Light = white + blue accent (same as the site). The
// token NAMES are shared so components read the same keys in both themes. Fonts
// stay Plus Jakarta Sans in both modes. Consume via useColors()/useThemedStyles()
// from ThemeContext; `colors` below is a static dark fallback for back-compat.
export type ThemeColors = {
  bg: string; bgDeep: string; surface: string; surface2: string; cream: string;
  muted: string; dim: string; amber: string; highlight: string; live: string;
  line: string; lineSoft: string; onAccent: string;
};

export const darkColors: ThemeColors = {
  bg: "#000000", bgDeep: "#000000", surface: "#131316", surface2: "#0D0D10",
  cream: "#F5F5F7", muted: "#86868B", dim: "#5A5A60", amber: "#C8A96B", highlight: "#D8BE86",
  live: "#FF453A", line: "rgba(245,245,247,0.13)", lineSoft: "rgba(245,245,247,0.07)", onAccent: "#171204",
};

// Light stays on-brand gold (deeper so it reads on white) rather than the site's
// blue — the app should feel like the brand in both modes.
export const lightColors: ThemeColors = {
  bg: "#FFFFFF", bgDeep: "#F2F2F5", surface: "#FFFFFF", surface2: "#F1F1F4",
  cream: "#1D1D1F", muted: "#6E6E73", dim: "#A1A1A6", amber: "#9A7B33", highlight: "#B7963F",
  live: "#E8342A", line: "rgba(0,0,0,0.10)", lineSoft: "rgba(0,0,0,0.055)", onAccent: "#FFFFFF",
};

// Back-compat default (dark). Prefer useColors() so the value is theme-aware.
export const colors: ThemeColors = darkColors;

export const radii = {
  sm: 8,
  md: 12,
  lg: 16,
  pill: 999,
};

// Chip tier colors — identical to the website's CHIP_META rings.
export const chipColors: Record<string, string> = {
  blue: "#2D6BFF",
  gold: "#F5C542",
  silver: "#A9B2BD",
  bronze: "#C98A5E",
};

export const spacing = {
  xs: 6,
  sm: 10,
  md: 16,
  lg: 24,
  xl: 32,
};

export const fonts = {
  // Plus Jakarta Sans everywhere — matches the website's dark theme + the mock.
  display: "PlusJakartaSans_800ExtraBold",
  body: "PlusJakartaSans_400Regular",
  medium: "PlusJakartaSans_500Medium",
  semibold: "PlusJakartaSans_600SemiBold",
  bold: "PlusJakartaSans_700Bold",
};

// The five "art well" palettes from the mockup. Each is a two-stop radial-style
// gradient we emulate with layered expo-linear-gradient in <ArtWell/>.
export type WellName = "amber" | "blue" | "green" | "purple" | "clay";

export const wells: Record<WellName, { a: string; b: string; base: string }> = {
  amber: { a: "#F5A524", b: "#8a3b12", base: "#0b0a09" },
  blue: { a: "#4d86c4", b: "#1b2a44", base: "#0b0a09" },
  green: { a: "#3f8f6b", b: "#173b2c", base: "#0b0a09" },
  purple: { a: "#7b5bb0", b: "#2c1f45", base: "#0b0a09" },
  clay: { a: "#c65a3a", b: "#4a1f14", base: "#0b0a09" },
};

// Map a series/category to a well color so cards feel consistent with the site.
export function wellForKey(key: string): WellName {
  const map: Record<string, WellName> = {
    "flagship-show": "amber",
    patio: "blue",
    "one-thing": "clay",
    riding: "green",
    rise: "purple",
  };
  return map[key] ?? "amber";
}
