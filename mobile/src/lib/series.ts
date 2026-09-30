// Mirror of lib/siteData.ts SERIES on the website, so the app's Shows tab shows
// the same five programs. Kept as a static list (matches the site's defaults).

import type { WellName } from "./theme";

export type Series = {
  key: string;
  title: string;
  badge: string;
  blurb: string;
  well: WellName;
};

export const SERIES: Series[] = [
  {
    key: "flagship-show",
    title: "The Flagship Show",
    badge: "Live Talk",
    blurb:
      "The flagship live broadcast — news, guests, and the pulse of the coast, every week.",
    well: "amber",
  },
  {
    key: "patio",
    title: "Patio Perspectives",
    badge: "Long-form",
    blurb:
      "Long-form sit-downs on the patio. Slow conversations, deep topics, good light.",
    well: "blue",
  },
  {
    key: "one-thing",
    title: "Let Me Tell U 1 Thing",
    badge: "Short-form",
    blurb: "Sharp, single-idea shorts. One point, made well, in under five minutes.",
    well: "clay",
  },
  {
    key: "riding",
    title: "On the Road",
    badge: "On the Road",
    blurb:
      "On the road across the region — markets, makers, and the stories in between.",
    well: "green",
  },
  {
    key: "rise",
    title: "Rise of the Fall",
    badge: "Docu-series",
    blurb:
      "A serialized documentary tracking one long season of change on the coast.",
    well: "purple",
  },
];
