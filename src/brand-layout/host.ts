/* ============================================================
   Brand Layout — host (Photoshop / Illustrator) operations
   Ported verbatim from the original main.js logic.
   ============================================================ */

import { uxp, photoshop, illustrator } from "../globals";
import type {
  Brand,
  Config,
  TcStyle,
  TcLayoutRule,
  FolderInfo,
  VerifyResult,
  SizeOption,
} from "./types";

export type { VerifyResult } from "./types";

const fs = uxp.storage.localFileSystem;
const shell = uxp.shell;

/* ---------------- key/value persistence bridge ----------------
   The webview's own localStorage is unreliable in UXP (writes can throw),
   so the webview persists through these. UXP-context localStorage is proven
   reliable (the folder token already lives here). Never throws. */

export async function kvGet(key: string): Promise<string | null> {
  try {
    return localStorage.getItem(key);
  } catch {
    return null;
  }
}

export async function kvSet(key: string, value: string): Promise<void> {
  try {
    localStorage.setItem(key, value);
  } catch {
    /* ignore — persistence is best-effort */
  }
}

export const HOST = uxp.host.name; // "Photoshop" | "Illustrator"

/** Bridge-safe host name accessor (the webview reads this once on mount). */
export async function getHostName(): Promise<string> {
  return HOST;
}

/**
 * The connected source folder lives here on the host side. The webview can't
 * hold a native UXP folder entry, so it triggers connect/restore and we keep
 * the live reference; subsequent calls (place / verify) use this.
 */
let currentFolder: any = null;
export function hasFolder(): boolean {
  return !!currentFolder;
}

export async function getPluginVersion(): Promise<string> {
  try {
    return (uxp.entrypoints as any)._pluginInfo.version || "1.0.0";
  } catch {
    return "1.0.0";
  }
}

export function hexToRgb(hex: string) {
  const h = hex.replace("#", "");
  return {
    r: parseInt(h.substr(0, 2), 16),
    g: parseInt(h.substr(2, 2), 16),
    b: parseInt(h.substr(4, 2), 16),
  };
}

export async function openExternal(url: string) {
  await shell.openExternal(url, "");
}

/* ---------------- folder connect / restore ---------------- */

function folderLabel(folder: any): string {
  return folder.nativePath || folder.name;
}

/** Open the system picker, store the folder on the host, return its path. */
export async function connectFolder(): Promise<FolderInfo | null> {
  const folder = await fs.getFolder({});
  if (!folder) return null;
  currentFolder = folder;
  localStorage.setItem("assetsFolderToken", await fs.createPersistentToken(folder));
  return { path: folderLabel(folder) };
}

/** Re-open the previously connected folder from its persistent token. */
export async function restoreFolder(): Promise<FolderInfo | null> {
  const token = localStorage.getItem("assetsFolderToken");
  if (!token) return null;
  try {
    const folder = await fs.getEntryForPersistentToken(token);
    if (!folder) return null;
    currentFolder = folder;
    return { path: folderLabel(folder) };
  } catch {
    localStorage.removeItem("assetsFolderToken");
    return null;
  }
}

/* ---------------- asset resolution + placement ---------------- */

async function resolveAssetEntry(folder: any, base: string, cfg: Config) {
  const entries = await folder.getEntries();
  const hostExt = HOST === "Illustrator" ? "ai" : "psd";
  const ordered = [base + "." + hostExt, ...cfg.extensions.map((e) => base + "." + e)];
  for (const name of ordered) {
    const hit = entries.find(
      (e: any) => e.isFile && e.name.toLowerCase() === name.toLowerCase(),
    );
    if (hit) return hit;
  }
  return null;
}

/** Resolve + place the linked asset for the current base name. Returns placed file name. */
export async function placeAsset(base: string, cfg: Config): Promise<string> {
  if (!currentFolder) throw new Error("Connect the source folder first");
  const entry = await resolveAssetEntry(currentFolder, base, cfg);
  if (!entry) throw new Error("Not found: " + base + ".(ai|psd)");
  if (HOST === "Photoshop") await placeLinkedPhotoshop(entry);
  else if (HOST === "Illustrator") await placeLinkedIllustrator(entry);
  else throw new Error("Unsupported host: " + HOST);
  return entry.name;
}

async function placeLinkedPhotoshop(entry: any) {
  const ps = photoshop;
  await ps.core.executeAsModal(
    async () => {
      const token = await fs.createSessionToken(entry);
      await ps.action.batchPlay(
        [
          {
            _obj: "placeEvent",
            null: { _path: token, _kind: "local" },
            linked: true,
            freeTransformCenterState: {
              _enum: "quadCenterState",
              _value: "QCSAverage",
            },
            _options: { dialogOptions: "dontDisplay" },
          },
        ],
        { synchronousExecution: true } as any,
      );
    },
    { commandName: "Place Linked Asset" },
  );
}

