// Curated typefaces the client can pick in Branding. Anton + Inter are the
// defaults and are loaded via next/font; the rest load from Google Fonts on
// demand (a <link> built by googleFontsHref). Keeping this a fixed list means
// the design always holds together and fonts load reliably.

type FontDef = { css: string; google?: string };

export const HEADING_FONTS: Record<string, FontDef> = {
  Anton: { css: "'Anton', sans-serif" }, // via next/font
  Oswald: { css: "'Oswald', sans-serif", google: "Oswald:wght@500;600;700" },
  "Bebas Neue": { css: "'Bebas Neue', sans-serif", google: "Bebas+Neue" },
  "Archivo Black": { css: "'Archivo Black', sans-serif", google: "Archivo+Black" },
  Teko: { css: "'Teko', sans-serif", google: "Teko:wght@500;600;700" },
  "Playfair Display": { css: "'Playfair Display', serif", google: "Playfair+Display:wght@700;800;900" },
  Montserrat: { css: "'Montserrat', sans-serif", google: "Montserrat:wght@700;800;900" },
};

export const BODY_FONTS: Record<string, FontDef> = {
  Inter: { css: "'Inter', sans-serif" }, // via next/font
  Roboto: { css: "'Roboto', sans-serif", google: "Roboto:wght@400;500;700" },
  "Open Sans": { css: "'Open Sans', sans-serif", google: "Open+Sans:wght@400;600;700" },
  Lato: { css: "'Lato', sans-serif", google: "Lato:wght@400;700" },
  Poppins: { css: "'Poppins', sans-serif", google: "Poppins:wght@400;500;600;700" },
  Montserrat: { css: "'Montserrat', sans-serif", google: "Montserrat:wght@400;500;600;700" },
  Nunito: { css: "'Nunito', sans-serif", google: "Nunito:wght@400;600;700" },
};

export function headingStack(name: string): string {
  return HEADING_FONTS[name]?.css || HEADING_FONTS.Anton.css;
}
export function bodyStack(name: string): string {
  return BODY_FONTS[name]?.css || BODY_FONTS.Inter.css;
}

// Build the Google Fonts stylesheet URL for the chosen heading + body fonts.
// Skips Anton/Inter (already loaded via next/font) and de-dupes by family.
export function googleFontsHref(heading: string, body: string): string {
  const specs: string[] = [];
  const seen = new Set<string>();
  for (const f of [HEADING_FONTS[heading], BODY_FONTS[body]]) {
    if (f?.google) {
      const base = f.google.split(":")[0];
      if (!seen.has(base)) { seen.add(base); specs.push(f.google); }
    }
  }
  if (!specs.length) return "";
  return `https://fonts.googleapis.com/css2?${specs.map((s) => "family=" + s).join("&")}&display=swap`;
}
