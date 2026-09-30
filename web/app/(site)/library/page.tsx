import type { Metadata } from "next";
import LibraryClient from "@/components/LibraryClient";
import { getSiteConfig } from "@/lib/siteConfig";

export const metadata: Metadata = { title: "Library" };

export default async function LibraryPage() {
  const { content, channels } = await getSiteConfig();
  return (
    <>
      <section className="page-hero">
        <div className="wrap">
          <span className="eyebrow">{content.libraryEyebrow}</span>
          <h1 className="anton">{content.libraryTitle1}<br /><span className="or">{content.libraryTitle2}</span></h1>
          <p>{content.libraryIntro}</p>
        </div>
      </section>

      <section className="sec" style={{ paddingTop: 56 }}>
        <LibraryClient channels={channels} />
      </section>
    </>
  );
}
