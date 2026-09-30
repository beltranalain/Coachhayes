// Admin email allowlist, mirrored from the website (web lib/admin.ts). Not
// secret - it just decides which signed-in accounts may reach the native Studio.
// Viewers who sign in to chat are NOT admins. Keyed by EMAIL (not UID).
//
// TEMPLATE: replace the placeholder below with your own admin email(s), or wire
// this to your backend. These are the accounts allowed into the native Studio.

export const ADMIN_EMAILS = ["you@example.com"];

export function isAdminEmail(email?: string | null): boolean {
  return !!email && ADMIN_EMAILS.includes(email.toLowerCase());
}
