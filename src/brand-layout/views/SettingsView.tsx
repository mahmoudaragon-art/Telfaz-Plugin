import React, { useState } from "react";
import type { Brand, Config, Ui } from "../config";
import { baseConfig } from "../config";
import { Accordion } from "../components/Accordion";
import { CheckIcon } from "../Icons";
import { pickLogoDataUrl } from "../host";

interface Props {
  cfg: Config;
  onLivePreview: (ui: Ui) => void;
  onSave: (cfg: Config) => void;
  setStatus: (msg: string, kind?: string) => void;
}

const clone = (c: Config): Config => JSON.parse(JSON.stringify(c));

export const SettingsView: React.FC<Props> = ({ cfg, onLivePreview, onSave, setStatus }) => {
  const [draft, setDraft] = useState<Config>(() => clone(cfg));

  /* ---- generic patch helpers ---- */
  const patchUi = (patch: Partial<Ui>) => {
    setDraft((d) => {
      const next = { ...d, ui: { ...d.ui, ...patch } };
      onLivePreview(next.ui);
      return next;
    });
  };
  const patchTcStyle = (patch: Partial<Config["tcStyle"]>) =>
    setDraft((d) => ({ ...d, tcStyle: { ...d.tcStyle, ...patch } }));
  const patchAbout = (patch: Partial<Config["about"]>) =>
    setDraft((d) => ({ ...d, about: { ...d.about, ...patch } }));

  const setTcText = (client: string, lang: string, value: string) =>
    setDraft((d) => ({
      ...d,
      tcText: { ...d.tcText, [client]: { ...(d.tcText[client] || {}), [lang]: value } },
    }));

  const setBrandField = (i: number, key: keyof Brand, value: string) =>
    setDraft((d) => {
      const brands = d.brands.map((b, idx) =>
        idx === i
          ? {
              ...b,
              [key]:
                key === "colors"
                  ? value.split(",").map((s) => s.trim()).filter(Boolean)
                  : value,
            }
          : b,
      );
      return { ...d, brands };
    });

  const addBrand = () =>
    setDraft((d) => ({
      ...d,
      brands: [
        ...d.brands,
        { id: "brand" + Date.now(), name: "New Brand", guidelinesUrl: "", fontsUrl: "", colors: [] },
      ],
    }));

  const pickLogo = async () => {
    try {
      const res = await pickLogoDataUrl();
      if (!res) return;
      patchUi({ logo: res.dataUrl });
      setStatus("Logo set — Save to keep it", "ok");
    } catch (e: any) {
      setStatus("Logo error: " + e.message, "err");
    }
  };

  const resetAppearance = () => {
    patchUi({ accent: baseConfig.ui.accent, accent2: baseConfig.ui.accent2, logo: null });
    setStatus("Appearance reset — Save to keep", "ok");
  };

  const save = () => {
    onSave(draft);
    setStatus("Settings saved", "ok");
  };

  return (
    <section className="view active">
      <div className="view-title">Control Panel</div>

      {/* ── Appearance ── */}
      <Accordion title="Appearance">
        <div className="row2">
          <div className="field">
            <label className="field-label">Accent</label>
            <input
              type="color"
              className="color-input"
              value={draft.ui.accent}
              onChange={(e) => patchUi({ accent: e.target.value })}
            />
          </div>
          <div className="field">
            <label className="field-label">Accent 2</label>
            <input
              type="color"
              className="color-input"
              value={draft.ui.accent2}
              onChange={(e) => patchUi({ accent2: e.target.value })}
            />
          </div>
        </div>
        <div className="field">
          <label className="field-label">Plugin logo</label>
          <div className="folder-row">
            <span className="folder-path">{draft.ui.logo ? "Custom logo set" : "Default mark"}</span>
            <button className="btn-ghost" onClick={pickLogo}>
              Choose…
            </button>
          </div>
        </div>
        <button className="btn-ghost wide" onClick={resetAppearance}>
          Reset appearance
        </button>
      </Accordion>

      {/* ── Client T&C text ── */}
      <Accordion title="Client T&C text" defaultCollapsed>
        {cfg.clients.map((client) => (
          <div className="client-tc-block" key={client}>
            <div className="client-tc-name">{client}</div>
            {["EN", "AR"].map((lang) => (
              <div className="field" key={lang}>
                <label className="field-label">{lang}</label>
                <textarea
                  className="textarea"
                  value={(draft.tcText[client] || {})[lang] || ""}
                  onChange={(e) => setTcText(client, lang, e.target.value)}
                />
              </div>
            ))}
          </div>
        ))}
      </Accordion>

      {/* ── T&C style ── */}
      <Accordion title="T&C style" defaultCollapsed>
        <div className="field">
          <label className="field-label">Font (EN)</label>
          <input
            className="text-input"
            value={draft.tcStyle.fontEN}
            onChange={(e) => patchTcStyle({ fontEN: e.target.value })}
          />
        </div>
        <div className="field">
          <label className="field-label">Font (AR)</label>
          <input
            className="text-input"
            value={draft.tcStyle.fontAR}
            onChange={(e) => patchTcStyle({ fontAR: e.target.value })}
          />
        </div>
        <div className="row2">
          <div className="field">
            <label className="field-label">Size (pt)</label>
            <input
              type="number"
              className="text-input"
              value={draft.tcStyle.sizePt}
              onChange={(e) => patchTcStyle({ sizePt: parseFloat(e.target.value) || draft.tcStyle.sizePt })}
            />
          </div>
          <div className="field">
            <label className="field-label">Color</label>
            <input
              type="color"
              className="color-input"
              value={draft.tcStyle.color}
              onChange={(e) => patchTcStyle({ color: e.target.value })}
            />
          </div>
        </div>
        <div className="row2">
          <div className="field">
            <label className="field-label">Anchor</label>
            <select
              className="text-input"
              value={draft.tcStyle.anchor}
              onChange={(e) => patchTcStyle({ anchor: e.target.value })}
            >
              <option value="bottom-center">Bottom center</option>
              <option value="bottom-left">Bottom left</option>
              <option value="bottom-right">Bottom right</option>
              <option value="top-center">Top center</option>
            </select>
          </div>
          <div className="field">
            <label className="field-label">Margin (pt)</label>
            <input
              type="number"
              className="text-input"
              value={draft.tcStyle.marginPt}
              onChange={(e) =>
                patchTcStyle({ marginPt: parseFloat(e.target.value) || draft.tcStyle.marginPt })
              }
            />
          </div>
        </div>
      </Accordion>

      {/* ── Brands ── */}
      <Accordion
        title="Brands"
        defaultCollapsed
        footer={
          <button className="btn-ghost wide" onClick={addBrand}>
            + Add brand
          </button>
        }
      >
        {draft.brands.map((b, i) => (
          <div className="brand-edit-block" key={b.id}>
            <div className="field">
              <label className="field-label">Name</label>
              <input
                className="text-input"
                value={b.name}
                onChange={(e) => setBrandField(i, "name", e.target.value)}
              />
            </div>
            <div className="field">
              <label className="field-label">Guidelines URL</label>
              <input
                className="text-input"
                value={b.guidelinesUrl}
                onChange={(e) => setBrandField(i, "guidelinesUrl", e.target.value)}
              />
            </div>
            <div className="field">
              <label className="field-label">Fonts URL</label>
              <input
                className="text-input"
                value={b.fontsUrl}
                onChange={(e) => setBrandField(i, "fontsUrl", e.target.value)}
              />
            </div>
            <div className="field">
              <label className="field-label">Colors (comma hex)</label>
              <input
                className="text-input"
                value={(b.colors || []).join(", ")}
                onChange={(e) => setBrandField(i, "colors", e.target.value)}
              />
            </div>
          </div>
        ))}
      </Accordion>

      {/* ── About info ── */}
      <Accordion title="About info" defaultCollapsed>
        <div className="field">
          <label className="field-label">Name</label>
          <input
            className="text-input"
            value={draft.about.author}
            onChange={(e) => patchAbout({ author: e.target.value })}
          />
        </div>
        <div className="field">
          <label className="field-label">Role</label>
          <input
            className="text-input"
            value={draft.about.role}
            onChange={(e) => patchAbout({ role: e.target.value })}
          />
        </div>
        <div className="field">
          <label className="field-label">Email</label>
          <input
            className="text-input"
            value={draft.about.email}
            onChange={(e) => patchAbout({ email: e.target.value })}
          />
        </div>
        <div className="field">
          <label className="field-label">Bio</label>
          <textarea
            className="textarea"
            value={draft.about.bio}
            onChange={(e) => patchAbout({ bio: e.target.value })}
          />
        </div>
      </Accordion>

      <button className="btn-primary" onClick={save}>
        <span className="btn-ico">
          <CheckIcon />
        </span>
        <span className="btn-text">Save Settings</span>
      </button>
    </section>
  );
};
