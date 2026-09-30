import type { Metadata } from "next";
import "../hayes-ds.css";

export const metadata: Metadata = {
  title: "Design System — Coach Hayes Football",
  description: "Phase 0 component gallery: the approved Hayes design system in both themes.",
};

// The Hayes design system loads the template's typefaces (Inter Tight / Inter
// for light, Plus Jakarta Sans for dark). All Hayes markup is wrapped in .hz so
// the tokens are isolated from the app's legacy globals.css.
export default function GalleryLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <link rel="preconnect" href="https://fonts.googleapis.com" />
      <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
      <link
        href="https://fonts.googleapis.com/css2?family=Inter+Tight:wght@400;500;600;700&family=Inter:wght@400;500;600&family=Plus+Jakarta+Sans:wght@400;500;600;700&display=swap"
        rel="stylesheet"
      />
      {children}
    </>
  );
}
