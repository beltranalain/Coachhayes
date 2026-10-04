"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import Shell from "@/components/hayes/admin/Shell";
import { getIdToken } from "@/lib/firebase";

// Merch — an admin-created catalog (stored in Firestore `shopProducts`), sold
// on-site via Stripe. Real products + orders only; nothing fake.
type Product = { id: string; title: string; priceCents: number; image: string; blurb: string; sizes: string[]; visible: boolean; order: number };
type Order = { id: string; title: string; size: string; qty: number; amountCents: number; email: string; name: string; address: string; status: string; ts: number };

const blank = (): Product => ({ id: "", title: "", priceCents: 0, image: "", blurb: "", sizes: [], visible: true, order: 0 });

// Downscale an image to a small square-ish data URL under the inline cap.
function fileToImg(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => {
      const img = new Image();
      img.onload = () => {
        const max = 700; let { width: w, height: h } = img;
        if (w > max || h > max) { const s = max / Math.max(w, h); w = Math.round(w * s); h = Math.round(h * s); }
        const c = document.createElement("canvas"); c.width = w; c.height = h;
        c.getContext("2d")!.drawImage(img, 0, 0, w, h);
        let q = 0.82, out = c.toDataURL("image/jpeg", q);
        while (out.length > 380_000 && q > 0.4) { q -= 0.12; out = c.toDataURL("image/jpeg", q); }
        resolve(out);
      };
      img.onerror = reject; img.src = String(r.result);
    };
    r.onerror = reject; r.readAsDataURL(file);
  });
}