async function placeLinkedIllustrator(entry: any) {
  const ill = illustrator;
  const app = ill.app;
  if (!app.documents.length) throw new Error("Open a document first");
  const doc = app.activeDocument;
  const token = await fs.createSessionToken(entry);
  const placed = doc.placedItems.add();
  placed.file = token; // linked (do NOT embed)
  const ab = doc.artboards[doc.artboards.getActiveArtboardIndex()].artboardRect;
  placed.position = [
    (ab[0] + ab[2]) / 2 - placed.width / 2,
    (ab[1] + ab[3]) / 2 + placed.height / 2,
  ];
}

/* ---------------- create artboard (new doc) + place ---------------- */

/**
 * Create a brand-new document sized to `size` and place the linked asset into
 * it. One new file per call (Photoshop → new PSD, Illustrator → new AI doc).
 * Batch (Multiple) mode calls this once per checked size.
 */
export async function createArtboardAndPlace(
  base: string,
  size: SizeOption,
  cfg: Config,
): Promise<string> {
  if (!currentFolder) throw new Error("Connect the source folder first");
  const entry = await resolveAssetEntry(currentFolder, base, cfg);
  if (!entry) throw new Error("Not found: " + base + ".(ai|psd)");
  if (HOST === "Photoshop") {
    await createDocPhotoshop(size, base);
    await placeLinkedPhotoshop(entry);
  } else if (HOST === "Illustrator") {
    await createDocIllustrator(size, base);
    await placeLinkedIllustrator(entry);
  } else {
    throw new Error("Unsupported host: " + HOST);
  }
  return entry.name;
}

async function createDocPhotoshop(size: SizeOption, name: string) {
  const ps = photoshop;
  await ps.core.executeAsModal(
    async () => {
      await ps.app.documents.add({
        width: size.w,
        height: size.h,
        resolution: 72,
        name,
        fill: "white",
        mode: "RGBColorMode",
      } as any);
    },
    { commandName: "Create Artboard (" + size.label + ")" },
  );
}

async function createDocIllustrator(size: SizeOption, name: string) {
  const ill = illustrator;
  const app = ill.app;
  // UXP Illustrator document-creation surface varies between versions; try the
  // modern API, fall back to adding an artboard on the active document.
  try {
    await app.documents.add({ width: size.w, height: size.h, title: name } as any);
  } catch {
    if (!app.documents.length) throw new Error("Open a document first");
    const doc = app.activeDocument;
    doc.artboards.add([0, 0, size.w, -size.h]);
  }
}

/* ---------------- T&C writer ---------------- */

export async function writeTc(
  text: string,
  style: TcStyle,
  lang: string,
  dir: "rtl" | "ltr" = lang === "AR" ? "rtl" : "ltr",
  layout?: TcLayoutRule,
) {
  const font = lang === "AR" ? style.fontAR : style.fontEN;
  if (HOST === "Photoshop") await writeTcPhotoshop(text, font, style, dir, layout);
  else if (HOST === "Illustrator") await writeTcIllustrator(text, font, style, dir);
  else throw new Error("Unsupported host: " + HOST);
}

/** Find a layer (recursing into groups) by exact name. */
function findLayerByName(layers: any, name: string): any {
  for (const ly of layers) {
    if (ly.name === name) return ly;
    if (ly.layers && ly.layers.length) {
      const hit = findLayerByName(ly.layers, name);
      if (hit) return hit;
    }
  }
  return null;
}

