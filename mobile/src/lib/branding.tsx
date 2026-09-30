// Shared branding: fetches { branding } from /api/site-config once and exposes
// the uploaded logo + names to the whole app (header wordmark, live screen, ...).
// Mirrors the website's SiteHeader, which renders branding.logo when present and
// falls back to the wordmark otherwise.

import React, { createContext, useContext, useEffect, useMemo, useState } from "react";
import { fetchSiteConfig, type SiteBranding } from "./api";

type BrandingState = {
  logo: string; // "" when unset
  siteName: string;
  tagline: string;
  loaded: boolean;
};

const DEFAULTS: BrandingState = {
  logo: "",
  siteName: "Your Studio",
  tagline: "Five shows. One camera.",
  loaded: false,
};

const BrandingContext = createContext<BrandingState>(DEFAULTS);

export function BrandingProvider({ children }: { children: React.ReactNode }) {
  const [state, setState] = useState<BrandingState>(DEFAULTS);

  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const cfg = await fetchSiteConfig();
        const b: SiteBranding = cfg.branding ?? {};
        if (!alive) return;
        setState({
          logo: typeof b.logo === "string" ? b.logo : "",
          siteName: b.siteName || DEFAULTS.siteName,
          tagline: b.tagline || DEFAULTS.tagline,
          loaded: true,
        });
      } catch {
        if (alive) setState((s) => ({ ...s, loaded: true }));
      }
    })();
    return () => {
      alive = false;
    };
  }, []);

  const value = useMemo(() => state, [state]);
  return <BrandingContext.Provider value={value}>{children}</BrandingContext.Provider>;
}

export function useBranding(): BrandingState {
  return useContext(BrandingContext);
}
