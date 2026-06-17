import React, { useState } from "react";
import type { Config, Ui, SizeOption } from "../config";
import { Accordion } from "../components/Accordion";
import { CheckIcon } from "../Icons";
import type { API } from "../../../../src/api/api";

interface Props {
  cfg: Config;
  api: API;
  onLivePreview: (ui: Ui) => void;
  onSave: (cfg: Config) => void;
  setStatus: (msg: string, kind?: string) => void;
}

const clone = (c: Config): Config => JSON.parse(JSON.stringify(c));

/** Settings = the Sizes editor only. Add / edit / remove sizes. The per-client
 *  naming rules (clients / languages / asset templates) are managed in code and
 *  preserved automatically; here you control the label, value, dimensions and
 *  category. */
export const SettingsView: React.FC<Props> = ({ cfg, onSave, setStatus }) => {
  const [draft, setDraft] = useState<Config>(() => clone(cfg));

  const setSizeField = (i: number, key: keyof SizeOption, value: string) =>
    setDraft((d) => {
      const sizes = d.sizes.map((s, idx) =>
        idx === i
          ? { ...s, [key]: key === "w" || key === "h" ? parseInt(value) || 0 : value }
          : s,
      );
      return { ...d, sizes };
    });

  const addSize = () =>
    setDraft((d) => ({
      ...d,
      sizes: [
        ...d.sizes,
        {
          label: "New size",
          value: "Size" + Date.now(),
          w: 1080,
          h: 1080,
          category: d.categories[0]?.value || "general",
        },
      ],
    }));

  const removeSize = (i: number) =>
    setDraft((d) => ({ ...d, sizes: d.sizes.filter((_, idx) => idx !== i) }));

  const save = () => {
    onSave(draft);
    setStatus("Sizes saved", "ok");
  };

  return (
    <section className="view active">
      <div className="view-title">Sizes</div>

      <Accordion
        title="Sizes"
        footer={
          <button className="btn-ghost wide" onClick={addSize}>
            + Add size
          </button>
        }
      >
        {draft.sizes.map((s, i) => (
          <div className="brand-edit-block" key={i}>
            <div className="row2">
              <div className="field">
                <label className="field-label">Label</label>
                <input
                  className="text-input"
                  value={s.label}
                  onChange={(e) => setSizeField(i, "label", e.target.value)}
                />
              </div>
              <div className="field">
                <label className="field-label">Value</label>
                <input
                  className="text-input"
                  value={s.value}
                  onChange={(e) => setSizeField(i, "value", e.target.value)}
                />
              </div>
            </div>
            <div className="row2">
              <div className="field">
                <label className="field-label">Width (px)</label>
                <input
                  type="number"
                  className="text-input"
                  value={s.w}
                  onChange={(e) => setSizeField(i, "w", e.target.value)}
                />
              </div>
              <div className="field">
                <label className="field-label">Height (px)</label>
                <input
                  type="number"
                  className="text-input"
                  value={s.h}
                  onChange={(e) => setSizeField(i, "h", e.target.value)}
                />
              </div>
            </div>
            <div className="field">
              <label className="field-label">Category</label>
              <select
                className="text-input"
                value={s.category}
                onChange={(e) => setSizeField(i, "category", e.target.value)}
              >
                {draft.categories.map((c) => (
                  <option key={c.value} value={c.value}>
                    {c.label}
                  </option>
                ))}
              </select>
            </div>
            {(s.clients || s.asset) && (
              <div className="folder-hint">
                Managed size{s.clients ? ` · clients: ${s.clients.join(", ")}` : ""}
                {s.asset ? " · custom file" : ""}
              </div>
            )}
            <button className="btn-ghost wide" onClick={() => removeSize(i)}>
              Remove size
            </button>
          </div>
        ))}
      </Accordion>

      <button className="btn-primary" onClick={save}>
        <span className="btn-ico">
          <CheckIcon />
        </span>
        <span className="btn-text">Save Sizes</span>
      </button>
    </section>
  );
};
