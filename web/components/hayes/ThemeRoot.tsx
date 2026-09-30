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

export default function ThemeRoot({ children }: { children: React.ReactNode }) {
  // Template default is light; remember the visitor's choice.
  const [theme, setThemeState] = useState<Theme>("light");
  useEffect(() => {
    try {
      const s = localStorage.getItem("hz-theme");
      if (s === "dark" || s === "light") setThemeState(s);
    } catch {}
  }, []);
  const setTheme = (t: Theme) => {
    setThemeState(t);
    try {
      localStorage.setItem("hz-theme", t);
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
