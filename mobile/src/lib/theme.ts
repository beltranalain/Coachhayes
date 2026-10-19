// Design tokens lifted from the web mockup (mockup/ios-app-mock.html) so the
// native app matches the site's dark, cinematic look.

// Aligned 1:1 with the website's dark theme tokens (hayes-ds.css [data-theme=dark]):
// pure-black surface, muted-tan accent. `amber` is kept as the token NAME used
// across components, but now holds the site's accent value so the app matches.
export const colors = {
  bg: "#000000",        // --app
  bgDeep: "#000000",    // --deep
  surface: "#131316",   // --card
  surface2: "#0D0D10",  // --alt
  cream: "#F5F5F7",     // --ink
  muted: "#86868B",     // --sub
  dim: "#5A5A60",       // --dim
  amber: "#C8A96B",     // --acc (site accent)
  highlight: "#D8BE86",
  live: "#FF453A",      // --live
  line: "rgba(245,245,247,0.13)",   // --hair
  lineSoft: "rgba(245,245,247,0.07)", // --hair2
};

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
