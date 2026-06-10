/* ============================================================
   Brand Layout — host (Photoshop / Illustrator) operations
   Ported verbatim from the original main.js logic.
   ============================================================ */

import { uxp, photoshop, illustrator } from "../globals";
import type { Brand, Config, TcStyle } from "./config";

const fs = uxp.storage.localFileSystem;
const shell = uxp.shell;

export const HOST = uxp.host.name; // "Photoshop" | "Illustrator"

export function getPluginVersion(): string {
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

export async function connectFolder(): Promise<any | null> {
  const folder = await fs.getFolder({});
  if (!folder) return null;
  localStorage.setItem("assetsFolderToken", await fs.createPersistentToken(folder));
  return folder;
}

export async function restoreFolder(): Promise<any | null> {
  const token = localStorage.getItem("assetsFolderToken");
  if (!token) return null;
  try {
    return await fs.getEntryForPersistentToken(token);
  } catch {
    localStorage.removeItem("assetsFolderToken");
    return null;
  }
}

export function folderLabel(folder: any): string {
  return folder.nativePath || folder.name;
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
export async function placeAsset(folder: any, base: string, cfg: Config): Promise<string> {
  const entry = await resolveAssetEntry(folder, base, cfg);
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

/* ---------------- T&C writer ---------------- */

export async function writeTc(text: string, style: TcStyle, lang: string) {
  const font = lang === "AR" ? style.fontAR : style.fontEN;
  if (HOST === "Photoshop") await writeTcPhotoshop(text, font, style, lang);
  else if (HOST === "Illustrator") await writeTcIllustrator(text, font, style, lang);
  else throw new Error("Unsupported host: " + HOST);
}

async function writeTcPhotoshop(text: string, font: string, st: TcStyle, lang: string) {
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
                  _value: lang === "AR" ? "dirRightToLeft" : "dirLeftToRight",
                },
              },
            },
          },
        ],
        { synchronousExecution: true } as any,
      );

      // Position to anchor
      const doc = ps.app.activeDocument;
      const layer = doc.activeLayers[0];
      const b = layer.bounds; // left, top, right, bottom (px)
      const margin = st.marginPt * ((doc as any).resolution / 72);
      const lw = b.right - b.left,
        lh = b.bottom - b.top;
      let tx: number, ty: number;
      const anchor = st.anchor;
      if (anchor.indexOf("bottom") === 0) ty = doc.height - margin - lh - b.top;
      else ty = margin - b.top;
      if (anchor.indexOf("left") > -1) tx = margin - b.left;
      else if (anchor.indexOf("right") > -1) tx = doc.width - margin - lw - b.left;
      else tx = (doc.width - lw) / 2 - b.left;
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
    },
    { commandName: "Write T&C" },
  );
}

async function writeTcIllustrator(text: string, font: string, st: TcStyle, _lang: string) {
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
  // Anchor on active artboard
  const ab = doc.artboards[doc.artboards.getActiveArtboardIndex()].artboardRect; // [l,t,r,b]
  const m = st.marginPt;
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

/* ---------------- verify assets ---------------- */

export interface VerifyResult {
  present: number;
  total: number;
  missing: string[];
}

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

export async function verifyAssets(folder: any, cfg: Config): Promise<VerifyResult> {
  const entries = await folder.getEntries();
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
