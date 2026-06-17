import React, { useState } from "react";
import type { Config, Ui, SizeOption } from "../config";
import { baseConfig } from "../config";
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
const LANGS: ("AR" | "EN")[] = ["AR", "EN"];

/**
 * Settings = the size manager. For each size you set: label, dimensions,
 * category, which client(s) it belongs to, language(s), the exact filename the
 * plugin searches for (with {client}/{lang}/{tc} placeholders), and the artboard
 * name. A size limited to certain clients only shows for those clients.
 */
export const SettingsView: React.FC<Props> = ({ cfg, onSave, setStatus }) => {
  const [draft, setDraft] = useState<Config>(() => clone(cfg));

  const patchSize = (i: number, patch: Partial<SizeOption>) =>
    setDraft((d) => ({
      ...d,
      sizes: d.sizes.map((s, idx) => (idx === i ? { ...s, ...patch } : s)),
    }));

  // String fields where empty means "unset" (asset / artboardName).
  const setOpt = (i: number, key: "asset" | "artboardName", value: string) =>
    patchSize(i, { [key]: value.trim() ? value : undefined } as Partial<SizeOption>);

  const toggleInList = <T,>(list: T[] | undefined, item: T): T[] | undefined => {
    const cur = list || [];
    const next = cur.includes(item) ? cur.filter((x) => x !== item) : [...cur, item];
    return next.length ? next : undefined;
  };

  const addSize = () =>
    setDraft((d) => ({
      ...d,
      sizes: [
        ...d.sizes,
        { label: "New size", value: "Size" + Date.now(), w: 1080, h: 1080, category: d.categories[0]?.value || "general" },
      ],
    }));

  const removeSize = (i: number) =>
    setDraft((d) => ({ ...d, sizes: d.sizes.filter((_, idx) => idx !== i) }));

  const resetDefaults = () => {
    const b = clone(baseConfig);
    setDraft((d) => ({ ...d, sizes: b.sizes, categories: b.categories }));
    setStatus("Reset to defaults — Save to keep", "ok");
  };

  const save = () => {
    onSave(draft);
    setStatus("Sizes saved", "ok");
  };

  return (
    <section className="view active">
      <div className="view-title">Sizes</div>
      <div className="folder-hint" style={{ marginBottom: 10 }}>
        Set the filename the plugin looks for, the artboard name, dimensions and
        which clients each size belongs to. Use {"{client}"} {"{lang}"} {"{tc}"} in
        the filename, e.g. <b>NEO_Square_{"{lang}"}_{"{tc}"}.ai</b> or
        <b> Social Media {"{lang}"}Instagram {"{lang}"}.pdf</b>.
      </div>

      <Accordion
        title={`Sizes (${draft.sizes.length})`}
        footer={
          <div className="row2">
            <button className="btn-ghost wide" onClick={addSize}>
              + Add size
            </button>
            <button className="btn-ghost wide" onClick={resetDefaults}>
              Reset to defaults
            </button>
          </div>
        }
      >
        {draft.sizes.map((s, i) => (
          <div className="brand-edit-block" key={i}>
            <div className="row2">
              <div className="field">
                <label className="field-label">Label</label>
                <input className="text-input" value={s.label} onChange={(e) => patchSize(i, { label: e.target.value })} />
              </div>
              <div className="field">
                <label className="field-label">Value (id)</label>
                <input className="text-input" value={s.value} onChange={(e) => patchSize(i, { value: e.target.value })} />
              </div>
            </div>
            <div className="row2">
              <div className="field">
                <label className="field-label">Width (px)</label>
                <input type="number" className="text-input" value={s.w} onChange={(e) => patchSize(i, { w: parseInt(e.target.value) || 0 })} />
              </div>
              <div className="field">
                <label className="field-label">Height (px)</label>
                <input type="number" className="text-input" value={s.h} onChange={(e) => patchSize(i, { h: parseInt(e.target.value) || 0 })} />
              </div>
            </div>
            <div className="field">
              <label className="field-label">Category</label>
              <select className="text-input" value={s.category} onChange={(e) => patchSize(i, { category: e.target.value })}>
                {draft.categories.map((c) => (
                  <option key={c.value} value={c.value}>
                    {c.label}
                  </option>
                ))}
              </select>
            </div>
            <div className="field">
              <label className="field-label">Clients (none = all)</label>
              <div className="chip-row">
                {cfg.clients.map((cl) => (
                  <button
                    key={cl}
                    className={"chip" + (s.clients?.includes(cl) ? " on" : "")}
                    onClick={() => patchSize(i, { clients: toggleInList(s.clients, cl) })}
                  >
                    {cl}
                  </button>
                ))}
              </div>
            </div>
            <div className="field">
              <label className="field-label">Languages (none = all)</label>
              <div className="chip-row">
                {LANGS.map((lg) => (
                  <button
                    key={lg}
                    className={"chip" + (s.langs?.includes(lg) ? " on" : "")}
                    onClick={() => patchSize(i, { langs: toggleInList(s.langs, lg) })}
                  >
                    {lg}
                  </button>
                ))}
              </div>
            </div>
            <div className="field">
              <label className="field-label">Filename to search (optional)</label>
              <input
                className="text-input"
                placeholder="empty = {client}_{size}_{lang}_{tc}"
                value={s.asset || ""}
                onChange={(e) => setOpt(i, "asset", e.target.value)}
              />
            </div>
            <div className="field">
              <label className="field-label">Artboard name (optional)</label>
              <input
                className="text-input"
                placeholder="empty = auto"
                value={s.artboardName || ""}
                onChange={(e) => setOpt(i, "artboardName", e.target.value)}
              />
            </div>
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
