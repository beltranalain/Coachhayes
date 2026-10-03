"use client";

import { createContext, useContext, useEffect, useState } from "react";

// The Hayes design system is scoped under `.hz`. Dark theme is applied via
// data-theme="dark" on that wrapper (a bare attribute selector in hayes-ds.css),
// so it overrides the app's legacy tokens for the public-site subtree only.
type Theme = "light" | "dark";
const ThemeCtx = createContext<{ theme: Theme; setTheme: (t: Theme) => void }>({
  theme: "light",
  setTheme: () => {},
});
export const useTheme = () => useContext(ThemeCtx);

export default function ThemeRoot({ children, initial = "light" }: { children: React.ReactNode; initial?: Theme }) {
  // `initial` comes from the hz-theme cookie (read on the server) so the correct
  // theme renders on the FIRST paint — no light→dark flash on load.
  const [theme, setThemeState] = useState<Theme>(initial);
  useEffect(() => {
    try {
      const s = localStorage.getItem("hz-theme");
      if (s === "dark" || s === "light") {
        if (s !== theme) setThemeState(s);
        // Mirror to a cookie so the server renders the right theme next time.
        document.cookie = `hz-theme=${s};path=/;max-age=31536000;samesite=lax`;
      }
    } catch {}
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  const setTheme = (t: Theme) => {
    setThemeState(t);
    try {
      localStorage.setItem("hz-theme", t);
      document.cookie = `hz-theme=${t};path=/;max-age=31536000;samesite=lax`;
    } catch {}
  };
  return (
    <ThemeCtx.Provider value={{ theme, setTheme }}>
      <div className="hz" data-theme={theme} style={{ minHeight: "100vh" }}>
        {children}
      </div>
    </ThemeCtx.Provider>
  );
}
