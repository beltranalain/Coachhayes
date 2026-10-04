"use client";

import { useEffect, useState } from "react";
import ShopCheckout from "./ShopCheckout";

type Product = { id: string; title: string; priceCents: number; image: string; blurb: string; sizes: string[]; visible: boolean; order: number };

// Public shop grid — real products from /api/shop/products, on-site checkout.
export default function ShopGrid({ emptyTitle, emptyText }: { emptyTitle: string; emptyText: string }) {
  const [products, setProducts] = useState<Product[] | null>(null);
  const [buy, setBuy] = useState<Product | null>(null);

  useEffect(() => {
    fetch("/api/shop/products", { cache: "no-store" })
      .then((r) => r.json()).then((d) => setProducts(d.products || [])).catch(() => setProducts([]));
  }, []);

  if (products === null) return <div className="card" style={{ textAlign: "center", padding: "40px 30px", color: "var(--sub)" }}>Loading…</div>;
  if (products.length === 0) {
    return (
      <div className="card" style={{ textAlign: "center", padding: "56px 30px" }}>
        <h3 style={{ marginBottom: 8 }}>{emptyTitle}</h3>
        <p style={{ color: "var(--sub)", maxWidth: "46ch", margin: "0 auto" }}>{emptyText}</p>
      </div>
    );
  }
  return (
    <>
      <div className="shopgrid">
        {products.map((p) => (
          <div className="shopcard" key={p.id}>
            <div className="shopimg" style={p.image ? { backgroundImage: `url(${p.image})` } : undefined}>{!p.image && "No image"}</div>
            <div className="shopbody">
              <h3>{p.title}</h3>
              {p.blurb && <p className="shopblurb">{p.blurb}</p>}
              <div className="shoprow">
                <span className="shopprice">${(p.priceCents / 100).toFixed(2)}</span>
                <button className="pill sm" type="button" onClick={() => setBuy(p)}>Buy</button>
              </div>
            </div>
          </div>
        ))}
      </div>
      {buy && <ShopCheckout product={buy} onClose={() => setBuy(null)} />}
    </>
  );
}
