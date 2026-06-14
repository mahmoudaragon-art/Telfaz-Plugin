import React, { useEffect, useState } from "react";
import type { Config, Selection, VerifyResult } from "../config";
import { buildBaseName, sizeLabel, findSize } from "../config";
import { clientLogos, whiteClients } from "../clientLogos";
import type { API } from "../../../../src/api/api";
import { Dropdown } from "../components/Dropdown";
import { Segmented } from "../components/Segmented";
import {
  ArtboardIcon,
  CheckIcon,
  Chevron,
  DirectionIcon,
  FileIcon,
  FolderIcon,
  PencilIcon,
  PlaceIcon,
  ShieldIcon,
} from "../Icons";

interface Props {
  cfg: Config;
  api: API;
  selection: Selection;
  onSelect: (key: keyof Selection, value: string) => void;
  folderPath: string | null;
  onConnect: () => void;
  onVerify: () => void;
  verify: VerifyResult | null;
  onCloseVerify: () => void;
  onPlace: () => void;
  onCreateArtboards: (sizeValues: string[]) => void;
  onAdaptDesign: (sizeValues: string[]) => void;
  onAddGuides: () => void;
  onWriteTc: (text: string, dir: "rtl" | "ltr", anchor: string) => void;
  onUpdateTc: (text: string, anchor: string) => void;
}

type Mode = "single" | "multiple";

const ANCHORS = [
  "top-left",
  "top-center",
  "top-right",
  "middle-left",
  "center",
  "middle-right",
  "bottom-left",
  "bottom-center",
  "bottom-right",
];

