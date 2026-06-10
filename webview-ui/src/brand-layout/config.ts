/* ============================================================
   Brand Layout — configuration model + persistence
   Ported from the original config.json + override system.

   The data *shapes* live in the shared contract (src/brand-layout/types.ts)
   so the UXP host and this webview agree on what crosses the bridge. This
   file owns the base config + localStorage persistence (webview side).
   ============================================================ */

import type {
  Option,
  Brand,
  TcStyle,
  About,
  Ui,
  Config,
  Selection,
} from "../../../src/brand-layout/types";

export type {
  Option,
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
  clients: ["Budget", "Nava", "Nough", "NEO", "SNB"],
  sizes: [
    { label: "Square", value: "Square" },
    { label: "Vertical", value: "Vertical" },
    { label: "FHD", value: "FHD" },
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
    author: "Mahmoud",
    role: "Designer",
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

/* ---------------- deep merge + overrides persistence ---------------- */

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

export function loadOverrides(): Partial<Config> {
  try {
    return JSON.parse(localStorage.getItem("overrides") || "{}");
  } catch {
    return {};
  }
}

export function saveOverrides(o: Partial<Config>) {
  localStorage.setItem("overrides", JSON.stringify(o));
}

export function mergeOverrides(base: Config, ov: Partial<Config>): Config {
  const out: Config = JSON.parse(JSON.stringify(base));
  deepMerge(out, ov);
  return out;
}

/** Effective config = base + saved overrides. */
export function loadConfig(): Config {
  return mergeOverrides(baseConfig, loadOverrides());
}

/* ---------------- selection helpers ---------------- */

export function buildBaseName(cfg: Config, s: Selection): string | null {
  if (!s.client || !s.size || !s.lang || !s.tc) return null;
  return cfg.namePattern
    .replace("{client}", s.client)
    .replace("{size}", s.size)
    .replace("{lang}", s.lang)
    .replace("{tc}", s.tc);
}

export function persistSelection(s: Selection) {
  localStorage.setItem("selection", JSON.stringify(s));
}

export function loadSelection(): Partial<Selection> {
  try {
    return JSON.parse(localStorage.getItem("selection") || "{}");
  } catch {
    return {};
  }
}
