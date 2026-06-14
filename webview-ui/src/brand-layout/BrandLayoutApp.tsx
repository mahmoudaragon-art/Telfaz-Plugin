import React, { useEffect, useRef, useState } from "react";
import "./styles.css";

import {
  Config,
  Selection,
  SizeOption,
  Ui,
  VerifyResult,
  TcFont,
  TcWriteOptions,
  baseConfig,
  buildBaseName,
  buildBaseNameForSize,
  mergeOverrides,
  parseJSON,
} from "./config";
import type { API } from "../../../src/api/api";
import { LogoMark } from "./Icons";
import { PlaceView } from "./views/PlaceView";
import { AdaptGuideModal, type GuideTargets } from "./views/AdaptGuideModal";
import { BrandsView } from "./views/BrandsView";
import { SettingsView } from "./views/SettingsView";
import { AboutView } from "./views/AboutView";
import { TabAbout, TabBrands, TabPlace, TabSettings } from "./Icons";

type View = "place" | "brands" | "settings" | "about";

/** "1.0.0" → "V1.0" (major.minor). */
const formatVersion = (v: string): string => {
  const [maj = "1", min = "0"] = (v || "").split(".");
  return `V${maj}.${min}`;
};

export const BrandLayoutApp: React.FC<{ api: API }> = ({ api }) => {
  const [cfg, setCfg] = useState<Config>(() => mergeOverrides(baseConfig, {}));
  const [hostName, setHostName] = useState<string>("");
  const [version, setVersion] = useState<string>("");
  const [view, setView] = useState<View>("place");
  const [selection, setSelection] = useState<Selection>(() => ({
    client: null,
    size: null,
    lang: baseConfig.languages[0]?.value ?? null,
    tc: baseConfig.tc[0]?.value ?? null,
    brand: null,
  }));
  // The actual UXP folder lives on the host; the webview only tracks whether
  // one is connected and its display path.
  const [connected, setConnected] = useState<boolean>(false);
  const [folderPath, setFolderPath] = useState<string | null>(null);
  const [verify, setVerify] = useState<VerifyResult | null>(null);
  const [status, setStatusState] = useState<{ msg: string; kind: string }>({ msg: "", kind: "" });
  // Live appearance preview (uncommitted Settings edits); falls back to cfg.ui
  const [livePreviewUi, setLivePreviewUi] = useState<Ui | null>(null);
  const [adaptItems, setAdaptItems] = useState<{ size: SizeOption; base: string }[] | null>(null);

  const statusTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const setStatus = (msg: string, kind = "") => {
    setStatusState({ msg, kind });
    if (statusTimer.current) clearTimeout(statusTimer.current);
    if (kind === "ok") statusTimer.current = setTimeout(() => setStatusState({ msg: "", kind: "" }), 4000);
  };

  /* ---- theme application (accent vars + logo) ---- */
  const themeUi = livePreviewUi || cfg.ui;
  useEffect(() => {
    const r = document.documentElement.style;
    r.setProperty("--orange", themeUi.accent);
    r.setProperty("--orange-2", themeUi.accent2);
  }, [themeUi.accent, themeUi.accent2]);

  /* ---- boot: host name + version + hydrate persisted state + folder ---- */
  useEffect(() => {
    (async () => {
      try {
        setHostName(await api.getHostName());
      } catch {
        /* ignore */
      }
      try {
        setVersion(formatVersion(await api.getPluginVersion()));
      } catch {
        /* ignore */
      }
      // Persisted config/selection live in the host kv store (the webview's own
      // localStorage is unreliable in UXP).
      try {
        const ov = parseJSON<Partial<Config>>(await api.kvGet("overrides"), {});
        if (ov && Object.keys(ov).length) {
          const merged = mergeOverrides(baseConfig, ov);
          // A saved config REPLACES the sizes/categories lists, so newly-added
          // defaults (e.g. the Google Ads sizes) wouldn't appear. Re-add any base
          // size/category whose value isn't already present (keeps user edits).
          const haveSizes = new Set(merged.sizes.map((s) => s.value));
          for (const bs of baseConfig.sizes) if (!haveSizes.has(bs.value)) merged.sizes.push(bs);
          const haveCats = new Set(merged.categories.map((c) => c.value));
          for (const bc of baseConfig.categories) if (!haveCats.has(bc.value)) merged.categories.push(bc);
          setCfg(merged);
        }
      } catch {
        /* ignore */
      }
      try {
        const s = parseJSON<Partial<Selection>>(await api.kvGet("selection"), {});
        if (s && Object.keys(s).length) setSelection((prev) => ({ ...prev, ...s }));
      } catch {
        /* ignore */
      }
      try {
        const f = await api.restoreFolder();
        if (f) {
          setConnected(true);
          setFolderPath(f.path);
        }
      } catch {
        /* ignore */
      }
    })();
  }, []);

  /* ---- selection (persist through host, never inside the state updater) ---- */
  const onSelect = (key: keyof Selection, value: string) => {
    const next = { ...selection, [key]: value };
    setSelection(next);
    api.kvSet("selection", JSON.stringify(next)).catch(() => {});
  };
  const onSelectBrand = (value: string) => onSelect("brand", value);

  /* ---- place ---- */
  const handleConnect = async () => {
    try {
      const f = await api.connectFolder();
      if (!f) return;
      setConnected(true);
      setFolderPath(f.path);
      setStatus("Folder connected", "ok");
    } catch (e: any) {
      setStatus("Could not connect: " + e.message, "err");
    }
  };

  const handlePlace = async () => {
    const base = buildBaseName(cfg, selection);
    if (!base) return setStatus("Pick all options first", "err");
    if (!connected) return setStatus("Connect the source folder first", "err");
    setStatus("Placing " + base + " …", "busy");
    try {
      const name = await api.placeAsset(base, cfg);
      setStatus("Placed (linked): " + name, "ok");
    } catch (e: any) {
      setStatus("Place failed: " + e.message, "err");
    }
  };

  /** Create artboards for the selected size(s) — Photoshop: all in one PSD. */
  const handleCreateArtboards = async (sizeValues: string[]) => {
    if (!connected) return setStatus("Connect the source folder first", "err");
    if (!selection.client || !selection.lang || !selection.tc)
      return setStatus("Pick client, language and T&C first", "err");
    if (!sizeValues.length) return setStatus("Select at least one size", "err");

    type Item = { base: string; size: SizeOption; artboardName: string };
    const items: Item[] = [];
    for (const sv of sizeValues) {
      const size = cfg.sizes.find((s) => s.value === sv);
      const base = buildBaseNameForSize(cfg, selection, sv);
      if (!size || !base) continue;
      const catLabel = cfg.categories.find((c) => c.value === size.category)?.label || "";
      items.push({ base, size, artboardName: `${catLabel} ${size.label} ${size.w}X${size.h}`.trim() });
    }
    if (!items.length) return setStatus("No valid sizes selected", "err");

    setStatus(`Creating ${items.length} artboard${items.length === 1 ? "" : "s"} …`, "busy");
    try {
      if (hostName.toLowerCase().startsWith("photoshop")) {
        // One PSD, an artboard per size.
        const res = await api.createArtboardsDoc(items, cfg);
        setStatus(
          res.missing.length
            ? `Created ${res.created}, missing: ${res.missing.join(", ")}`
            : `Created ${res.created} artboard${res.created === 1 ? "" : "s"} in one PSD`,
          res.missing.length ? "err" : "ok",
        );
      } else {
        // Illustrator (or other): one doc per size.
        let ok = 0;
        const fails: string[] = [];
        for (const it of items) {
          try {
            await api.createArtboardAndPlace(it.base, it.size, cfg, it.artboardName);
            ok++;
          } catch (e: any) {
            fails.push(`${it.size.value}: ${e.message}`);
          }
        }
        setStatus(fails.length ? `Created ${ok}, failed: ${fails.join(" · ")}` : `Created ${ok}`, fails.length ? "err" : "ok");
      }
    } catch (e: any) {
      setStatus("Create failed: " + e.message, "err");
    }
  };

  // Adapt the OPEN master design (Visual/Text groups + focal/safe guides) to the
  // selected sizes — one framed artboard per size beside the master — and place
  // the brand asset (resolved from the folder by Client/Lang/T&C) on top of each.
  const handleAdaptDesign = async (sizeValues: string[]) => {
    if (!hostName.toLowerCase().startsWith("photoshop"))
      return setStatus("Adapt is Photoshop-only", "err");
    if (!sizeValues.length) return setStatus("Select at least one size", "err");
    if (!connected) return setStatus("Connect the source folder first", "err");
    if (!selection.client || !selection.lang || !selection.tc)
      return setStatus("Pick client, language and T&C first", "err");

    const items: { size: SizeOption; base: string }[] = [];
    for (const sv of sizeValues) {
      const size = cfg.sizes.find((s) => s.value === sv);
      const base = buildBaseNameForSize(cfg, selection, sv);
      if (size && base) items.push({ size, base });
    }
    if (!items.length) return setStatus("No valid sizes selected", "err");

    // Open the guide popup; the actual adaptation runs from there with the
    // per-size focal/safe positions the user sets.
    setAdaptItems(items);
  };

  const runAdapt = async (targets: GuideTargets) => {
    const items = adaptItems;
    setAdaptItems(null);
    if (!items) return;
    setStatus(`Adapting to ${items.length} size${items.length === 1 ? "" : "s"} …`, "busy");
    try {
      const res = await api.adaptDesignToSizes(items, cfg, targets);
      const parts = [`Adapted ${res.created}`];
      if (res.placedMissing.length) parts.push(`no asset: ${res.placedMissing.join(", ")}`);
      if (res.failed.length) parts.push(`failed: ${res.failed.join(" · ")}`);
      setStatus(parts.join(" · "), res.failed.length || res.placedMissing.length ? "err" : "ok");
    } catch (e: any) {
      setStatus("Adapt failed: " + (e?.message || e), "err");
    }
  };

  // One-click: 3000×3000 canvas + the three named guide rects for adaptation.
  const handleAddGuides = async () => {
    if (!hostName.toLowerCase().startsWith("photoshop"))
      return setStatus("Guides are Photoshop-only", "err");
    setStatus("Adding adapt guides …", "busy");
    try {
      await api.addAdaptGuides();
      setStatus("Added 3000×3000 canvas + guides — group them into Visual/Text", "ok");
    } catch (e: any) {
      setStatus("Guides failed: " + (e?.message || e), "err");
    }
  };

  const handleVerify = async () => {
    if (!connected) return setStatus("Connect the folder first", "err");
    setStatus("Scanning folder…", "busy");
    try {
      const res = await api.verifyAssets(cfg);
      setVerify(res);
      setStatus(res.missing.length ? res.missing.length + " missing" : "All present", res.missing.length ? "err" : "ok");
    } catch (e: any) {
      setStatus("Verify failed: " + e.message, "err");
    }
  };

  const handleWriteTc = async (text: string, dir: "rtl" | "ltr", anchor: string) => {
    const t = text.trim();
    if (!t) return setStatus("T&C text is empty", "err");
    setStatus("Writing T&C …", "busy");
    try {
      const client = selection.client || "";
      const isAr = selection.lang === "AR";
      const cs = cfg.tcClientStyles?.[client];
      // Per-client font for this language, else fall back to the global tcStyle.
      const fallback: TcFont = {
        family: isAr ? cfg.tcStyle.fontAR : cfg.tcStyle.fontEN,
        sizePx: cfg.tcStyle.sizePt,
        color: cfg.tcStyle.color,
      };
      const font = cs ? (isAr ? cs.ar : cs.en) : fallback;
      const latinFont = isAr ? cs?.latin : undefined;
      const layout = (client && cfg.tcLayout?.[client]) || undefined;
      // Name the T&C layer after the artboard (so it's not "T&C Untitled-1").
      const selSize = cfg.sizes.find((s) => s.value === selection.size);
      const catLabel = selSize
        ? cfg.categories.find((c) => c.value === selSize.category)?.label || ""
        : "";
      const artboardName = selSize
        ? `${catLabel} ${selSize.label} ${selSize.w}X${selSize.h}`.trim()
        : undefined;
      const opts: TcWriteOptions = {
        text: t,
        dir,
        anchor,
        marginXPx: cfg.tcStyle.safeMarginXPx,
        marginYPx: cfg.tcStyle.safeMarginYPx,
        marginYByDim: cfg.tcStyle.marginYByDim,
        artboardName,
        font,
        latinFont,
        layout,
      };
      await api.writeTc(opts);
      setStatus("T&C written", "ok");
    } catch (e: any) {
      setStatus("T&C failed: " + e.message, "err");
    }
  };

  const handleUpdateTc = async (text: string, anchor: string) => {
    const t = text.trim();
    if (!t) return setStatus("T&C text is empty", "err");
    setStatus("Updating T&C …", "busy");
    try {
      // Same per-client fonts as Write, so digits get the latin font on update too.
      const client = selection.client || "";
      const isAr = selection.lang === "AR";
      const cs = cfg.tcClientStyles?.[client];
      const fallback: TcFont = {
        family: isAr ? cfg.tcStyle.fontAR : cfg.tcStyle.fontEN,
        sizePx: cfg.tcStyle.sizePt,
        color: cfg.tcStyle.color,
      };
      const font = cs ? (isAr ? cs.ar : cs.en) : fallback;
      const latinFont = isAr ? cs?.latin : undefined;
      await api.updateTcText({
        text: t,
        dir: isAr ? "rtl" : "ltr",
        anchor,
        marginXPx: cfg.tcStyle.safeMarginXPx,
        marginYPx: cfg.tcStyle.safeMarginYPx,
        marginYByDim: cfg.tcStyle.marginYByDim,
        font,
        latinFont,
      });
      setStatus("T&C text updated", "ok");
    } catch (e: any) {
      setStatus("Update failed: " + e.message, "err");
    }
  };

  /* ---- brands ---- */
  const currentBrand = () => cfg.brands.find((b) => b.id === selection.brand);
  const handleOpenGuidelines = async () => {
    const b = currentBrand();
    if (!b || !b.guidelinesUrl) return setStatus("No guidelines link set (add in Settings)", "err");
    await api.openExternal(b.guidelinesUrl);
    setStatus("Opened guidelines", "ok");
  };
  const handleOpenFonts = async () => {
    const b = currentBrand();
    if (!b || !b.fontsUrl) return setStatus("No fonts link set (add in Settings)", "err");
    await api.openExternal(b.fontsUrl);
    setStatus("Opened fonts link", "ok");
  };
  const handleImportColors = async () => {
    const b = currentBrand();
    if (!b || !(b.colors || []).length) return setStatus("No colors set for this brand", "err");
    setStatus("Importing colors …", "busy");
    try {
      await api.importColors(b);
      setStatus("Imported " + b.colors.length + " colors", "ok");
    } catch (e: any) {
      setStatus("Import failed: " + e.message, "err");
    }
  };
  const handlePickColor = async (hex: string) => {
    try {
      await api.setForegroundColor(hex);
      setStatus("Foreground set " + hex, "ok");
    } catch (e: any) {
      setStatus("Color failed: " + e.message, "err");
    }
  };

  const openSite = () => api.openExternal("https://www.telfaz.com").catch(() => {});

  /* ---- settings save (persist through host) ---- */
  const handleSaveSettings = (next: Config) => {
    const overrides: Partial<Config> = {
      ui: next.ui,
      tcText: next.tcText,
      tcStyle: next.tcStyle,
      brands: next.brands,
      about: next.about,
      categories: next.categories,
      sizes: next.sizes,
    };
    api.kvSet("overrides", JSON.stringify(overrides)).catch(() => {});
    setCfg(mergeOverrides(next, {}));
    setLivePreviewUi(null);
  };

  const tabs: { id: View; label: string; icon: React.ReactNode }[] = [
    { id: "place", label: "Place", icon: <TabPlace /> },
    { id: "brands", label: "Brands", icon: <TabBrands /> },
    { id: "settings", label: "Settings", icon: <TabSettings /> },
    { id: "about", label: "About", icon: <TabAbout /> },
  ];

  return (
    <div className="app">
      {/* Header */}
      <header className="header">
        <div className="brand">
          <button className="brand-logo-btn" onClick={openSite} title="telfaz.com">
            <div className="logo-mark" style={{ display: themeUi.logo ? "none" : "flex" }}>
              <LogoMark />
            </div>
            {themeUi.logo && <img className="logo-img" src={themeUi.logo} alt="" />}
          </button>
          <div className="brand-text">
            <span className="brand-title-row">
              <span className="brand-title">Brand Layout</span>
              {version && <span className="brand-ver">{version}</span>}
            </span>
            <span className="brand-sub">Linked asset manager</span>
          </div>
        </div>
        <div className="host-badge">{hostName}</div>
      </header>

      {/* Views */}
      <main className="views">
        {view === "place" && (
          <PlaceView
            cfg={cfg}
            api={api}
            selection={selection}
            onSelect={onSelect}
            folderPath={folderPath}
            onConnect={handleConnect}
            onVerify={handleVerify}
            verify={verify}
            onCloseVerify={() => setVerify(null)}
            onPlace={handlePlace}
            onCreateArtboards={handleCreateArtboards}
            onAdaptDesign={handleAdaptDesign}
            onAddGuides={handleAddGuides}
            onWriteTc={handleWriteTc}
            onUpdateTc={handleUpdateTc}
          />
        )}
        {view === "brands" && (
          <BrandsView
            cfg={cfg}
            selection={selection}
            onSelect={onSelectBrand}
            onOpenGuidelines={handleOpenGuidelines}
            onImportColors={handleImportColors}
            onOpenFonts={handleOpenFonts}
            onPickColor={handlePickColor}
          />
        )}
        {view === "settings" && (
          <SettingsView
            key={JSON.stringify(cfg)}
            cfg={cfg}
            api={api}
            onLivePreview={setLivePreviewUi}
            onSave={handleSaveSettings}
            setStatus={setStatus}
          />
        )}
        {view === "about" && <AboutView cfg={cfg} api={api} />}
      </main>

      {/* Status bar */}
      <div className={"status" + (status.kind ? " " + status.kind : "")}>{status.msg}</div>

      {/* Bottom nav */}
      <nav className="tabbar">
        {tabs.map((t) => (
          <button
            key={t.id}
            className={"tab" + (view === t.id ? " active" : "")}
            onClick={() => setView(t.id)}
          >
            {t.icon}
            <span>{t.label}</span>
          </button>
        ))}
      </nav>

      {adaptItems && (
        <AdaptGuideModal
          sizes={adaptItems.map((i) => i.size)}
          onRun={runAdapt}
          onCancel={() => setAdaptItems(null)}
        />
      )}
    </div>
  );
};
