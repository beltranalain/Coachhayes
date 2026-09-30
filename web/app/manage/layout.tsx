import type { Metadata } from "next";
import "../admin-hayes.css";
import "../admin-compat.css"; // classes the ported ControlRoom studio uses (.panel/.two-col/.btn-live…)
import AuthGuard from "@/components/hayes/admin/AuthGuard";

export const metadata: Metadata = {
  title: "Control Room — Coach Hayes Football",
  robots: { index: false, follow: false },
};

// The Hayes "Control Room" admin. Uses the admin-hayes.css design system
// (scoped under .hzadmin) and is gated by AuthGuard. Loads the mock's fonts.
export default function ManageLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <link rel="preconnect" href="https://fonts.googleapis.com" />
      <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
      <link
        href="https://fonts.googleapis.com/css2?family=Inter+Tight:wght@400;500;600;700&family=Inter:wght@400;500;600&family=Plus+Jakarta+Sans:wght@400;500;600;700&display=swap"
        rel="stylesheet"
      />
      <AuthGuard>{children}</AuthGuard>
    </>
  );
}
