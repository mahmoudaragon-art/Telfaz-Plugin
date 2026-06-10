import React, { useEffect, useRef, useState } from "react";
import "./styles.css";

import {
  Config,
  Selection,
  Ui,
  buildBaseName,
  loadConfig,
  loadSelection,
  mergeOverrides,
  persistSelection,
  saveOverrides,
} from "./config";
import {
  HOST,
  VerifyResult,
  connectFolder,
  folderLabel,
  importColors,
  openExternal,
  placeAsset,
  restoreFolder,
  verifyAssets,
  writeTc,
} from "./host";
import { LogoMark } from "./Icons";
import { PlaceView } from "./views/PlaceView";
import { BrandsView } from "./views/BrandsView";
import { SettingsView } from "./views/SettingsView";
import { AboutView } from "./views/AboutView";
import { TabAbout, TabBrands, TabPlace, TabSettings } from "./Icons";

type View = "place" | "brands" | "settings" | "about";

export const BrandLayoutApp: React.FC = () => {
  const [cfg, setCfg] = useState<Config>(() => loadConfig());
  const [view, setView] = useState<View>("place");
  const [selection, setSelection] = useState<Selection>(() => {
    const s = loadSelection();
    const init: Selection = {
      client: s.client ?? null,
      size: s.size ?? null,
      lang: s.lang ?? cfg.languages[0]?.value ?? null,
      tc: s.tc ?? cfg.tc[0]?.value ?? null,
      brand: s.brand ?? null,
    };
    return init;
  });
  const [folder, setFolder] = useState<any | null>(null);
  const [folderPath, setFolderPath] = useState<string | null>(null);
  const [verify, setVerify] = useState<VerifyResult | null>(null);
  const [status, setStatusState] = useState<{ msg: string; kind: string }>({ msg: "", kind: "" });
  // Live appearance preview (uncommitted Settings edits); falls back to cfg.ui
  const [livePreviewUi, setLivePreviewUi] = useState<Ui | null>(null);

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

  /* ---- restore connected folder on boot ---- */
  useEffect(() => {
    (async () => {
      try {
        const f = await restoreFolder();
        if (f) {
          setFolder(f);
          setFolderPath(folderLabel(f));
        }
      } catch {
        /* ignore */
      }
    })();
  }, []);

  /* ---- selection ---- */
  const onSelect = (key: keyof Selection, value: string) => {
    setSelection((prev) => {
      const next = { ...prev, [key]: value };
      persistSelection(next);
      return next;
    });
  };
  const onSelectBrand = (value: string) => onSelect("brand", value);

  /* ---- place ---- */
  const handleConnect = async () => {
    try {
      const f = await connectFolder();
      if (!f) return;
      setFolder(f);
      setFolderPath(folderLabel(f));
      setStatus("Folder connected", "ok");
    } catch (e: any) {
      setStatus("Could not connect: " + e.message, "err");
    }
  };

  const handlePlace = async () => {
    const base = buildBaseName(cfg, selection);
    if (!base) return setStatus("Pick all options first", "err");
    if (!folder) return setStatus("Connect the source folder first", "err");
    setStatus("Placing " + base + " …", "busy");
    try {
      const name = await placeAsset(folder, base, cfg);
      setStatus("Placed (linked): " + name, "ok");
    } catch (e: any) {
      setStatus("Place failed: " + e.message, "err");
    }
  };

  const handleVerify = async () => {
    if (!folder) return setStatus("Connect the folder first", "err");
    setStatus("Scanning folder…", "busy");
    try {
      const res = await verifyAssets(folder, cfg);
      setVerify(res);
      setStatus(res.missing.length ? res.missing.length + " missing" : "All present", res.missing.length ? "err" : "ok");
    } catch (e: any) {
      setStatus("Verify failed: " + e.message, "err");
    }
  };

  const handleWriteTc = async (text: string) => {
    const t = text.trim();
    if (!t) return setStatus("T&C text is empty", "err");
    setStatus("Writing T&C …", "busy");
    try {
      await writeTc(t, cfg.tcStyle, selection.lang || "EN");
      setStatus("T&C written", "ok");
    } catch (e: any) {
      setStatus("T&C failed: " + e.message, "err");
    }
  };

  /* ---- brands ---- */
  const currentBrand = () => cfg.brands.find((b) => b.id === selection.brand);
  const handleOpenGuidelines = async () => {
    const b = currentBrand();
    if (!b || !b.guidelinesUrl) return setStatus("No guidelines link set (add in Settings)", "err");
    await openExternal(b.guidelinesUrl);
    setStatus("Opened guidelines", "ok");
  };
  const handleOpenFonts = async () => {
    const b = currentBrand();
    if (!b || !b.fontsUrl) return setStatus("No fonts link set (add in Settings)", "err");
    await openExternal(b.fontsUrl);
    setStatus("Opened fonts link", "ok");
  };
  const handleImportColors = async () => {
    const b = currentBrand();
    if (!b || !(b.colors || []).length) return setStatus("No colors set for this brand", "err");
    setStatus("Importing colors …", "busy");
    try {
      await importColors(b);
      setStatus("Imported " + b.colors.length + " colors", "ok");
    } catch (e: any) {
      setStatus("Import failed: " + e.message, "err");
    }
  };

  /* ---- settings save ---- */
  const handleSaveSettings = (next: Config) => {
    // Persist editable parts as overrides, then re-merge against the base.
    saveOverrides({
      ui: next.ui,
      tcText: next.tcText,
      tcStyle: next.tcStyle,
      brands: next.brands,
      about: next.about,
    });
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
          <div className="logo-mark" style={{ display: themeUi.logo ? "none" : "flex" }}>
            <LogoMark />
          </div>
          {themeUi.logo && <img className="logo-img" src={themeUi.logo} alt="" />}
          <div className="brand-text">
            <span className="brand-title">Brand Layout</span>
            <span className="brand-sub">Linked asset manager</span>
          </div>
        </div>
        <div className="host-badge">{HOST}</div>
      </header>

      {/* Views */}
      <main className="views">
        {view === "place" && (
          <PlaceView
            cfg={cfg}
            selection={selection}
            onSelect={onSelect}
            folderPath={folderPath}
            onConnect={handleConnect}
            onVerify={handleVerify}
            verify={verify}
            onCloseVerify={() => setVerify(null)}
            onPlace={handlePlace}
            onWriteTc={handleWriteTc}
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
          />
        )}
        {view === "settings" && (
          <SettingsView
            key={JSON.stringify(cfg)}
            cfg={cfg}
            onLivePreview={setLivePreviewUi}
            onSave={handleSaveSettings}
            setStatus={setStatus}
          />
        )}
        {view === "about" && <AboutView cfg={cfg} />}
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
    </div>
  );
};
