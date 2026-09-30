import Link from "next/link";
import type { FooterContent } from "@/lib/hayesContent";

// Footer columns + legal come from content.footer (admin-editable). The
// copyright line is composed from the brand name + current year (not hardcoded).
export default function SiteFooter({ brandName, content, year }: { brandName: string; content: FooterContent; year: number }) {
  return (
    <footer>
      <div className="wide">
        <div className="fg">
          {content.columns.map((col) => (
            <div key={col.key}>
              <h4>{col.heading}</h4>
              {col.links.map((l, i) => (
                <Link key={i} href={l.href}>{l.label}</Link>
              ))}
            </div>
          ))}
        </div>
        <div className="fbot">
          <span>Copyright © {year} {brandName}, LLC. {content.legal[0] ?? ""}</span>
          {content.legal.slice(1).map((line, i) => (
            <span key={i}>{line}</span>
          ))}
        </div>
      </div>
    </footer>
  );
}
