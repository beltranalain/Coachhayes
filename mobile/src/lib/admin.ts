// Admin email allowlist, mirrored from the website (web lib/admin.ts). Not
// secret - it just decides which signed-in accounts may reach the native Studio.
// Viewers who sign in to chat are NOT admins. Keyed by EMAIL (not UID).
//
// TEMPLATE: replace the placeholder below with your own admin email(s), or wire
// this to your backend. These are the accounts allowed into the native Studio.

// Coach Hayes admins (mirrors the website's NEXT_PUBLIC_ADMIN_EMAILS). This only
// decides who SEES the Control Room entry + the fast-path; the server (whoami +
// the gated admin APIs) is the real enforcement. Override via EXPO_PUBLIC_ADMIN_EMAILS.
const fromEnv = (process.env.EXPO_PUBLIC_ADMIN_EMAILS || "")
  .split(",").map((s) => s.trim().toLowerCase()).filter(Boolean);

export const ADMIN_EMAILS = fromEnv.length ? fromEnv : ["info@donkeyideas.com", "coachhayesfootball@gmail.com"];

export function isAdminEmail(email?: string | null): boolean {
  return !!email && ADMIN_EMAILS.includes(email.toLowerCase());
}
