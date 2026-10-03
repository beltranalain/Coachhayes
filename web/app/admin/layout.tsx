import "../admin-hayes.css";
import "../admin-compat.css";

// The admin dashboard moved to /manage (the Control Room). Only the sign-in page
// remains under /admin; it renders itself and runs its own auth flow, so this
// layout only needs to load the admin stylesheet.
export default function AdminLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
