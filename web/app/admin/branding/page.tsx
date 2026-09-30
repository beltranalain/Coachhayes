"use client";

import { useEffect, useRef, useState } from "react";
import { DEFAULT_BRANDING, CUSTOM_FONT, CUSTOM_FONT_FAMILY, type SiteBranding } from "@/lib/siteData";
import { HEADING_FONTS, BODY_FONTS, headingStack, bodyStack } from "@/lib/fonts";
import { saveSection, loadConfig } from "@/lib/saveSection";
import PreviewSiteModal from "@/components/PreviewSiteModal";

// Draw the picked image onto a square canvas at `size` px (contain, transparent
// padding) and return a compact PNG data URL. Keeps the stored value small
// enough to live directly in the Firestore branding doc - no Firebase Storage.
function resizeImage(file: File, size: number, fill = false): Promise<string> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      try {
        const canvas = document.createElement("canvas");
        canvas.width = size;
        canvas.height = size;
        const ctx = canvas.getContext("2d");
        if (!ctx) throw new Error("Canvas unsupported.");
        ctx.clearRect(0, 0, size, size);
        if (fill) {
          // Cover the whole square (crop overflow) - for a logo shown as a badge.
          const scale = Math.max(size / img.width, size / img.height);
          const w = img.width * scale, h = img.height * scale;
          ctx.drawImage(img, (size - w) / 2, (size - h) / 2, w, h);
        } else {
          // Contain (letterboxed) - keeps the whole image, for favicons.
          const scale = Math.min(size / img.width, size / img.height);
          const w = img.width * scale, h = img.height * scale;
          ctx.drawImage(img, (size - w) / 2, (size - h) / 2, w, h);
        }
        // WebP is much smaller than PNG for photos and supports transparency.
        const webp = canvas.toDataURL("image/webp", 0.85);
        resolve(webp.startsWith("data:image/webp") ? webp : canvas.toDataURL("image/png"));
      } catch (e) {
        reject(e);
      } finally {
        URL.revokeObjectURL(url);
      }
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error("That file is not a readable image."));
    };
    img.src = url;
  });
}