async function writeTcPhotoshop(
  text: string,
  font: string,
  st: TcStyle,
  dir: "rtl" | "ltr",
  layout?: TcLayoutRule,
) {
  const ps = photoshop;
  const c = hexToRgb(st.color);
  await ps.core.executeAsModal(
    async () => {
      await ps.action.batchPlay(
        [
          {
            _obj: "make",
            _target: [{ _ref: "textLayer" }],
            using: {
              _obj: "textLayer",
              textKey: text,
              textStyleRange: [
                {
                  _obj: "textStyleRange",
                  from: 0,
                  to: text.length,
                  textStyle: {
                    _obj: "textStyle",
                    fontPostScriptName: font,
                    size: { _unit: "pointsUnit", _value: st.sizePt },
                    color: { _obj: "RGBColor", red: c.r, grain: c.g, blue: c.b },
                  },
                },
              ],
              paragraphStyle: {
                _obj: "paragraphStyle",
                direction: {
                  _enum: "direction",
                  _value: dir === "rtl" ? "dirRightToLeft" : "dirLeftToRight",
                },
              },
            },
          },
        ],
        { synchronousExecution: true } as any,
      );

      const doc = ps.app.activeDocument;
      const layer = doc.activeLayers[0];
      const b = layer.bounds; // left, top, right, bottom (px)

      const moveText = async (tx: number, ty: number) => {
        await ps.action.batchPlay(
          [
            {
              _obj: "move",
              _target: [{ _ref: "layer", _enum: "ordinal", _value: "targetEnum" }],
              to: {
                _obj: "offset",
                horizontal: { _unit: "pixelsUnit", _value: tx },
                vertical: { _unit: "pixelsUnit", _value: ty },
              },
            },
          ],
          { synchronousExecution: true } as any,
        );
      };

      // ── belowLayer (e.g. Budget): nudge a named logo up, drop the T&C under
      //    it, bottom-aligned to another named logo. Falls back to bottom-anchor
      //    if the named layers aren't present.
      let placed = false;
      if (layout && layout.mode === "belowLayer" && layout.moveLayer && layout.alignTo) {
        try {
          const leftL = findLayerByName(doc.layers, layout.moveLayer);
          const rightL = findLayerByName(doc.layers, layout.alignTo);
          if (leftL && rightL) {
            const gap = layout.gap ?? 24;
            const L = leftL.bounds;
            const R = rightL.bounds;
            // align T&C left edge under the left logo, bottom edge to right logo
            await moveText(L.left - b.left, R.bottom - b.bottom);
            // re-read the T&C bounds after the move, then lift the left logo above it
            const t2 = doc.activeLayers[0].bounds;
            leftL.translate(0, t2.top - gap - L.bottom);
            placed = true;
          }
        } catch (e) {
          console.warn("belowLayer T&C failed, using bottom anchor", e);
        }
      }

      // ── bottom anchor (NEO/default). Safe margin = % of the shorter side.
      if (!placed) {
        const pct = st.safeMarginPct ?? 4;
        const margin = pct
          ? Math.round(Math.min(doc.width, doc.height) * (pct / 100))
          : st.marginPt * ((doc as any).resolution / 72);
        const lw = b.right - b.left,
          lh = b.bottom - b.top;
        let tx: number, ty: number;
        const anchor = st.anchor;
        if (anchor.indexOf("bottom") === 0) ty = doc.height - margin - lh - b.top;
        else ty = margin - b.top;
        if (anchor.indexOf("left") > -1) tx = margin - b.left;
        else if (anchor.indexOf("right") > -1) tx = doc.width - margin - lw - b.left;
        else tx = (doc.width - lw) / 2 - b.left;
        await moveText(tx, ty);
      }
    },
    { commandName: "Write T&C" },
  );
}

async function writeTcIllustrator(text: string, font: string, st: TcStyle, _dir: "rtl" | "ltr") {
  const ill = illustrator;
  const app = ill.app;
  if (!app.documents.length) throw new Error("Open a document first");
  const doc = app.activeDocument;
  const tf = doc.textFrames.add();
  tf.contents = text;
  try {
    tf.textRange.characterAttributes.textFont = app.textFonts.getByName(font);
  } catch {}
  tf.textRange.characterAttributes.size = st.sizePt;
  const c = hexToRgb(st.color);
  const col = new ill.RGBColor();
  col.red = c.r;
  col.green = c.g;
  col.blue = c.b;
  tf.textRange.characterAttributes.fillColor = col;
  // Anchor on active artboard. Safe margin = % of the shorter artboard side.
  const ab = doc.artboards[doc.artboards.getActiveArtboardIndex()].artboardRect; // [l,t,r,b]
  const abW = Math.abs(ab[2] - ab[0]);
  const abH = Math.abs(ab[1] - ab[3]);
  const pct = st.safeMarginPct ?? 4;
  const m = pct ? Math.round(Math.min(abW, abH) * (pct / 100)) : st.marginPt;
  const w = tf.width,
    h = tf.height;
  let x: number, y: number;
  if (st.anchor.indexOf("left") > -1) x = ab[0] + m;
  else if (st.anchor.indexOf("right") > -1) x = ab[2] - m - w;
  else x = (ab[0] + ab[2]) / 2 - w / 2;
  if (st.anchor.indexOf("bottom") === 0) y = ab[3] + m + h;
  else y = ab[1] - m;
  tf.position = [x, y];
}

/* ---------------- import brand colors ---------------- */

