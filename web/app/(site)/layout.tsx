import "../hayes-ds.css";
import { cookies } from "next/headers";
import ThemeRoot from "@/components/hayes/ThemeRoot";
import SiteNav from "@/components/hayes/SiteNav";
import SiteFooter from "@/components/hayes/SiteFooter";
import { getSiteConfig, getHayesContent } from "@/lib/siteConfig";
import { getLiveInfo } from "@/lib/youtube";
import { PRIMARY_CHANNEL } from "@/lib/channels";

// The public site uses the approved Hayes design system (scoped under .hz via
// ThemeRoot). /admin, /join and /overlay keep the legacy skin until they're
// ported, so nothing breaks mid-migration.
export default async function SiteLayout({ children }: { children: React.ReactNode }) {
  const [{ branding }, content] = await Promise.all([getSiteConfig(), getHayesContent()]);
  const live = await getLiveInfo(branding.youtubeChannelId || PRIMARY_CHANNEL.channelId);
  const year = new Date().getFullYear();
  // Read the saved theme on the server so the first paint matches it (no flash).
  const initialTheme = (await cookies()).get("hz-theme")?.value === "dark" ? "dark" : "light";
  return (
    <>
      {/* The approved design's typefaces: Inter Tight / Inter (light theme) and
          Plus Jakarta Sans (dark theme). Must be loaded or --fdisp/--fbody fall
          back to the browser serif. */}
      <link rel="preconnect" href="https://fonts.googleapis.com" />
      <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
      <link
        href="https://fonts.googleapis.com/css2?family=Inter+Tight:wght@400;500;600;700&family=Inter:wght@400;500;600&family=Plus+Jakarta+Sans:wght@400;500;600;700&display=swap"
        rel="stylesheet"
      />
      <ThemeRoot initial={initialTheme}>
        <SiteNav brandName={branding.siteName} live={live.live} logo={branding.logo} />
        {children}
        <SiteFooter brandName={branding.siteName} content={content.footer} year={year} />
      </ThemeRoot>
    </>
  );
}
