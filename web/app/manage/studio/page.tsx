"use client";

import { useEffect, useState } from "react";
import Shell from "@/components/hayes/admin/Shell";
import ControlRoom from "@/components/ControlRoom";

// The full live studio (ControlRoom) rendered inside the Control Room shell.
// ControlRoom is the complete engine: camera/mic device pickers, guests, chat,
// scene/rundown/intro/sounds/media/sources, on-air graphics, and YouTube/Twitch/
// Facebook simulcast. Its own internal top bar is hidden (the shell provides one).
export default function StudioAdmin() {
  const [brand, setBrand] = useState({ name: "Coach Hayes Football", logo: "" });
  useEffect(() => {
    fetch("/api/site-config", { cache: "no-store" }).then((r) => r.json()).then((d) => { if (d?.branding) setBrand({ name: d.branding.siteName || "Coach Hayes Football", logo: d.branding.logo || "" }); }).catch(() => {});
  }, []);
  return (
    <Shell title="Studio" sub="Your whole show — camera, guests, graphics, all in the browser" brandName={brand.name} logo={brand.logo}>
      <div className="studio-embed"><ControlRoom /></div>
    </Shell>
  );
}
