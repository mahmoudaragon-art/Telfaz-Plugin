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
  TcFont,
  TcClientStyle,
  TcWriteOptions,
  TcLayoutRule,
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
    // Google Ads — from SNB Creative Requirements (GDN / YouTube / PMAX / Search),
    // deduplicated by dimension. Static, video and logo formats.
    { label: "Square", value: "GoogleSquare", w: 1200, h: 1200, category: "google" },
    { label: "Landscape", value: "GoogleLandscape", w: 1200, h: 628, category: "google" },
    { label: "Vertical", value: "GoogleVertical", w: 900, h: 1600, category: "google" },
    { label: "Portrait", value: "GooglePortrait", w: 960, h: 1200, category: "google" },
    { label: "Video Horizontal", value: "GoogleVideoH", w: 1920, h: 1080, category: "google" },
    { label: "Video Square", value: "GoogleVideoSquare", w: 1080, h: 1080, category: "google" },
    { label: "Video Vertical", value: "GoogleVideoVertical", w: 1080, h: 1920, category: "google" },
    { label: "Logo Landscape", value: "GoogleLogoLandscape", w: 1200, h: 300, category: "google" },
    // Cute Box — Budget client assets (AR & EN), real .pdf filenames (split into
    // AR/EN subfolders, found by the recursive resolver). "{lang}" → AR/EN.
    // The "Digital" sizes exist only in Arabic (langs:["AR"]) so they drop out
    // of the list when English is selected.
    { label: "Budget Website", value: "CB_Budget", w: 630, h: 300, category: "cutebox", asset: "Cute box {lang} budget website (630-300) {lang}.pdf" },
    { label: "Application", value: "CB_Application", w: 375, h: 200, category: "cutebox", asset: "Cute box {lang}Application 375-200 full visuals {lang}.pdf" },
    { label: "Landscape", value: "CB_Landscape", w: 1200, h: 628, category: "cutebox", asset: "Cute box {lang}Landscape image size (1200 x 628) {lang}.pdf" },
    { label: "Portrait", value: "CB_Portrait", w: 960, h: 1200, category: "cutebox", asset: "Cute box {lang}Portrait image size (960 x 1200) {lang}.pdf" },
    { label: "Digital 344×1032", value: "CB_Digital_344x1032", w: 344, h: 1032, category: "cutebox", langs: ["AR"], asset: "Cute box {lang}Digital (344-1032) {lang}.pdf" },
    { label: "Digital 768×432", value: "CB_Digital_768x432", w: 768, h: 432, category: "cutebox", langs: ["AR"], asset: "Cute box {lang}Digital (768-432) {lang}.pdf" },
    { label: "Digital 1080×1920", value: "CB_Digital_1080x1920", w: 1080, h: 1920, category: "cutebox", langs: ["AR"], asset: "Cute box {lang}Digital (1080-1920) {lang}.pdf" },
    { label: "Digital 2048×576", value: "CB_Digital_2048x576", w: 2048, h: 576, category: "cutebox", langs: ["AR"], asset: "Cute box {lang}Digital (2048-576) {lang}.pdf" },
    { label: "Digital 2816×960", value: "CB_Digital_2816x960", w: 2816, h: 960, category: "cutebox", langs: ["AR"], asset: "Cute box {lang}Digital (2816-960) {lang}.pdf" },
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
    safeMarginXPx: 70,
    safeMarginYPx: 80,
    // Per-size bottom gap (px), keyed by "{w}x{h}". Sizes not listed use safeMarginYPx (80).
    marginYByDim: {
      "1920x1080": 124, // FHD
      "1080x1350": 75, // Instagram
      "1080x1920": 140, // Vertical
      // Square 1080x1080 → default 80
    },
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
  // Per-client T&C typography. psName must be the Photoshop PostScript name —
  // verify these in Photoshop and adjust if a run shows a fallback font.
  tcClientStyles: {
    NEO: {
      ar: { family: "Risala", style: "Medium", sizePx: 14, leadingPx: 20, color: "#FFFFFF" },
      en: { family: "SangBleu Sunrise", style: "Regular", sizePx: 14, leadingPx: 20, color: "#FFFFFF" },
      latin: { family: "SangBleu Sunrise", style: "Regular", sizePx: 14, leadingPx: 20, color: "#FFFFFF" },
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
  // Sizes with an explicit asset filename (e.g. Cute Box .pdf files) bypass the
  // name pattern entirely — return the real filename with "{lang}" filled in.
  const size = cfg.sizes.find((z) => z.value === s.size);
  if (size?.asset) return size.asset.replace(/\{lang\}/gi, s.lang);
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

/**
 * Display/artboard/layer name for an asset-named size (Cute Box). Takes the real
 * filename, drops the extension, then strips the first two words — the "Cute box"
 * brand prefix and the leading AR/EN language code — leaving e.g.
 * "Cute box ENApplication 375-200 full visuals EN.pdf" → "Application 375-200 full visuals EN".
 * Returns null for sizes without an asset filename (use the normal name there).
 */
export function assetDisplayName(size: SizeOption, lang: string | null): string | null {
  if (!size.asset || !lang) return null;
  return size.asset
    .replace(/\{lang\}/gi, lang)
    .replace(/\.[a-z0-9]{2,4}$/i, "") // drop extension
    .replace(/^\s*cute\s*box\s*/i, "") // drop "Cute box"
    .replace(/^\s*(AR|EN)\s*/i, "") // drop the leading language code
    .trim();
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
