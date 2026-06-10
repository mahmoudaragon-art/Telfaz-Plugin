/* ============================================================
   Brand Layout — configuration model + (host-backed) persistence

   The data *shapes* live in the shared contract (src/brand-layout/types.ts)
   so the UXP host and this webview agree on what crosses the bridge.

   Persistence no longer touches the webview's own localStorage (unreliable in
   UXP — writes can throw and blank the panel). Instead the app reads/writes
   through the host `api` (kvGet/kvSet); this file only owns the base config,
   the merge logic and small pure helpers.
   ============================================================ */

import type {
  Option,
  SizeOption,
  Config,
  Selection,
} from "../../../src/brand-layout/types";

export type {
  Option,
  SizeOption,
  Brand,
  TcStyle,
  About,
  Ui,
  Config,
  Selection,
  VerifyResult,
  FolderInfo,
} from "../../../src/brand-layout/types";

/** Base configuration — was config.json in the original plugin. */
export const baseConfig: Config = {
  namePattern: "{client}_{size}_{lang}_{tc}",
  extensions: ["ai", "psd"],
  clients: ["Budget", "Nava", "Noug", "NEO", "SNB", "GWM"],
  // Categories are prepared up front; sizes get added per category later.
  categories: [
    { label: "General", value: "general" },
    { label: "Google Ads", value: "google" },
    { label: "Cute Box", value: "cutebox" },
    { label: "Airport Screen", value: "airport" },
    { label: "Arabia Screens", value: "arabia" },
    { label: "MUPI Screens", value: "mupi" },
  ],
  sizes: [
    { label: "Square", value: "Square", w: 1080, h: 1080, category: "general" },
    { label: "Vertical", value: "Vertical", w: 1080, h: 1920, category: "general" },
    { label: "FHD", value: "FHD", w: 1920, h: 1080, category: "general" },
  ],
  languages: [
    { label: "EN", value: "EN" },
    { label: "AR", value: "AR" },
  ],
  tc: [
    { label: "With T&C", value: "TC" },
    { label: "Without", value: "noTC" },
  ],
  tcText: {
    Budget: { EN: "", AR: "" },
    Nava: { EN: "", AR: "" },
    Nough: { EN: "", AR: "" },
    NEO: { EN: "", AR: "" },
    SNB: { EN: "", AR: "" },
  },
  tcStyle: {
    fontEN: "Helvetica",
    fontAR: "GeezaPro",
    sizePt: 9,
    color: "#000000",
    anchor: "bottom-center",
    marginPt: 36,
    safeMarginPct: 4,
  },
  // Per-client T&C placement. Clients not listed use "bottom" (NEO/default).
  tcLayout: {
    Budget: {
      mode: "belowLayer",
      moveLayer: "@logo-left",
      alignTo: "@logo-right",
      gap: 24,
    },
  },
  brands: [
    {
      id: "telfaz",
      name: "Telfaz",
      guidelinesUrl: "",
      fontsUrl: "",
      colors: ["#FF5C1A", "#0A0A0C", "#FFFFFF"],
    },
  ],
  about: {
    author: "Mahmoud EL Deeb",
    role: "Art Director",
    email: "mahmoud.aragon@gmail.com",
    bio: "Brand Layout keeps every client's logos, layouts and T&C consistent across the whole design team — one protected source, placed the same way every time.",
    links: [],
  },
  ui: {
    accent: "#ff5c1a",
    accent2: "#d84600",
    particles: true,
    logo: null,
  },
};

/* ---------------- deep merge + overrides ---------------- */

function deepMerge<T extends Record<string, any>>(target: T, source: any): T {
  for (const k in source) {
    const v = source[k];
    if (v && typeof v === "object" && !Array.isArray(v)) {
      (target as any)[k] = (target as any)[k] || {};
      deepMerge((target as any)[k], v);
    } else {
      (target as any)[k] = v;
    }
  }
  return target;
}

export function mergeOverrides(base: Config, ov: Partial<Config>): Config {
  const out: Config = JSON.parse(JSON.stringify(base));
  deepMerge(out, ov);
  return out;
}

/** Safe JSON parse for values coming back from the host kv store. */
export function parseJSON<T>(json: string | null, fallback: T): T {
  if (!json) return fallback;
  try {
    return JSON.parse(json) as T;
  } catch {
    return fallback;
  }
}

/* ---------------- selection + size helpers ---------------- */

export function buildBaseName(cfg: Config, s: Selection): string | null {
  if (!s.client || !s.size || !s.lang || !s.tc) return null;
  return cfg.namePattern
    .replace("{client}", s.client)
    .replace("{size}", s.size)
    .replace("{lang}", s.lang)
    .replace("{tc}", s.tc);
}

/** Build the filename base for an explicit size value (batch mode). */
export function buildBaseNameForSize(
  cfg: Config,
  s: Selection,
  sizeValue: string,
): string | null {
  return buildBaseName(cfg, { ...s, size: sizeValue });
}

/** "Square — 1080×1080" */
export function sizeLabel(s: SizeOption): string {
  return `${s.label} — ${s.w}×${s.h}`;
}

export function findSize(cfg: Config, value: string | null): SizeOption | undefined {
  return cfg.sizes.find((s) => s.value === value);
}

/** Sizes grouped by category, in category order; empty categories are hidden. */
export function sizesByCategory(
  cfg: Config,
): { category: Option; sizes: SizeOption[] }[] {
  return cfg.categories
    .map((category) => ({
      category,
      sizes: cfg.sizes.filter((s) => s.category === category.value),
    }))
    .filter((group) => group.sizes.length > 0);
}