export default function MerchAdmin() {
  const [brand, setBrand] = useState({ name: "Coach Hayes Football", logo: "" });
  const [items, setItems] = useState<Product[]>([]);
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [status, setStatus] = useState("");
  const fileRefs = useRef<Record<number, HTMLInputElement | null>>({});

  const tok = async (): Promise<Record<string, string>> => { const t = await getIdToken(); return t ? { Authorization: `Bearer ${t}` } : {}; };

  async function load() {
    const h = await tok();
    try {
      const [cfg, prod, ord] = await Promise.all([
        fetch("/api/site-config", { cache: "no-store" }).then((r) => r.json()).catch(() => ({})),
        fetch("/api/shop/products?all=1", { headers: h, cache: "no-store" }).then((r) => r.json()).catch(() => ({ products: [] })),
        fetch("/api/shop/orders", { headers: h, cache: "no-store" }).then((r) => r.json()).catch(() => ({ orders: [] })),
      ]);
      if (cfg?.branding) setBrand({ name: cfg.branding.siteName || "Coach Hayes Football", logo: cfg.branding.logo || "" });
      setItems(prod.products || []);
      setOrders(ord.orders || []);
    } finally { setLoading(false); }
  }
  useEffect(() => { load(); }, []);

  const upd = (i: number, part: Partial<Product>) => setItems((arr) => arr.map((p, j) => (j === i ? { ...p, ...part } : p)));
  const add = () => setItems((arr) => [...arr, blank()]);

  async function onFile(i: number, f: File) {
    try { upd(i, { image: await fileToImg(f) }); } catch { setStatus("Could not read that image."); }
  }

  async function save(i: number) {
    setStatus("Saving…");
    const p = items[i];
    try {
      const r = await fetch("/api/shop/products", { method: "POST", headers: { "Content-Type": "application/json", ...(await tok()) }, body: JSON.stringify({ product: p }) });
      const d = await r.json().catch(() => ({}));
      if (r.ok && d.saved) { if (!p.id && d.id) upd(i, { id: d.id }); setStatus("Saved."); }
      else setStatus(`Save failed (${r.status}${d.error ? ": " + d.error : ""}).`);
    } catch { setStatus("Save failed."); }
    setTimeout(() => setStatus((s) => (s === "Saved." ? "" : s)), 3500);
  }

  async function remove(i: number) {
    const p = items[i];
    if (p.id && !confirm("Delete this product?")) return;
    if (p.id) { try { await fetch(`/api/shop/products?id=${p.id}`, { method: "DELETE", headers: await tok() }); } catch {} }
    setItems((arr) => arr.filter((_, j) => j !== i));
  }

  return (
    <Shell title="Merch" sub={items.length ? `${items.length} product${items.length === 1 ? "" : "s"} · ${orders.length} order${orders.length === 1 ? "" : "s"}` : "Create products and sell them on your own site"} brandName={brand.name} logo={brand.logo}>
      <div className="card">
        <div style={{ display: "flex", gap: 14, alignItems: "center", flexWrap: "wrap", marginBottom: 10 }}>
          <div><h3>Products</h3><p className="cs" style={{ margin: 0 }}>Create your merch here — it shows on the public shop and sells with on-site checkout (customer email + address kept by you).</p></div>
          <button className="btn sm" style={{ marginLeft: "auto" }} onClick={add}>+ Add product</button>
        </div>

        {loading ? <div className="note" style={{ margin: 0 }}>Loading…</div> : items.length === 0 ? (
          <div className="note" style={{ margin: 0 }}>No products yet. Add your first — it appears on the shop once visible. <Link className="link" href="/shop" target="_blank">View shop →</Link></div>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
            {items.map((p, i) => (
              <div key={p.id || i} style={{ display: "grid", gridTemplateColumns: "auto 1fr auto", gap: 16, alignItems: "start", padding: 14, border: "1px solid var(--hair)", borderRadius: 12 }}>
                <div style={{ textAlign: "center" }}>
                  <div onClick={() => fileRefs.current[i]?.click()} title="Upload product photo" style={{ width: 96, height: 96, borderRadius: 10, backgroundSize: "cover", backgroundPosition: "center", border: "2px solid var(--hair)", cursor: "pointer", backgroundImage: p.image ? `url(${p.image})` : undefined, display: "grid", placeItems: "center", fontSize: 11, color: "var(--dim)" }}>{!p.image && "Photo"}</div>
                  <input ref={(el) => { fileRefs.current[i] = el; }} type="file" accept="image/*" style={{ display: "none" }} onChange={(e) => { const f = e.target.files?.[0]; if (f) onFile(i, f); }} />
                  <button className="btn sm" style={{ marginTop: 8, width: "100%" }} onClick={() => fileRefs.current[i]?.click()}>{p.image ? "Change" : "Add photo"}</button>
                </div>
                <div style={{ display: "grid", gap: 8 }}>
                  <input value={p.title} onChange={(e) => upd(i, { title: e.target.value })} placeholder="Product title (e.g. Po' Lil Timmy Tee)" style={inpStyle} />
                  <div style={{ display: "grid", gridTemplateColumns: "140px 1fr", gap: 8 }}>
                    <input type="number" min={0} step="0.01" value={p.priceCents ? (p.priceCents / 100).toString() : ""} onChange={(e) => upd(i, { priceCents: Math.round((Number(e.target.value) || 0) * 100) })} placeholder="Price $" style={inpStyle} />
                    <input value={p.sizes.join(", ")} onChange={(e) => upd(i, { sizes: e.target.value.split(",").map((s) => s.trim()).filter(Boolean) })} placeholder="Sizes (comma-separated, e.g. S, M, L, XL) — blank if none" style={inpStyle} />
                  </div>
                  <textarea rows={2} value={p.blurb} onChange={(e) => upd(i, { blurb: e.target.value })} placeholder="Short description (optional)" style={{ ...inpStyle, resize: "vertical" }} />
                </div>
                <div style={{ display: "flex", flexDirection: "column", gap: 8, alignItems: "flex-end" }}>
                  <label style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 13, color: "var(--sub)", cursor: "pointer" }}><input type="checkbox" checked={p.visible} onChange={(e) => upd(i, { visible: e.target.checked })} /> Visible</label>
                  <button className="btn sm" style={{ background: "var(--acc)", color: "var(--accInk)" }} onClick={() => save(i)}>Save</button>
                  <button style={{ fontSize: 12, color: "var(--live)", background: "none", border: "none", cursor: "pointer" }} onClick={() => remove(i)}>Delete</button>
                </div>
              </div>
            ))}
          </div>
        )}
        {status && <p style={{ fontSize: 13, marginTop: 12, color: status.includes("failed") ? "var(--live)" : "var(--green)" }}>{status}</p>}
      </div>

      <div className="card" style={{ marginTop: 16 }}>
        <h3>Orders</h3>
        <p className="cs" style={{ marginTop: 0 }}>Paid orders land here with the customer&apos;s email + shipping address so you can fulfill them.</p>
        {orders.length === 0 ? (
          <div className="note" style={{ margin: 0 }}>No orders yet. They appear here the moment someone checks out.</div>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            {orders.map((o) => (
              <div key={o.id} style={{ display: "flex", gap: 14, alignItems: "flex-start", padding: "10px 0", borderBottom: "1px solid var(--hair)" }}>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontWeight: 600 }}>{o.title}{o.size ? ` · ${o.size}` : ""} × {o.qty}</div>
                  <div className="cs">{o.name ? o.name + " · " : ""}{o.email}{o.address ? ` · ${o.address}` : ""}</div>
                </div>
                <div style={{ textAlign: "right", whiteSpace: "nowrap" }}><div style={{ fontWeight: 600 }}>${(o.amountCents / 100).toFixed(2)}</div><div className="cs">{new Date(o.ts).toLocaleDateString()}</div></div>
              </div>
            ))}
          </div>
        )}
      </div>
    </Shell>
  );
}

const inpStyle: React.CSSProperties = { width: "100%", padding: "9px 12px", borderRadius: 8, border: "1px solid var(--hair)", background: "var(--soft)", color: "var(--ink)", fontSize: 13.5 };
