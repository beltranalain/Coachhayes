// Design tokens lifted from the web mockup (mockup/ios-app-mock.html) so the
// native app matches the site's dark, cinematic look.

export const colors = {
  bg: "#0A0908",
  bgDeep: "#050403",
  surface: "#141110",
  surface2: "#1C1714",
  cream: "#F3EFE7",
  muted: "#9A9287",
  dim: "#6B6055",
  amber: "#F5A524",
  highlight: "#FFBE4A",
  live: "#E8402A",
  line: "rgba(243,239,231,0.14)",
  lineSoft: "rgba(243,239,231,0.08)",
};

export const radii = {
  sm: 8,
  md: 12,
  lg: 16,
  pill: 999,
};

export const spacing = {
  xs: 6,
  sm: 10,
  md: 16,
  lg: 24,
  xl: 32,
};

export const fonts = {
  // expo-google-fonts export names.
  display: "Anton_400Regular",
  body: "Inter_400Regular",
  medium: "Inter_500Medium",
  semibold: "Inter_600SemiBold",
  bold: "Inter_700Bold",
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
