/* ============================================================
   Brand Layout — host (Photoshop / Illustrator) operations
   Ported verbatim from the original main.js logic.
   ============================================================ */

import { uxp, photoshop, illustrator } from "../globals";
import type {
  Brand,
  Config,
  TcFont,
  TcWriteOptions,
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
            // Crop the placed .ai/.pdf to its Media Box (full page), not the art box.
            as: {
              _obj: "PDFGenericFormat",
              selection: { _enum: "pdfSelection", _value: "page" },
              pageNumber: 1,
              crop: { _enum: "cropTo", _value: "mediaBox" },
              suppressWarnings: false,
              antiAlias: true,
              clippingPath: true,
            },
            null: { _path: token, _kind: "local" },
            linked: true,
            freeTransformCenterState: { _enum: "quadCenterState", _value: "QCSAverage" },
            offset: {
              _obj: "offset",
              horizontal: { _unit: "pixelsUnit", _value: 0 },
              vertical: { _unit: "pixelsUnit", _value: 0 },
            },
            antiAlias: true,
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
  artboardName?: string,
): Promise<string> {
  if (!currentFolder) throw new Error("Connect the source folder first");
  const entry = await resolveAssetEntry(currentFolder, base, cfg);
  if (!entry) throw new Error("Not found: " + base + ".(ai|psd)");
  const name = artboardName || base;
  if (HOST === "Photoshop") {
    await createDocPhotoshop(size, name);
    await placeLinkedPhotoshop(entry);
  } else if (HOST === "Illustrator") {
    await createDocIllustrator(size, name);
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

/** Read an artboard's true frame rect (left/top/right/bottom) by layer id. */
async function getArtboardRect(
  abId: number,
): Promise<{ left: number; top: number; right: number; bottom: number } | null> {
  const ps = photoshop;
  try {
    const r = await ps.action.batchPlay(
      [
        {
          _obj: "get",
          _target: [
            { _ref: "property", _property: "artboard" },
            { _ref: "layer", _id: abId },
          ],
        },
      ],
      {},
    );
    const ar = r?.[0]?.artboard?.artboardRect || r?.[0]?.artboardRect;
    if (ar && typeof ar.left === "number") {
      return { left: ar.left, top: ar.top, right: ar.right, bottom: ar.bottom };
    }
  } catch {
    /* ignore */
  }
  return null;
}

/**
 * Create ONE Photoshop document with an artboard per size, laid out in a row.
 * Each artboard is named "{Category} {Size} WxH" with its asset placed (Media
 * Box) and centered. Returns how many were created + any missing base names.
 */
export async function createArtboardsDoc(
  items: { base: string; size: SizeOption; artboardName: string }[],
  cfg: Config,
  tc?: TcWriteOptions,
): Promise<{ created: number; missing: string[] }> {
  if (HOST !== "Photoshop") throw new Error("Multi-artboard is Photoshop-only");
  if (!currentFolder) throw new Error("Connect the source folder first");

  // Resolve every asset up front (file access).
  const resolved: { size: SizeOption; artboardName: string; entry: any }[] = [];
  const missing: string[] = [];
  for (const it of items) {
    const entry = await resolveAssetEntry(currentFolder, it.base, cfg);
    if (entry) resolved.push({ size: it.size, artboardName: it.artboardName, entry });
    else missing.push(it.base);
  }
  if (!resolved.length) throw new Error("No assets found for the selected sizes");

  const ps = photoshop;
  await ps.core.executeAsModal(
    async () => {
      const first = resolved[0];
      await ps.app.documents.add({
        width: first.size.w,
        height: first.size.h,
        resolution: 72,
        name: "Telfaz Sizes",
        fill: "white",
        mode: "RGBColorMode",
      } as any);
      const doc = ps.app.activeDocument;

      const deselect = async () => {
        try {
          await ps.action.batchPlay(
            [{ _obj: "selectNoLayers", _target: [{ _ref: "layer", _enum: "ordinal", _value: "targetEnum" }] }],
            {},
          );
        } catch {
          /* ignore */
        }
      };

      const gap = 120;
      let x = 0;
      // Middle-align: every artboard is centred on one line (the tallest defines
      // it). Create them at that position directly so artboardRect stays accurate.
      const maxH = Math.max(...resolved.map((r) => r.size.h));
      const cy = maxH / 2;
      for (const it of resolved) {
        const w = it.size.w;
        const h = it.size.h;
        const top = cy - h / 2;
        // Empty artboard, already centred vertically (deselect first so it
        // doesn't wrap the previously placed layer).
        await deselect();
        await ps.action.batchPlay(
          [
            {
              _obj: "make",
              _target: [{ _ref: "artboardSection" }],
              artboardRect: { _obj: "classFloatRect", top, left: x, bottom: top + h, right: x + w },
              using: { _obj: "artboardSection" },
            },
          ],
          {},
        );
        let abId = 0;
        try {
          const ab = doc.activeLayers[0];
          ab.name = it.artboardName;
          abId = ab.id;
        } catch {
          /* ignore */
        }
        // Make this the active artboard so the place targets it (no view scroll).
        if (abId) {
          try {
            await ps.action.batchPlay(
              [{ _obj: "select", _target: [{ _ref: "layer", _id: abId }], makeVisible: false }],
              {},
            );
          } catch {
            /* ignore */
          }
        }

        // Place the asset (Media Box). It centers on the active artboard.
        const token = await fs.createSessionToken(it.entry);
        await ps.action.batchPlay(
          [
            {
              _obj: "placeEvent",
              as: {
                _obj: "PDFGenericFormat",
                selection: { _enum: "pdfSelection", _value: "page" },
                pageNumber: 1,
                crop: { _enum: "cropTo", _value: "mediaBox" },
                suppressWarnings: false,
                antiAlias: true,
                clippingPath: true,
              },
              null: { _path: token, _kind: "local" },
              linked: true,
              freeTransformCenterState: { _enum: "quadCenterState", _value: "QCSAverage" },
              offset: {
                _obj: "offset",
                horizontal: { _unit: "pixelsUnit", _value: 0 },
                vertical: { _unit: "pixelsUnit", _value: 0 },
              },
              antiAlias: true,
              _options: { dialogOptions: "dontDisplay" },
            },
          ],
          { synchronousExecution: true } as any,
        );

        // Write the T&C for THIS artboard right now, using its KNOWN rect (the
        // one we just created it at — no stale-bounds problem).
        if (tc) {
          try {
            if (abId) {
              await ps.action.batchPlay(
                [{ _obj: "select", _target: [{ _ref: "layer", _id: abId }], makeVisible: false }],
                {},
              );
            }
            await writeOneTcPS(
              doc,
              { left: x, top, right: x + w, bottom: top + h },
              "T&C " + it.artboardName,
              tc,
            );
          } catch (e) {
            console.warn("T&C for artboard failed", e);
          }
        }
        x += w + gap;
      }
    },
    { commandName: "Create Artboards" },
  );
  return { created: resolved.length, missing };
}

/* ---------------- T&C writer ---------------- */

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

/** Find the first layer whose name starts with `prefix`. */
function findLayerByPrefix(layers: any, prefix: string): any {
  for (const ly of layers) {
    if (typeof ly.name === "string" && ly.name.indexOf(prefix) === 0) return ly;
    if (ly.layers && ly.layers.length) {
      const hit = findLayerByPrefix(ly.layers, prefix);
      if (hit) return hit;
    }
  }
  return null;
}

const isDigit = (ch: string) =>
  (ch >= "0" && ch <= "9") || (ch >= "٠" && ch <= "٩");

const psColor = (hex: string) => {
  const c = hexToRgb(hex);
  return { _obj: "RGBColor", red: c.r, grain: c.g, blue: c.b };
};

/** Font descriptor keys — prefer family + style (resolves like the Character
 *  panel), else an exact PostScript name. */
const psFontKeys = (f: TcFont) => {
  const keys: any = {};
  if (f.psName) keys.fontPostScriptName = f.psName;
  if (f.family) keys.fontName = f.family;
  if (f.style) keys.fontStyleName = f.style;
  return keys;
};

/** Photoshop uses carriage returns for line breaks in text. */
const toPsText = (s: string) => s.replace(/\r\n|\n/g, "\r");

export async function writeTc(opts: TcWriteOptions) {
  if (HOST === "Photoshop") await writeTcPhotoshop(opts);
  else if (HOST === "Illustrator") await writeTcIllustrator(opts);
  else throw new Error("Unsupported host: " + HOST);
}

/**
 * Update ONLY the text of the existing "T&C …" layer (keeps font/size/colour),
 * then re-anchor it so it keeps its safe margins — extra lines grow upward and
 * the bottom margin stays fixed.
 */
export async function updateTcText(
  text: string,
  anchor: string,
  marginXPx: number,
  marginYPx: number,
) {
  if (HOST !== "Photoshop") throw new Error("Update is Photoshop-only for now");
  const ps = photoshop;
  await ps.core.executeAsModal(
    async () => {
      const doc = ps.app.activeDocument;
      const tcLayer = findLayerByPrefix(doc.layers, "T&C ");
      if (!tcLayer) throw new Error('No "T&C …" layer on this document');
      tcLayer.textItem.contents = toPsText(text);

      // Re-anchor (bounds change after the text reflows).
      const b = tcLayer.bounds;
      const mx = marginXPx ?? 70;
      const my = marginYPx ?? 80;
      const lw = b.right - b.left;
      const lh = b.bottom - b.top;
      let ty: number;
      if (anchor.indexOf("bottom") > -1) ty = doc.height - my - b.bottom;
      else if (anchor.indexOf("top") > -1) ty = my - b.top;
      else ty = (doc.height - lh) / 2 - b.top;
      let tx: number;
      if (anchor.indexOf("right") > -1) tx = doc.width - mx - b.right;
      else if (anchor.indexOf("left") > -1) tx = mx - b.left;
      else tx = (doc.width - lw) / 2 - b.left;
      tcLayer.translate(tx, ty);
    },
    { commandName: "Update T&C" },
  );
}

/** Detect the artboards in a document (top-level group layers). */
function getArtboards(doc: any): any[] {
  try {
    return (doc.layers as any[]).filter((l) => l && l.layers !== undefined);
  } catch {
    return [];
  }
}

/** Create + style + direction + position ONE T&C text layer relative to `rect`. */
async function writeOneTcPS(
  doc: any,
  rect: { left: number; top: number; right: number; bottom: number },
  layerName: string,
  opts: TcWriteOptions,
) {
  const ps = photoshop;
  const { dir, anchor, marginXPx, marginYPx, font, latinFont } = opts;
  const text = toPsText(opts.text);
  const resFactor = 72 / ((doc as any).resolution || 72);
  const style = (f: TcFont, withFont: boolean) => {
    const s: any = {
      _obj: "textStyle",
      size: { _unit: "pointsUnit", _value: f.sizePx * resFactor },
      autoLeading: false,
      leading: { _unit: "pointsUnit", _value: (f.leadingPx ?? f.sizePx) * resFactor },
      color: psColor(f.color),
    };
    if (withFont) Object.assign(s, psFontKeys(f));
    return s;
  };

  // 1) Create text (size + colour + leading), named.
  await ps.action.batchPlay(
    [
      {
        _obj: "make",
        _target: [{ _ref: "textLayer" }],
        using: {
          _obj: "textLayer",
          name: layerName,
          textKey: text,
          textStyleRange: [
            { _obj: "textStyleRange", from: 0, to: text.length, textStyle: style(font, false) },
          ],
        },
      },
    ],
    { synchronousExecution: true } as any,
  );
  const layer = doc.activeLayers[0];
  try {
    layer.name = layerName;
  } catch {
    /* ignore */
  }

  // 2) Apply the font (+ reassert size/colour/leading so colour can't reset).
  const applyRun = async (from: number, to: number, f: TcFont) => {
    try {
      await ps.action.batchPlay(
        [
          {
            _obj: "set",
            _target: [{ _ref: "textLayer", _enum: "ordinal", _value: "targetEnum" }],
            to: {
              _obj: "textLayer",
              textStyleRange: [{ _obj: "textStyleRange", from, to, textStyle: style(f, true) }],
            },
          },
        ],
        { synchronousExecution: true } as any,
      );
    } catch (e) {
      console.warn("T&C font not applied:", f.family || f.psName, e);
    }
  };
  await applyRun(0, text.length, font);
  if (latinFont) {
    let i = 0;
    while (i < text.length) {
      const d = isDigit(text[i]);
      let j = i + 1;
      while (j < text.length && isDigit(text[j]) === d) j++;
      if (d) await applyRun(i, j, latinFont);
      i = j;
    }
  }

  // 3) Paragraph direction (recorded override-feature form).
  try {
    await ps.action.batchPlay(
      [
        {
          _obj: "set",
          _target: [
            { _ref: "property", _property: "paragraphStyle" },
            { _ref: "textLayer", _enum: "ordinal", _value: "targetEnum" },
          ],
          to: {
            _obj: "paragraphStyle",
            textOverrideFeatureName: 808466481,
            directionType: {
              _enum: "directionType",
              _value: dir === "rtl" ? "dirRightToLeft" : "dirLeftToRight",
            },
          },
          _options: { dialogOptions: "dontDisplay" },
        },
      ],
      {} as any,
    );
  } catch (e) {
    console.warn("paragraph direction not applied", e);
  }

  // 4) Position within `rect` (the artboard or the whole doc), safe margins.
  const b = layer.bounds;
  const mx = marginXPx ?? 70;
  const my = marginYPx ?? 80;
  const lw = b.right - b.left;
  const lh = b.bottom - b.top;
  let tx: number, ty: number;
  if (anchor.indexOf("bottom") > -1) ty = rect.bottom - my - lh - b.top;
  else if (anchor.indexOf("top") > -1) ty = rect.top + my - b.top;
  else ty = (rect.top + rect.bottom - lh) / 2 - b.top;
  if (anchor.indexOf("right") > -1) tx = rect.right - mx - lw - b.left;
  else if (anchor.indexOf("left") > -1) tx = rect.left + mx - b.left;
  else tx = (rect.left + rect.right - lw) / 2 - b.left;
  try {
    layer.translate(tx, ty);
  } catch {
    /* ignore */
  }
}

async function writeTcPhotoshop(opts: TcWriteOptions) {
  const ps = photoshop;
  await ps.core.executeAsModal(
    async () => {
      const doc = ps.app.activeDocument;
      const artboards = getArtboards(doc);
      if (artboards.length) {
        // A T&C in EVERY artboard, positioned within each artboard's own frame.
        for (const ab of artboards) {
          const real = await getArtboardRect(ab.id);
          const bb = ab.bounds;
          const rect =
            real || { left: bb.left, top: bb.top, right: bb.right, bottom: bb.bottom };
          // Select the artboard so the new text layer belongs to it.
          try {
            await ps.action.batchPlay(
              [{ _obj: "select", _target: [{ _ref: "layer", _id: ab.id }], makeVisible: false }],
              {},
            );
          } catch {
            /* ignore */
          }
          await writeOneTcPS(doc, rect, "T&C " + ab.name, opts);
        }
      } else {
        const rect = { left: 0, top: 0, right: doc.width, bottom: doc.height };
        await writeOneTcPS(doc, rect, "T&C " + (opts.artboardName || doc.name), opts);
      }
    },
    { commandName: "Write T&C" },
  );
}

async function writeTcIllustrator(opts: TcWriteOptions) {
  const ill = illustrator;
  const app = ill.app;
  if (!app.documents.length) throw new Error("Open a document first");
  const doc = app.activeDocument;
  const { text, anchor, marginXPx, marginYPx, font } = opts;
  const tf = doc.textFrames.add();
  tf.contents = text;
  try {
    const nm = font.psName || [font.family, font.style].filter(Boolean).join("-");
    if (nm) tf.textRange.characterAttributes.textFont = app.textFonts.getByName(nm);
  } catch {}
  tf.textRange.characterAttributes.size = font.sizePx;
  const c = hexToRgb(font.color);
  const col = new ill.RGBColor();
  col.red = c.r;
  col.green = c.g;
  col.blue = c.b;
  tf.textRange.characterAttributes.fillColor = col;
  try {
    tf.name = "T&C " + doc.name;
  } catch {
    /* ignore */
  }
  const ab = doc.artboards[doc.artboards.getActiveArtboardIndex()].artboardRect; // [l,t,r,b]
  const mx = marginXPx ?? 70;
  const my = marginYPx ?? 80;
  const w = tf.width;
  const h = tf.height;
  let x: number, y: number;
  if (anchor.indexOf("left") > -1) x = ab[0] + mx;
  else if (anchor.indexOf("right") > -1) x = ab[2] - mx - w;
  else x = (ab[0] + ab[2]) / 2 - w / 2;
  if (anchor.indexOf("bottom") > -1) y = ab[3] + my + h;
  else if (anchor.indexOf("top") > -1) y = ab[1] - my;
  else y = (ab[1] + ab[3]) / 2 + h / 2;
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
