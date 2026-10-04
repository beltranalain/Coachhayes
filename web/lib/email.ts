import "server-only";

// Resend (via REST, no SDK dependency). Gated on a key + a verified sender.
const KEY = process.env.RESEND_API_KEY;
const FROM = process.env.RESEND_FROM || ""; // e.g. "Coach Hayes <news@coachhayesfootball.com>"
export const emailConfigured = Boolean(KEY && FROM);

function esc(s: string): string {
  return String(s || "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

// Branded HTML email template — table-based + inline styles for email-client
// support (dark header with the logo, light readable body, dark footer).
export function renderEmail(opts: { brandName: string; logo?: string; subject: string; body: string; siteUrl?: string }): string {
  const brandName = opts.brandName || "Coach Hayes Football";
  const logo = (opts.logo || "").trim();
  const siteUrl = (opts.siteUrl || "").trim();

  const bodyHtml = esc(opts.body)
    .split(/\n{2,}/)
    .map((p) => `<p style="margin:0 0 16px;font-size:16px;line-height:1.6;color:#2a2622;">${p.replace(/\n/g, "<br/>")}</p>`)
    .join("");

  const header = logo
    ? `<img src="${logo}" alt="${esc(brandName)}" width="128" style="display:block;margin:0 auto;max-width:128px;height:auto;border-radius:50%;" />`
    : `<div style="font-size:22px;font-weight:700;color:#F5A524;text-align:center;font-family:Arial,Helvetica,sans-serif;">${esc(brandName)}</div>`;

  const footerBrand = siteUrl
    ? `<a href="${esc(siteUrl)}" style="color:#D8A44E;text-decoration:none;">${esc(brandName)}</a>`
    : esc(brandName);

  // Layered rounded cards: a dark outer card, logo, a light rounded content card
  // inside it, then the footer on the dark — soft corners throughout.
  return `<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#0E0C0B;-webkit-text-size-adjust:100%;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#0E0C0B;padding:30px 14px;">
    <tr><td align="center">
      <table role="presentation" width="600" cellpadding="0" cellspacing="0" style="max-width:600px;width:100%;">
        <tr><td style="background:#141110;border-radius:24px;padding:28px 24px;">
          <table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr><td align="center" style="padding-bottom:16px;">${header}</td></tr></table>
          <table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr><td align="center" style="padding-bottom:22px;"><div style="width:48px;height:4px;background:#F5A524;border-radius:999px;margin:0 auto;"></div></td></tr></table>
          <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#faf8f4;border-radius:18px;"><tr><td style="padding:30px 28px;">
            <h1 style="margin:0 0 16px;font-size:24px;line-height:1.28;color:#161210;font-family:Arial,Helvetica,sans-serif;">${esc(opts.subject)}</h1>
            <div style="font-family:Arial,Helvetica,sans-serif;">${bodyHtml || '<p style="margin:0;color:#8a857d;font-size:16px;">(Your message will appear here.)</p>'}</div>
          </td></tr></table>
          <table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr><td align="center" style="padding-top:22px;">
            <p style="margin:0 0 6px;font-size:13px;color:#BFC4C0;font-family:Arial,Helvetica,sans-serif;">Sent by ${footerBrand}</p>
            <p style="margin:0;font-size:12px;color:#7d7a74;font-family:Arial,Helvetica,sans-serif;">You're receiving this because you subscribed. Reply to this email to unsubscribe.</p>
          </td></tr></table>
        </td></tr>
      </table>
    </td></tr>
  </table>
</body></html>`;
}

// Send one email per recipient (Resend batch, up to 100/call) so addresses stay
// private. Returns how many were accepted.
export async function sendEmails(to: string[], subject: string, html: string): Promise<{ sent: number; error?: string }> {
  if (!KEY || !FROM) return { sent: 0, error: "Email provider not configured." };
  let sent = 0;
  for (let i = 0; i < to.length; i += 100) {
    const chunk = to.slice(i, i + 100);
    try {
      const res = await fetch("https://api.resend.com/emails/batch", {
        method: "POST",
        headers: { Authorization: `Bearer ${KEY}`, "Content-Type": "application/json" },
        body: JSON.stringify(chunk.map((addr) => ({ from: FROM, to: addr, subject, html }))),
      });
      if (res.ok) sent += chunk.length;
      else { const t = await res.text().catch(() => ""); return { sent, error: `Resend ${res.status}: ${t.slice(0, 180)}` }; }
    } catch (e: any) { return { sent, error: e?.message || "Send failed." }; }
  }
  return { sent };
}
