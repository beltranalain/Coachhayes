import type { Metadata } from "next";
import ContactForm from "@/components/ContactForm";
import { getSiteConfig, getHayesContent } from "@/lib/siteConfig";

export const metadata: Metadata = { title: "Contact" };

// Show the address without the scheme/www so it reads as a handle, e.g.
// "youtube.com/@CoachHayesFootball".
const cleanUrl = (u: string) => u.replace(/^https?:\/\/(www\.)?/, "");

export default async function ContactPage() {
  const [{ content }, hayes] = await Promise.all([getSiteConfig(), getHayesContent()]);
  // Real social channels come from the same admin-editable footer config
  // (Follow + Community columns), so the contact page and footer never drift.
  const socials = ["follow", "community"]
    .map((k) => hayes.footer.columns.find((c) => c.key === k))
    .filter((c): c is NonNullable<typeof c> => Boolean(c))
    .flatMap((c) => c.links)
    .filter((l) => /^https?:\/\//.test(l.href));
  return (
    <>
      <section className="page-hero">
        <div className="wrap">
          <span className="eyebrow">Get in touch</span>
          <h1 className="anton">Ask for<br /><span className="or">the mic.</span></h1>
          <p>Guest spots, collaborations, or just want to reach the show. Here is how to find us.</p>
        </div>
      </section>

      <section className="sec" style={{ paddingTop: 56 }}>
        <div className="wrap">
          <div className="contact-grid">
            <div>
              <ul className="contact-list">
                <li>
                  <div className="label">Email</div>
                  <div className="value"><a href={`mailto:${content.emailGeneral}`}>{content.emailGeneral}</a></div>
                </li>
                {socials.map((l) => (
                  <li key={l.href}>
                    <div className="label">{l.label}</div>
                    <div className="value">
                      <a href={l.href} target="_blank" rel="noopener noreferrer">{cleanUrl(l.href)}</a>
                    </div>
                  </li>
                ))}
              </ul>
            </div>
            <div>
              <ContactForm />
            </div>
          </div>
        </div>
      </section>
    </>
  );
}
