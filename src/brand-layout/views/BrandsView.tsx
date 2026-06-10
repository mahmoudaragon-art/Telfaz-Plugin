import React from "react";
import type { Config, Selection } from "../config";
import { Dropdown } from "../components/Dropdown";
import { ExternalIcon, FontIcon, PaletteIcon } from "../Icons";

interface Props {
  cfg: Config;
  selection: Selection;
  onSelect: (value: string) => void;
  onOpenGuidelines: () => void;
  onImportColors: () => void;
  onOpenFonts: () => void;
}

export const BrandsView: React.FC<Props> = ({
  cfg,
  selection,
  onSelect,
  onOpenGuidelines,
  onImportColors,
  onOpenFonts,
}) => {
  const brand = cfg.brands.find((b) => b.id === selection.brand);

  return (
    <section className="view active">
      <div className="view-title">Brand Guidelines</div>
      <div className="field">
        <label className="field-label">Brand</label>
        <Dropdown
          items={cfg.brands.map((b) => ({ label: b.name, value: b.id }))}
          value={selection.brand}
          placeholder="Select brand"
          onChange={onSelect}
        />
      </div>

      {brand && (
        <div className="brand-panel">
          <div className="swatch-row">
            {(brand.colors || []).map((hex, i) => (
              <div key={hex + i} className="swatch" style={{ background: hex }} title={hex} />
            ))}
          </div>
          <button
            className="btn-primary"
            style={{ opacity: brand.guidelinesUrl ? 1 : 0.5 }}
            onClick={onOpenGuidelines}
          >
            <span className="btn-ico">
              <ExternalIcon />
            </span>
            <span className="btn-text">Open Full Guidelines</span>
          </button>
          <button className="btn-primary" onClick={onImportColors}>
            <span className="btn-ico">
              <PaletteIcon />
            </span>
            <span className="btn-text">Import Colors</span>
          </button>
          <button
            className="btn-ghost wide"
            style={{ opacity: brand.fontsUrl ? 1 : 0.5 }}
            onClick={onOpenFonts}
          >
            <FontIcon />
            Install / Get Fonts
          </button>
        </div>
      )}
    </section>
  );
};
