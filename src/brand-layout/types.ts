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
  sizes: Option[];
  languages: Option[];
  tc: Option[];
  tcText: Record<string, Record<string, string>>;
  tcStyle: TcStyle;
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