export async function importColors(brand: Brand) {
  if (!(brand.colors || []).length) throw new Error("No colors set for this brand");
  if (HOST === "Illustrator") await importColorsIllustrator(brand);
  else if (HOST === "Photoshop") await importColorsPhotoshop(brand);
  else throw new Error("Unsupported host: " + HOST);
}

async function importColorsIllustrator(brand: Brand) {
  const ill = illustrator;
  const app = ill.app;
  if (!app.documents.length) throw new Error("Open a document first");
  const doc = app.activeDocument;
  brand.colors.forEach((hex) => {
    const c = hexToRgb(hex);
    const col = new ill.RGBColor();
    col.red = c.r;
    col.green = c.g;
    col.blue = c.b;
    const sw = doc.swatches.add();
    sw.name = brand.name + " " + hex;
    sw.color = col;
  });
}

async function importColorsPhotoshop(brand: Brand) {
  const ps = photoshop;
  await ps.core.executeAsModal(
    async () => {
      for (const hex of brand.colors) {
        const c = hexToRgb(hex);
        await ps.action.batchPlay(
          [
            {
              _obj: "make",
              _target: [{ _ref: "contentLayer" }],
              using: {
                _obj: "contentLayer",
                type: {
                  _obj: "solidColorLayer",
                  color: { _obj: "RGBColor", red: c.r, grain: c.g, blue: c.b },
                },
                name: brand.name + " " + hex,
              },
            },
          ],
          { synchronousExecution: true } as any,
        );
      }
    },
    { commandName: "Import Brand Colors" },
  );
}

/* ---------------- pick brand color → Photoshop foreground ---------------- */

/** Set the Photoshop foreground color to a hex (Brands tab → click a swatch). */
export async function setForegroundColor(hex: string) {
  if (HOST !== "Photoshop") throw new Error("Color picking is Photoshop-only");
  const ps = photoshop;
  const c = hexToRgb(hex);
  await ps.core.executeAsModal(
    async () => {
      await ps.action.batchPlay(
        [
          {
            _obj: "set",
            _target: [{ _ref: "color", _property: "foregroundColor" }],
            to: { _obj: "RGBColor", red: c.r, grain: c.g, blue: c.b },
            source: "photoshopPicker",
          },
        ],
        { synchronousExecution: true } as any,
      );
    },
    { commandName: "Set Foreground Color" },
  );
}

/* ---------------- verify assets ---------------- */

function buildAllCombos(cfg: Config): string[] {
  const combos: string[] = [];
  for (const client of cfg.clients)
    for (const size of cfg.sizes)
      for (const lang of cfg.languages)
        for (const tc of cfg.tc)
          combos.push(
            cfg.namePattern
              .replace("{client}", client)
              .replace("{size}", size.value)
              .replace("{lang}", lang.value)
              .replace("{tc}", tc.value),
          );
  return combos;
}

export async function verifyAssets(cfg: Config): Promise<VerifyResult> {
  if (!currentFolder) throw new Error("Connect the folder first");
  const entries = await currentFolder.getEntries();
  const names = new Set(
    entries.filter((e: any) => e.isFile).map((e: any) => e.name.toLowerCase()),
  );
  const combos = buildAllCombos(cfg);
  let present = 0;
  const missing: string[] = [];
  for (const base of combos) {
    const found = cfg.extensions.some((ext) =>
      names.has((base + "." + ext).toLowerCase()),
    );
    if (found) present++;
    else missing.push(base);
  }
  return { present, total: combos.length, missing };
}

/* ---------------- logo picker ---------------- */

function arrayBufferToBase64(buf: ArrayBuffer): string {
  let bin = "";
  const bytes = new Uint8Array(buf);
  for (let i = 0; i < bytes.length; i++) bin += String.fromCharCode(bytes[i]);
  return btoa(bin);
}

export async function pickLogoDataUrl(): Promise<{ dataUrl: string; name: string } | null> {
  const file = await fs.getFileForOpening({
    types: ["png", "jpg", "jpeg", "svg"],
  } as any);
  if (!file || Array.isArray(file)) return null;
  const data = (await file.read({ format: uxp.storage.formats.binary })) as ArrayBuffer;
  const b64 = arrayBufferToBase64(data);
  const ext = (file.name.split(".").pop() || "png").toLowerCase();
  const mime =
    ext === "svg"
      ? "image/svg+xml"
      : ext === "jpg" || ext === "jpeg"
        ? "image/jpeg"
        : "image/png";
  return { dataUrl: "data:" + mime + ";base64," + b64, name: file.name };
}