export const PlaceView: React.FC<Props> = ({
  cfg,
  api,
  selection,
  onSelect,
  folderPath,
  onConnect,
  onVerify,
  verify,
  onCloseVerify,
  onPlace,
  onCreateArtboards,
  onAdaptDesign,
  onAddGuides,
  onWriteTc,
  onUpdateTc,
}) => {
  const connected = !!folderPath;
  const base = buildBaseName(cfg, selection);

  const [mode, setMode] = useState<Mode>("single");
  const [checked, setChecked] = useState<Set<string>>(new Set());
  const toggleSize = (value: string) =>
    setChecked((prev) => {
      const next = new Set(prev);
      if (next.has(value)) next.delete(value);
      else next.add(value);
      return next;
    });
  const toggleGroup = (values: string[], on: boolean) =>
    setChecked((prev) => {
      const next = new Set(prev);
      values.forEach((v) => (on ? next.add(v) : next.delete(v)));
      return next;
    });

  // Client logo, rendered on the right of the dropdown row (text on the left).
  const clientTrailing = (value: string) =>
    clientLogos[value] ? (
      <img
        className={"client-logo" + (whiteClients.has(value) ? " white" : "")}
        src={clientLogos[value]}
        alt=""
      />
    ) : null;

  // A size shows if it isn't language-restricted, no language is picked yet, or
  // its langs include the chosen language (e.g. Cute Box AR-only Digital sizes
  // drop out when English is selected).
  const sizeForLang = (s: { langs?: ("AR" | "EN")[] }) =>
    !s.langs || !selection.lang || s.langs.includes(selection.lang as "AR" | "EN");
  const visibleSizes = cfg.sizes.filter(sizeForLang);

  // All categories with their sizes (empty ones included so they're visible);
  // each is collapsible.
  const cats = cfg.categories.map((category) => ({
    category,
    sizes: visibleSizes.filter((s) => s.category === category.value),
  }));
  const [openCats, setOpenCats] = useState<Set<string>>(
    () => new Set(cats.filter((c) => c.sizes.length).map((c) => c.category.value)),
  );
  const toggleCat = (value: string) =>
    setOpenCats((prev) => {
      const next = new Set(prev);
      if (next.has(value)) next.delete(value);
      else next.add(value);
      return next;
    });

  // Friendly summary of what will be placed (single mode).
  const selSize = findSize(cfg, selection.size);
  const willPlace =
    selection.client && selSize && selection.lang
      ? `${selection.client} ${selSize.label} ${selection.lang} ${selSize.w}×${selSize.h}`
      : null;

  /* ---- T&C (shown once a language + T&C=TC are chosen, any client) ---- */
  const showTc = selection.tc === "TC" && !!selection.lang;
  const [tcText, setTcText] = useState("");
  const [dir, setDir] = useState<"rtl" | "ltr">(selection.lang === "AR" ? "rtl" : "ltr");
  const [anchor, setAnchor] = useState("bottom-center");
  useEffect(() => {
    setDir(selection.lang === "AR" ? "rtl" : "ltr");
  }, [selection.lang]);
  useEffect(() => {
    api
      .kvGet("tcDraft")
      .then((v) => v && setTcText(v))
      .catch(() => {});
  }, []);
  const onTcChange = (v: string) => {
    setTcText(v);
    api.kvSet("tcDraft", v).catch(() => {});
  };

  const placeDisabled = !(base && connected);
  const createDisabled =
    !connected ||
    !selection.client ||
    !selection.lang ||
    !selection.tc ||
    (mode === "single" ? !selection.size : checked.size === 0);

  const visibleValues = new Set(visibleSizes.map((s) => s.value));
  const selectedSizes = () =>
    (mode === "single" ? (selection.size ? [selection.size] : []) : Array.from(checked)).filter(
      (v) => visibleValues.has(v),
    );

  const handleCreate = () => onCreateArtboards(selectedSizes());
  const handleAdapt = () => onAdaptDesign(selectedSizes());
  const adaptDisabled = mode === "single" ? !selection.size : checked.size === 0;

  return (
    <section className="view active">
      <div className="card folder-card">
        <div className="folder-row">
          <div className="folder-info">
            <span className="folder-label">Source folder</span>
            <span className={"folder-path" + (connected ? " connected" : "")}>
              {folderPath || "Not connected"}
            </span>
          </div>
          <button className="btn-ghost" onClick={onConnect}>
            <FolderIcon />
            Connect
          </button>
        </div>
        <div className="folder-hint">Point this to your synced Google Drive folder.</div>
        <button className="btn-verify" disabled={!connected} onClick={onVerify}>
          <ShieldIcon />
          Verify all assets
        </button>
        {verify && (
          <div className="verify-results show">
            <div className="verify-head">
              <div className="verify-summary">
                {verify.present} / {verify.total} found
              </div>
              <button className="verify-close" onClick={onCloseVerify}>
                ✕
              </button>
            </div>
            <div className="verify-list">
              {verify.missing.length === 0 ? (
                <div className="verify-row ok"> All assets present</div>
              ) : (
                verify.missing.map((m) => (
                  <div key={m} className="verify-row miss">
                    {" "}
                    {m}
                  </div>
                ))
              )}
            </div>
          </div>
        )}
      </div>

      <div className="field">
        <label className="field-label">Client</label>
        <Dropdown
          items={cfg.clients.map((c) => ({ label: c, value: c }))}
          value={selection.client}
          placeholder="Select client"
          onChange={(v) => onSelect("client", v)}
          trailing={clientTrailing}
        />
      </div>

      {/* Single vs Multiple */}
      <div className="field">
        <label className="field-label">Mode</label>
        <Segmented
          items={[
            { label: "Single", value: "single" },
            { label: "Multiple", value: "multiple" },
          ]}
          value={mode}
          onChange={(v) => setMode(v as Mode)}
        />
      </div>

      {/* Size — single dropdown / multiple checklist by category */}
      {mode === "single" ? (
        <div className="field">
          <label className="field-label">Size</label>
          <Dropdown
            items={visibleSizes.map((s) => ({ label: sizeLabel(s), value: s.value }))}
            value={selection.size}
            placeholder="Select size"
            onChange={(v) => onSelect("size", v)}
          />
        </div>
      ) : (
        <div className="field">
          <label className="field-label">Sizes</label>
          <div className="size-groups">
            {cats.map((g) => {
              const vals = g.sizes.map((s) => s.value);
              const allOn = vals.length > 0 && vals.every((v) => checked.has(v));
              const selCount = vals.filter((v) => checked.has(v)).length;
              const isOpen = openCats.has(g.category.value);
              return (
                <div
                  className={"size-group" + (isOpen ? " open" : "")}
                  key={g.category.value}
                >
                  <div className="size-group-head">
                    <span
                      className={"check-box sm" + (allOn ? " on" : "")}
                      onClick={(e) => {
                        e.stopPropagation();
                        if (vals.length) toggleGroup(vals, !allOn);
                      }}
                    >
                      {allOn && <CheckIcon />}
                    </span>
                    <button
                      className="size-group-toggle"
                      onClick={() => toggleCat(g.category.value)}
                    >
                      <span className="size-group-name">{g.category.label}</span>
                      <span className="size-group-meta">
                        {selCount ? `${selCount}/${vals.length}` : vals.length || "—"}
                      </span>
                      <span className="size-group-chevron">
                        <Chevron />
                      </span>
                    </button>
                  </div>
                  {isOpen && (
                    <div className="size-group-body">
                      {vals.length === 0 ? (
                        <div className="folder-hint">No sizes yet — add in Settings → Sizes.</div>
                      ) : (
                        g.sizes.map((s) => {
                          const on = checked.has(s.value);
                          return (
                            <label
                              className={"check-row" + (on ? " checked" : "")}
                              key={s.value}
                            >
                              <input
                                type="checkbox"
                                checked={on}
                                onChange={() => toggleSize(s.value)}
                              />
                              <span className="check-box">{on && <CheckIcon />}</span>
                              <span className="check-label">{s.label}</span>
                              <span className="check-dim">
                                {s.w}×{s.h}
                              </span>
                            </label>
                          );
                        })
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}

      <div className="field">
        <label className="field-label">Language</label>
        <Segmented items={cfg.languages} value={selection.lang} onChange={(v) => onSelect("lang", v)} />
      </div>

      <div className="field">
        <label className="field-label">Terms &amp; Conditions</label>
        <Segmented items={cfg.tc} value={selection.tc} onChange={(v) => onSelect("tc", v)} />
      </div>

      {showTc && (
        <div className="card tc-card">
          <div className="tc-head">
            <span className="field-label">T&amp;C text to write</span>
            <button
              className="dir-toggle"
              onClick={() => setDir((d) => (d === "rtl" ? "ltr" : "rtl"))}
              title="Toggle writing direction"
            >
              <DirectionIcon />
              {dir.toUpperCase()}
            </button>
          </div>
          <textarea
            className="textarea"
            dir={dir}
            placeholder="Type the Terms &amp; Conditions text…"
            value={tcText}
            onChange={(e) => onTcChange(e.target.value)}
          />
          <div className="tc-anchor">
            <span className="field-label">Anchor</span>
            <div className="anchor-grid">
              {ANCHORS.map((a) => (
                <button
                  key={a}
                  className={"anchor-cell" + (anchor === a ? " active" : "")}
                  onClick={() => setAnchor(a)}
                  title={a.replace("-", " ")}
                >
                  <span className="anchor-dot" />
                </button>
              ))}
            </div>
          </div>
          <div className="tc-actions">
            <button className="btn-secondary" onClick={() => onWriteTc(tcText, dir, anchor)}>
              <PencilIcon />
              Write T&amp;C
            </button>
            <button className="btn-ghost" onClick={() => onUpdateTc(tcText, anchor)}>
              Update text
            </button>
          </div>
        </div>
      )}

      {mode === "single" && (
        <div className="preview-chip">
          <FileIcon />
          <span className="preview-label">Will place</span>
          <span className="preview-name">{willPlace || "—"}</span>
        </div>
      )}

      <div className="action-row">
        {mode === "single" && (
          <button className="btn-primary" disabled={placeDisabled} onClick={onPlace}>
            <span className="btn-ico">
              <PlaceIcon />
            </span>
            <span className="btn-text">Place Linked Asset</span>
          </button>
        )}
        <button className="btn-primary" disabled={createDisabled} onClick={handleCreate}>
          <span className="btn-ico">
            <ArtboardIcon />
          </span>
          <span className="btn-text">
            {mode === "single"
              ? "Create Artboard & Place"
              : `Create ${checked.size || ""} Artboard${checked.size === 1 ? "" : "s"} & Place`}
          </span>
        </button>
        <button className="btn-secondary wide" disabled={adaptDisabled} onClick={handleAdapt}>
          <ArtboardIcon />
          {mode === "single"
            ? "Adapt Design to Size"
            : `Adapt Design to ${checked.size || ""} Size${checked.size === 1 ? "" : "s"}`}
        </button>
        <button className="btn-ghost wide" onClick={onAddGuides}>
          + Set up adapt guides (3000×3000)
        </button>
      </div>
      <div className="folder-hint">
        Adapt works on the open master design — needs top groups <b>Visual</b> (with a{" "}
        <b>focal</b> rect) and <b>Text</b> (with a <b>safe</b> rect), each holding one Smart
        Object. It also places the brand asset on top, so connect the folder and pick
        Client / Language / T&amp;C.
      </div>
    </section>
  );
};
