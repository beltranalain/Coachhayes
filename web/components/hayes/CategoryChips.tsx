import { CHIP_META, CATEGORIES, type Chip, type CategoryKey } from "@/lib/chips";

// The 5 category chip icons (from the approved mock). The SVG shows the category;
// the ring color shows the awarded tier (bronze/silver/gold/blue). Presentational
// — safe in both server (public pages) and client (admin) components.
const ICONS: Record<CategoryKey, React.ReactNode> = {
  power: <path d="M5 15c0-3.3 2.2-5.6 5.4-5.6h2.1c1.6 0 2.6-.8 2.6-2.1 0-1-.5-1.8-1.5-2.2l.8-1.9c2 .8 3.1 2.3 3.1 4.2 0 2.5-1.9 4.2-4.7 4.2h-2c-2 0-3.3 1.3-3.3 3.4v1.6H5V15z" />,
  speed: <><circle cx="14.6" cy="4.4" r="2" /><path d="M12.8 7.6 9.4 9.2 7 13l1.7 1 2-3.1 2-.9-1 3.5 3.2 3.1.9 3.3 1.9-.5-1-3.9-2.4-2.4 1.1-3.6 1.9 2.4 3.1.3.2-1.9-2.4-.3-2.1-2.7c-.5-.6-1.4-.8-2.1-.4z" /></>,
  motor: <path d="M12 20.5 4.2 13c-2-2-2-5.2 0-7.1a5.1 5.1 0 0 1 7.2 0l.6.6.6-.6a5.1 5.1 0 0 1 7.2 0c2 1.9 2 5.1 0 7.1L12 20.5z" />,
  technique: <><path d="M19.8 4.2a4.3 4.3 0 0 0-5.6 5.4l-1.9 1.9 2.2 2.2 1.9-1.9a4.3 4.3 0 0 0 5.4-5.6l-2.3 2.3-2-.1-.1-2 2.4-2.2z" /><path d="m15.3 14.9 4.5 4.5-2.1 2.1-4.5-4.5zM4.2 17.4 12 9.6l-1.4-1.4 1.8-1.8-2.6-2.6c-1.6-1.6-3.6-.9-4.6.1L8 6.7l-1.4 1.4L4.4 5.9c-1 1-1.7 3-.1 4.6l2.6 2.6 1.8-1.8L10 12.7l-7.8 7.8z" /></>,
  iq: <path d="M15.5 2.5c3.3 0 5.5 2.4 5.5 5.6 0 1.5-.5 2.7-1.4 3.7v3.4c0 1.2-1 2.2-2.2 2.2h-1.2v2.1c0 1.1-.9 2-2 2h-4c-1.1 0-2-.9-2-2v-3.1L5.6 14C3.9 12.4 3 10.3 3 8.1 3 4.9 5.6 2.3 8.9 2.3c1.4 0 2.6.4 3.6 1.2a6.1 6.1 0 0 1 3-1z" />,
};

export function CategoryIcon({ category, chip, size = 26 }: { category: CategoryKey; chip?: Chip; size?: number }) {
  const ring = chip ? CHIP_META[chip].ring : "#A9B2BD";
  const label = CATEGORIES.find((c) => c.key === category)?.label;
  return (
    <span title={chip ? `${label}: ${CHIP_META[chip].label}` : label} style={{ display: "inline-grid", placeItems: "center", width: size, height: size, borderRadius: "50%", background: "#12151b", color: "#fff", boxShadow: `0 0 0 2px ${ring}`, flexShrink: 0 }}>
      <svg viewBox="0 0 24 24" fill="currentColor" style={{ width: "60%", height: "60%", display: "block" }}>{ICONS[category]}</svg>
    </span>
  );
}

// A row of all 5 category icons for a player.
export default function CategoryChips({ categories, overall, size = 24 }: { categories?: Partial<Record<CategoryKey, Chip>>; overall?: Chip; size?: number }) {
  return (
    <span style={{ display: "inline-flex", gap: 5 }}>
      {CATEGORIES.map((cat) => (
        <CategoryIcon key={cat.key} category={cat.key} chip={categories?.[cat.key] || overall} size={size} />
      ))}
    </span>
  );
}