export default function AdminBranding() {
  const [form, setForm] = useState<SiteBranding>(DEFAULT_BRANDING);
  const [status, setStatus] = useState<"idle" | "saving" | "saved" | "demo" | "error">("idle");
  const [message, setMessage] = useState("");
  const [preview, setPreview] = useState(false);
  const logoInput = useRef<HTMLInputElement>(null);
  const faviconInput = useRef<HTMLInputElement>(null);
  const fontInput = useRef<HTMLInputElement>(null);

  // Read an uploaded font file into a data URL we can store + register with
  // @font-face. WOFF2 is smallest; we cap size so the branding doc stays under
  // Firestore's 1MB limit alongside the logo/favicon.
  async function onPickFont(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    if (!/\.(woff2?|ttf|otf)$/i.test(file.name)) {
      setStatus("error"); setMessage("Please choose a font file: .woff2, .woff, .ttf, or .otf.");
      return;
    }
    if (file.size > 400_000) {
      setStatus("error"); setMessage("That font is too large (max ~400KB). Tip: convert it to WOFF2 to shrink it dramatically.");
      return;
    }
    const dataUrl = await new Promise<string>((resolve, reject) => {
      const r = new FileReader();
      r.onload = () => resolve(String(r.result || ""));
      r.onerror = () => reject(new Error("read failed"));
      r.readAsDataURL(file);
    }).catch(() => "");
    if (!dataUrl) { setStatus("error"); setMessage("Could not read that font file."); return; }
    const name = file.name.replace(/\.(woff2?|ttf|otf)$/i, "");
    setForm((f) => ({ ...f, customFont: dataUrl, customFontName: name }));
    setStatus("idle");
    setMessage("Font uploaded. Pick it under Heading font or Body font, then Save changes.");
  }

  // Family used to preview a chosen font value (handles the uploaded font).
  const previewFamily = (val: string, body: boolean) =>
    val === CUSTOM_FONT ? `'${CUSTOM_FONT_FAMILY}', sans-serif` : body ? bodyStack(val) : headingStack(val);

  useEffect(() => {
    loadConfig()
      .then((cfg) => cfg?.branding && setForm({ ...DEFAULT_BRANDING, ...cfg.branding }))
      .catch(() => {});
  }, []);

  function set<K extends keyof SiteBranding>(key: K, value: SiteBranding[K]) {
    setForm((f) => ({ ...f, [key]: value }));
  }

  async function onPick(e: React.ChangeEvent<HTMLInputElement>, key: "logo" | "favicon", size: number) {
    const file = e.target.files?.[0];
    e.target.value = ""; // allow re-picking the same file
    if (!file) return;
    if (!file.type.startsWith("image/")) {
      setStatus("error");
      setMessage("Please choose an image file (PNG, JPG, or SVG).");
      return;
    }
    try {
      const dataUrl = await resizeImage(file, size, key === "logo");
      set(key, dataUrl);
      setStatus("idle");
      setMessage(`${key === "logo" ? "Logo" : "Favicon"} ready. Click Save changes to publish it.`);
    } catch (err: any) {
      setStatus("error");
      setMessage(err.message || "Could not read that image.");
    }
  }

  async function save() {
    setStatus("saving");
    setMessage("");
    try {
      const res = await saveSection("branding", form);
      if (res.saved) {
        setStatus("saved");
        setMessage("Saved. Refresh the public site to see the new colors and name.");
      } else {
        setStatus("demo");
        setMessage("Preview only - connect Firebase to save changes.");
      }
    } catch (e: any) {
      setStatus("error");
      setMessage(e.message || "Could not save.");
    }
  }

  return (
    <>
      <div className="admin-topbar">
        <div>
          <h1>Branding</h1>
          <div className="sub">Logo, colors, and identity across the whole platform.</div>
        </div>
        <div className="admin-actions">
          <button className="btn btn-ghost btn-sm" type="button" onClick={() => setPreview(true)}>Preview site</button>
          <button className="btn btn-primary btn-sm" type="button" onClick={save} disabled={status === "saving"}>
            {status === "saving" ? "Saving..." : "Save changes"}
          </button>
        </div>
      </div>

      {preview && <PreviewSiteModal onClose={() => setPreview(false)} />}

      {message && (
        <div className={status === "error" ? "form-error" : "form-ok"} style={{ marginBottom: 18 }}>
          {message}
        </div>
      )}

      <div className="two-col">
        <div>
          <div className="panel">
            <h3>Logo</h3>
            <div className="panel-sub">Shown in the site header and admin. Images are resized and stored with your branding - no extra setup.</div>
            <input ref={logoInput} type="file" accept="image/*" hidden onChange={(e) => onPick(e, "logo", 512)} />
            <input ref={faviconInput} type="file" accept="image/*" hidden onChange={(e) => onPick(e, "favicon", 64)} />
            <div className="uploader">
              <div className="logo-prev" style={form.logo ? { background: "none", padding: 0 } : undefined}>
                {form.logo ? <img src={form.logo} alt="Logo preview" style={{ width: "100%", height: "100%", objectFit: "contain", borderRadius: 10 }} /> : "SC"}
              </div>
              <div className="up-info"><div className="up-t">Primary logo</div><div className="up-s">{form.logo ? "Custom logo set." : "Current: placeholder mark."} Recommended 512 x 512.</div></div>
              <div style={{ display: "flex", gap: 8 }}>
                <button className="btn btn-primary btn-sm" type="button" onClick={() => logoInput.current?.click()}>Upload logo</button>
                {form.logo && <button className="btn btn-ghost btn-sm" type="button" onClick={() => set("logo", "")}>Remove</button>}
              </div>
            </div>
            <div className="uploader">
              <div className="logo-prev fav" style={form.favicon ? { background: "none", padding: 0 } : undefined}>
                {form.favicon ? <img src={form.favicon} alt="Favicon preview" style={{ width: "100%", height: "100%", objectFit: "contain", borderRadius: 8 }} /> : "SC"}
              </div>
              <div className="up-info"><div className="up-t">Favicon</div><div className="up-s">The small icon in the browser tab. 64 x 64.</div></div>
              <div style={{ display: "flex", gap: 8 }}>
                <button className="btn btn-ghost btn-sm" type="button" onClick={() => faviconInput.current?.click()}>Upload</button>
                {form.favicon && <button className="btn btn-ghost btn-sm" type="button" onClick={() => set("favicon", "")}>Remove</button>}
              </div>
            </div>
          </div>

          <div className="panel">
            <h3>Identity</h3>
            <div className="panel-sub">Name and tagline used site-wide.</div>
            <div className="panel-split">
              <div className="form-field"><label>Site name</label><input type="text" value={form.siteName} onChange={(e) => set("siteName", e.target.value)} /></div>
              <div className="form-field"><label>Tagline</label><input type="text" value={form.tagline} onChange={(e) => set("tagline", e.target.value)} /></div>
            </div>
            <div className="panel-split">
              <div className="form-field"><label>Domain</label><input type="text" value={form.domain} onChange={(e) => set("domain", e.target.value)} /></div>
              <div className="form-field"><label>Host name</label><input type="text" value={form.hostName} placeholder="Host" onChange={(e) => set("hostName", e.target.value)} /><p className="form-note" style={{ marginTop: 4 }}>Shown on your camera tile, in chat, and to guests.</p></div>
            </div>
          </div>

          <div className="panel">
            <h3>Live page</h3>
            <div className="panel-sub">A permanent show-name label (channel bug) on the live player, separate from the on-air banner you control while broadcasting.</div>
            <label className="check-row">
              <input type="checkbox" checked={form.showChannelBug} onChange={(e) => set("showChannelBug", e.target.checked)} />
              <span>Show a permanent show-name label on the live page</span>
            </label>
            {form.showChannelBug && (
              <div className="form-field" style={{ marginTop: 12 }}>
                <label>Label text</label>
                <input type="text" value={form.channelBug} placeholder="Your Live Show" onChange={(e) => set("channelBug", e.target.value)} />
              </div>
            )}
          </div>
        </div>

        <div>
          <div className="panel">
            <h3>Colors</h3>
            <div className="panel-sub">The accent drives buttons, links, and highlights.</div>
            <div className="form-field">
              <label>Accent color</label>
              <div className="color-row">
                <input type="color" value={form.accent} onChange={(e) => set("accent", e.target.value)} />
                <input type="text" value={form.accent} onChange={(e) => set("accent", e.target.value)} />
              </div>
            </div>
            <div className="form-field">
              <label>Background</label>
              <div className="color-row">
                <input type="color" value={form.background} onChange={(e) => set("background", e.target.value)} />
                <input type="text" value={form.background} onChange={(e) => set("background", e.target.value)} />
              </div>
            </div>
            <div className="form-field">
              <label>Live indicator</label>
              <div className="color-row">
                <input type="color" value={form.live} onChange={(e) => set("live", e.target.value)} />
                <input type="text" value={form.live} onChange={(e) => set("live", e.target.value)} />
              </div>
            </div>
          </div>

          <div className="panel">
            <h3>Typography</h3>
            <div className="panel-sub">Fonts and text color across the whole site.</div>
            {/* Register the uploaded font so it previews correctly in this panel. */}
            {form.customFont && <style dangerouslySetInnerHTML={{ __html: `@font-face{font-family:'${CUSTOM_FONT_FAMILY}';src:url(${form.customFont});font-display:swap;}` }} />}
            <div className="form-field">
              <label>Heading font</label>
              <select value={form.headingFont} onChange={(e) => set("headingFont", e.target.value)} style={{ fontFamily: previewFamily(form.headingFont, false) }}>
                {Object.keys(HEADING_FONTS).map((f) => <option key={f} value={f} style={{ fontFamily: headingStack(f) }}>{f}{f === "Anton" ? " (default)" : ""}</option>)}
                {form.customFont && <option value={CUSTOM_FONT}>Uploaded font{form.customFontName ? ` (${form.customFontName})` : ""}</option>}
              </select>
              <p className="form-note" style={{ marginTop: 4 }}>The big display headlines.</p>
            </div>
            <div className="form-field">
              <label>Body font</label>
              <select value={form.bodyFont} onChange={(e) => set("bodyFont", e.target.value)} style={{ fontFamily: previewFamily(form.bodyFont, true) }}>
                {Object.keys(BODY_FONTS).map((f) => <option key={f} value={f} style={{ fontFamily: bodyStack(f) }}>{f}{f === "Inter" ? " (default)" : ""}</option>)}
                {form.customFont && <option value={CUSTOM_FONT}>Uploaded font{form.customFontName ? ` (${form.customFontName})` : ""}</option>}
              </select>
              <p className="form-note" style={{ marginTop: 4 }}>Paragraphs, menus, and buttons.</p>
            </div>
            <div className="form-field">
              <label>Upload your own font</label>
              <input ref={fontInput} type="file" accept=".woff2,.woff,.ttf,.otf,font/*" hidden onChange={onPickFont} />
              <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
                <button className="btn btn-ghost btn-sm" type="button" onClick={() => fontInput.current?.click()}>{form.customFont ? "Replace font" : "Upload font"}</button>
                {form.customFont && <button className="btn btn-ghost btn-sm" type="button" onClick={() => { setForm((f) => ({ ...f, customFont: "", customFontName: "", headingFont: f.headingFont === CUSTOM_FONT ? "Anton" : f.headingFont, bodyFont: f.bodyFont === CUSTOM_FONT ? "Inter" : f.bodyFont })); }}>Remove</button>}
                {form.customFont && <span className="form-note" style={{ margin: 0, fontFamily: `'${CUSTOM_FONT_FAMILY}', sans-serif`, fontSize: 16 }}>{form.customFontName || "Custom font"} - Aa Bb Cc</span>}
              </div>
              <p className="form-note" style={{ marginTop: 4 }}>.woff2 (best), .woff, .ttf, or .otf, up to ~400KB. After uploading, select <strong>Uploaded font</strong> above.</p>
            </div>
            <div className="form-field">
              <label>Text color</label>
              <div className="color-row">
                <input type="color" value={form.textColor || "#F3EFE7"} onChange={(e) => set("textColor", e.target.value)} />
                <input type="text" value={form.textColor} placeholder="Auto (based on background)" onChange={(e) => set("textColor", e.target.value)} />
                {form.textColor && <button className="btn btn-ghost btn-sm" type="button" onClick={() => set("textColor", "")}>Auto</button>}
              </div>
              <p className="form-note" style={{ marginTop: 4 }}>Leave blank for automatic contrast. Pick a light color on a dark background (or dark on light) so text stays readable.</p>
            </div>
          </div>

          <div className="panel">
            <h3>Preview</h3>
            <div className="panel-sub">How the brand reads together.</div>
            <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 16 }}>
              {form.logo ? (
                <span className="brand-mark" style={{ background: "none", padding: 0, overflow: "hidden" }}>
                  <img src={form.logo} alt="" style={{ width: "100%", height: "100%", objectFit: "contain" }} />
                </span>
              ) : (
                <span className="brand-mark" style={{ background: `linear-gradient(135deg, ${form.accent}, #8a6a10)` }}>SC</span>
              )}
              <span className="brand-name">{form.siteName}<span>{form.tagline}</span></span>
            </div>
            {/* Scope the brand vars here so the tinted backgrounds (e.g. the live
                pill fill) reflect edits live, before saving. */}
            <div style={{ display: "flex", gap: 10, flexWrap: "wrap", ["--accent" as any]: form.accent, ["--live" as any]: form.live }}>
              <button className="btn btn-primary btn-sm" type="button" style={{ background: form.accent }}>Primary button</button>
              <button className="btn btn-ghost btn-sm" type="button">Ghost button</button>
              <span className="live-pill is-live" style={{ borderColor: form.live, background: form.live, color: "#151107" }}><span className="dot" style={{ background: "#151107" }} /><span>Live now</span></span>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
