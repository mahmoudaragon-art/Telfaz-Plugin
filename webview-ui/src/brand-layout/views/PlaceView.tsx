import React, { useEffect, useState } from "react";
import type { Config, Selection, VerifyResult } from "../config";
import { buildBaseName, sizeLabel, sizesByCategory } from "../config";
import type { API } from "../../../../src/api/api";
import { Dropdown } from "../components/Dropdown";
import { Segmented } from "../components/Segmented";
import {
  ArtboardIcon,
  CheckIcon,
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
  onWriteTc: (text: string, dir: "rtl" | "ltr") => void;
}

type Mode = "single" | "multiple";

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
  onWriteTc,
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

  const groups = sizesByCategory(cfg);

  /* ---- T&C (shown once a language + T&C=TC are chosen, any client) ---- */
  const showTc = selection.tc === "TC" && !!selection.lang;
  const [tcText, setTcText] = useState("");
  const [dir, setDir] = useState<"rtl" | "ltr">(selection.lang === "AR" ? "rtl" : "ltr");
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

  const handleCreate = () => {
    const sizes =
      mode === "single" ? (selection.size ? [selection.size] : []) : Array.from(checked);
    onCreateArtboards(sizes);
  };

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
            items={cfg.sizes.map((s) => ({ label: sizeLabel(s), value: s.value }))}
            value={selection.size}
            placeholder="Select size"
            onChange={(v) => onSelect("size", v)}
          />
        </div>
      ) : (
        <div className="field">
          <label className="field-label">Sizes</label>
          {groups.length === 0 ? (
            <div className="folder-hint">No sizes yet — add some in Settings → Sizes.</div>
          ) : (
            <div className="size-groups">
              {groups.map((g) => (
                <div className="size-group" key={g.category.value}>
                  <div className="size-group-head">{g.category.label}</div>
                  {g.sizes.map((s) => {
                    const on = checked.has(s.value);
                    return (
                      <label className={"check-row" + (on ? " checked" : "")} key={s.value}>
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
                  })}
                </div>
              ))}
            </div>
          )}
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

      {mode === "single" && (
        <div className="preview-chip">
          <FileIcon />
          <span className="preview-label">Will place</span>
          <span className="preview-name">{base ? base + ".{ai|psd}" : "—"}</span>
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
          <button className="btn-secondary" onClick={() => onWriteTc(tcText, dir)}>
            <PencilIcon />
            Write T&amp;C on artboard
          </button>
        </div>
      )}
    </section>
  );
};
