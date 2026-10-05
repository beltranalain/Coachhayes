"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import Shell from "@/components/hayes/admin/Shell";
import BlogEditor from "@/components/hayes/admin/BlogEditor";

export default function EditBlogPost() {
  const params = useParams();
  const id = String(params?.id || "");
  const [brand, setBrand] = useState({ name: "Coach Hayes Football", logo: "" });
  useEffect(() => {
    fetch("/api/site-config", { cache: "no-store" }).then((r) => r.json()).then((cfg) => {
      if (cfg?.branding) setBrand({ name: cfg.branding.siteName || "Coach Hayes Football", logo: cfg.branding.logo || "" });
    }).catch(() => {});
  }, []);
  return (
    <Shell title="Edit post" sub="Review, update, and publish" brandName={brand.name} logo={brand.logo}>
      <BlogEditor postId={id} />
    </Shell>
  );
}
