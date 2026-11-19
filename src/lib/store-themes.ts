import type { CSSProperties } from "react";

/** Storefront accent themes a shopkeeper can pick. Values feed the --store* CSS variables. */
export const STORE_THEMES = [
  { id: "amber", label: "Mango Yellow", store: "oklch(0.86 0.17 92)", fg: "oklch(0.22 0.04 60)", deep: "oklch(0.52 0.15 150)", end: "oklch(0.8 0.17 75)" },
  { id: "tomato", label: "Tomato Red", store: "oklch(0.64 0.22 27)", fg: "oklch(0.99 0.01 27)", deep: "oklch(0.42 0.17 25)", end: "oklch(0.56 0.21 18)" },
  { id: "mint", label: "Fresh Mint", store: "oklch(0.8 0.15 160)", fg: "oklch(0.24 0.06 165)", deep: "oklch(0.45 0.12 170)", end: "oklch(0.72 0.15 175)" },
  { id: "ocean", label: "Ocean Blue", store: "oklch(0.66 0.15 240)", fg: "oklch(0.99 0.01 240)", deep: "oklch(0.42 0.13 250)", end: "oklch(0.58 0.16 225)" },
  { id: "saffron", label: "Saffron", store: "oklch(0.75 0.17 55)", fg: "oklch(0.22 0.05 45)", deep: "oklch(0.45 0.14 35)", end: "oklch(0.68 0.19 40)" },
  { id: "charcoal", label: "Midnight", store: "oklch(0.3 0.03 260)", fg: "oklch(0.97 0.01 90)", deep: "oklch(0.78 0.16 85)", end: "oklch(0.22 0.03 270)" },
] as const;

export type StoreThemeId = (typeof STORE_THEMES)[number]["id"];

export function storeTheme(id: string | null | undefined) {
  return STORE_THEMES.find((t) => t.id === id) ?? STORE_THEMES[0];
}

/** Inline CSS variables that re-theme everything using bg-store / text-store-foreground / bg-store-deep. */
export function storeThemeStyle(id: string | null | undefined): CSSProperties {
  const t = storeTheme(id);
  const deepFg = t.id === "charcoal" ? "oklch(0.2 0.03 260)" : "oklch(0.98 0.01 150)";
  return {
    "--store": t.store,
    "--store-foreground": t.fg,
    "--store-deep": t.deep,
    "--store-deep-foreground": deepFg,
    "--gradient-store-hero": `radial-gradient(120% 90% at 85% 0%, color-mix(in oklab, ${t.store} 70%, white) 0%, transparent 55%), linear-gradient(135deg, ${t.store}, ${t.end})`,
  } as CSSProperties;
}
