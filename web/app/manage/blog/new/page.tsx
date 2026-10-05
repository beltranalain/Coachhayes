"use client";

import { useEffect, useState } from "react";
import Shell from "@/components/hayes/admin/Shell";
import BlogEditor from "@/components/hayes/admin/BlogEditor";

export default function NewBlogPost() {
  const [brand, setBrand] = useState({ name: "Coach Hayes Football", logo: "" });
  useEffect(() => {
    fetch("/api/site-config", { cache: "no-store" }).then((r) => r.json()).then((cfg) => {
      if (cfg?.branding) setBrand({ name: cfg.branding.siteName || "Coach Hayes Football", logo: cfg.branding.logo || "" });
    }).catch(() => {});
  }, []);
  return (
    <Shell title="New post" sub="Write with AI, then review and publish" brandName={brand.name} logo={brand.logo}>
      <BlogEditor />
    </Shell>
  );
}
