import React, { useEffect, useState } from "react";
import type { Config, Selection } from "../config";
import { buildBaseName } from "../config";
import { Dropdown } from "../components/Dropdown";
import { Segmented } from "../components/Segmented";
import { FileIcon, FolderIcon, PencilIcon, PlaceIcon, ShieldIcon } from "../Icons";
import type { VerifyResult } from "../config";

interface Props {
  cfg: Config;
  selection: Selection;
  onSelect: (key: keyof Selection, value: string) => void;
  folderPath: string | null;
  onConnect: () => void;
  onVerify: () => void;
  verify: VerifyResult | null;
  onCloseVerify: () => void;
  onPlace: () => void;
  onWriteTc: (text: string) => void;
}

export const PlaceView: React.FC<Props> = ({
  cfg,
  selection,
  onSelect,
  folderPath,
  onConnect,
  onVerify,
  verify,
  onCloseVerify,
  onPlace,
  onWriteTc,
}) => {
  const base = buildBaseName(cfg, selection);
  const connected = !!folderPath;
  const placeDisabled = !(base && connected);

  const showTc = selection.tc === "TC" && !!selection.client;
  const savedTc =
    showTc && selection.client
      ? (cfg.tcText[selection.client] || {})[selection.lang || "EN"] || ""
      : "";

  const [tcText, setTcText] = useState(savedTc);
  // Re-seed the T&C textarea whenever the relevant selection changes.
  useEffect(() => {
    setTcText(savedTc);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selection.client, selection.lang, selection.tc, cfg]);

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

      <div className="field">
        <label className="field-label">Size</label>
        <Dropdown
          items={cfg.sizes}
          value={selection.size}
          placeholder="Select size"
          onChange={(v) => onSelect("size", v)}
        />
      </div>

      <div className="field">
        <label className="field-label">Language</label>
        <Segmented items={cfg.languages} value={selection.lang} onChange={(v) => onSelect("lang", v)} />
      </div>

      <div className="field">
        <label className="field-label">Terms &amp; Conditions</label>
        <Segmented items={cfg.tc} value={selection.tc} onChange={(v) => onSelect("tc", v)} />
      </div>

      <div className="preview-chip">
        <FileIcon />
        <span className="preview-label">Will place</span>
        <span className="preview-name">{base ? base + ".{ai|psd}" : "—"}</span>
      </div>

      <button className="btn-primary" disabled={placeDisabled} onClick={onPlace}>
        <span className="btn-ico">
          <PlaceIcon />
        </span>
        <span className="btn-text">Place Linked Asset</span>
      </button>

      {showTc && (
        <div className="card tc-card">
          <div className="tc-head">
            <span className="field-label">T&amp;C text to write</span>
            <span className="mini-tag">{selection.lang || "EN"}</span>
          </div>
          <textarea
            className="textarea"
            placeholder="Auto-filled from Settings — editable before placing."
            value={tcText}
            onChange={(e) => setTcText(e.target.value)}
          />
          <button className="btn-secondary" onClick={() => onWriteTc(tcText)}>
            <PencilIcon />
            Write T&amp;C on artboard
          </button>
        </div>
      )}
    </section>
  );
};
