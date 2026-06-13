/* ============================================================
   Brand Layout — shared data contract.

   These are plain TypeScript types only (no runtime code), so they can be
   imported from BOTH contexts:
     - the UXP host side  (src/brand-layout/host.ts, src/api/api.ts)
     - the webview UI side (webview-ui/src/brand-layout/*)
   Everything that crosses the Comlink bridge must be shaped like these.
   ============================================================ */

export interface Option {
  label: string;
  value: string;
}

/**
 * A deliverable size. `value` feeds the {size} token in the filename pattern;
 * `w`/`h` (pixels) drive artboard creation and the "label — w×h" display.
 * `category` groups it for the batch (Multiple) picker.
 */
export interface SizeOption {
  label: string;
  value: string;
  w: number;
  h: number;
  category: string;
}

export interface Brand {
  id: string;
  name: string;
  guidelinesUrl: string;
  fontsUrl: string;
  colors: string[];
}

export interface TcStyle {
  fontEN: string;
  fontAR: string;
  sizePt: number;
  color: string;
  anchor: string;
  marginPt: number;
  /** Safe margin as a % of the artboard's shorter side (legacy/fallback). */
  safeMarginPct: number;
  /** Fixed safe margins in px: horizontal (left/right) and vertical (top/bottom). */
  safeMarginXPx: number;
  safeMarginYPx: number;
}

/**
 * A font run for the T&C text. Prefer `family` + `style` (Photoshop resolves
 * these the same way the Character panel does). `psName` (exact PostScript
 * name) is used if provided. Size is in pixels; colour is hex.
 */
export interface TcFont {
  family?: string;
  style?: string;
  psName?: string;
  sizePx: number;
  /** Line spacing in px (fixed leading). */
  leadingPx?: number;
  color: string;
}

/** Per-client T&C typography (per language) + the font used for Latin digits. */
export interface TcClientStyle {
  ar: TcFont;
  en: TcFont;
  /** Font for digits embedded in Arabic text (kept Latin even in AR). */
  latin?: TcFont;
}

/** Everything the host needs to write a T&C text layer. */
export interface TcWriteOptions {
  text: string;
  dir: "rtl" | "ltr";
  anchor: string;
  /** Fixed safe margins in px (horizontal = left/right, vertical = top/bottom). */
  marginXPx: number;
  marginYPx: number;
  /** Names the T&C layer "T&C {artboardName}" (falls back to the doc name). */
  artboardName?: string;
  font: TcFont;
  latinFont?: TcFont;
  layout?: TcLayoutRule;
}

/**
 * Per-client T&C placement rule.
 * - "bottom": write the T&C bottom-aligned inside the safe margin (NEO/default).
 * - "belowLayer": nudge `moveLayer` up and place the T&C beneath it, bottom-
 *   aligned to `alignTo`'s bottom (Budget). Layers are matched by name.
 */
export interface TcLayoutRule {
  mode: "bottom" | "belowLayer";
  moveLayer?: string;
  alignTo?: string;
  gap?: number;
}

export interface About {
  author: string;
  role: string;
  email: string;
  bio: string;
  links: string[];
}

export interface Ui {
  accent: string;
  accent2: string;
  particles: boolean;
  logo: string | null;
}

export interface Config {
  namePattern: string;
  extensions: string[];
  clients: string[];
  /** Ordered category list for grouping sizes in the Multiple picker. */
  categories: Option[];
  sizes: SizeOption[];
  languages: Option[];
  tc: Option[];
  tcText: Record<string, Record<string, string>>;
  tcStyle: TcStyle;
  /** Per-client T&C placement rules (client value → rule). Default is "bottom". */
  tcLayout: Record<string, TcLayoutRule>;
  /** Per-client T&C typography (client value → fonts). Falls back to tcStyle. */
  tcClientStyles: Record<string, TcClientStyle>;
  brands: Brand[];
  about: About;
  ui: Ui;
}

export type Selection = {
  client: string | null;
  size: string | null;
  lang: string | null;
  tc: string | null;
  brand: string | null;
};

export interface VerifyResult {
  present: number;
  total: number;
  missing: string[];
}

/**
 * Serializable folder reference handed to the webview. The actual UXP folder
 * entry can't cross the bridge, so the host keeps it and only sends the path.
 */
export interface FolderInfo {
  path: string;
}
