import React, { useRef, useState } from "react";
import type { SizeOption } from "../config";

/** Per-size guide centres (normalized 0–1 in the frame) — matches host AdaptTargets.
 *  `focal.zoom` (1 = default) and `safe.scale` (1 = auto-fit) come from the resize
 *  handles, so the Illustrator adapt can scale the visual / text accordingly. */
export type GuideTargets = Record<
  string,
  { focal: { x: number; y: number; zoom?: number }; safe: { x: number; y: number; scale?: number } }
>;

interface Props {
  sizes: SizeOption[];
  /** Faint raster of the selection's VISUAL part (background under the focal guide). */
  preview?: string;
  /** Raster of the selection's TEXT part (shown under the text guide). */
  textPreview?: string;
  onRun: (targets: GuideTargets) => void;
  onCancel: () => void;
}

const FRAME_MAX = 190; // px — longest side of each mini-frame

const focalBox = (s: SizeOption) => {
  if (s.h > s.w) return { w: 0.5, h: 0.64 }; // portrait
  if (s.w > s.h) return { w: 0.64, h: 0.5 }; // landscape
  return { w: 0.58, h: 0.58 }; // square
};
const SAFE_BOX = { w: 0.72, h: 0.16 };
const MIN_BOX = 0.16, MAX_BOX = 4;
const DISP_CAP = 0.9;          // focal box never fills the frame → handle stays grabbable
const FOCAL_OVER = 0.5;        // how far the focal centre may leave the frame (each side)
const T_MIN = 0.3, T_MAX = 4;  // text scale range

const clamp = (v: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, v));
const clampCenter = (v: number, half: number) => clamp(v, half, 1 - half);
const clampFocal = (v: number) => clamp(v, -FOCAL_OVER, 1 + FOCAL_OVER);
const zoomOf = (b: { w: number; h: number }, def: { w: number; h: number }) =>
  clamp(0.5 * (b.w / def.w + b.h / def.h), 1, 5);

// Auto-fit text box (normalized), like the host adapt: 85% width / 50% height, aspect kept.
const textBox = (fw: number, fh: number, nat: { w: number; h: number } | null) => {
  if (!nat || nat.w <= 0 || nat.h <= 0) return SAFE_BOX;
  const sc = Math.min((fw * 0.85) / nat.w, (fh * 0.5) / nat.h);
  return { w: (nat.w * sc) / fw, h: (nat.h * sc) / fh };
};

type Kind = "focal" | "safe" | "resize" | "tresize";

export const AdaptGuideModal: React.FC<Props> = ({ sizes, preview, textPreview, onRun, onCancel }) => {
  const [pos, setPos] = useState<GuideTargets>(() => {
    const init: GuideTargets = {};
    for (const s of sizes) init[s.value] = { focal: { x: 0.5, y: 0.5 }, safe: { x: 0.5, y: 0.78 } };
    return init;
  });
  const [boxes, setBoxes] = useState<Record<string, { w: number; h: number }>>(() => {
    const init: Record<string, { w: number; h: number }> = {};
    for (const s of sizes) init[s.value] = focalBox(s);
    return init;
  });
  const [tScales, setTScales] = useState<Record<string, number>>(() => {
    const init: Record<string, number> = {};
    for (const s of sizes) init[s.value] = 1;
    return init;
  });
  const [textNat, setTextNat] = useState<{ w: number; h: number } | null>(null);

  const posRef = useRef(pos); posRef.current = pos;
  const boxesRef = useRef(boxes); boxesRef.current = boxes;
  const tScalesRef = useRef(tScales); tScalesRef.current = tScales;
  const textNatRef = useRef(textNat); textNatRef.current = textNat;
  const drag = useRef<{ size: string; kind: Kind; frame: HTMLElement } | null>(null);

  const onWinMove = (e: MouseEvent) => {
    const d = drag.current;
    if (!d) return;
    const r = d.frame.getBoundingClientRect();
    const nx = (e.clientX - r.left) / r.width;
    const ny = (e.clientY - r.top) / r.height;

    if (d.kind === "resize") {
      const c = posRef.current[d.size].focal;
      const w = clamp(Math.abs(nx - c.x) * 2, MIN_BOX, MAX_BOX);
      const h = clamp(Math.abs(ny - c.y) * 2, MIN_BOX, MAX_BOX);
      setBoxes((prev) => ({ ...prev, [d.size]: { w, h } }));
      return;
    }
    if (d.kind === "tresize") {
      const c = posRef.current[d.size].safe;
      const auto = textPreview ? textBox(r.width, r.height, textNatRef.current) : SAFE_BOX;
      const sw = (Math.abs(nx - c.x) * 2) / auto.w;
      const sh = (Math.abs(ny - c.y) * 2) / auto.h;
      const scale = clamp(0.5 * (sw + sh), T_MIN, T_MAX);
      setTScales((prev) => ({ ...prev, [d.size]: scale }));
      return;
    }

    if (d.kind === "focal") {
      // Free pan — the focal may leave the frame so the visual can be pushed further.
      setPos((prev) => ({ ...prev, [d.size]: { ...prev[d.size], focal: { ...prev[d.size].focal, x: clampFocal(nx), y: clampFocal(ny) } } }));
      return;
    }
    // text guide — keep its centre inside the frame
    const auto = textPreview ? textBox(r.width, r.height, textNatRef.current) : SAFE_BOX;
    const sc = tScalesRef.current[d.size] || 1;
    const bw = Math.min(auto.w * sc, 1), bh = Math.min(auto.h * sc, 1);
    setPos((prev) => ({ ...prev, [d.size]: { ...prev[d.size], safe: { ...prev[d.size].safe, x: clampCenter(nx, bw / 2), y: clampCenter(ny, bh / 2) } } }));
  };

  const onWinUp = () => {
    drag.current = null;
    window.removeEventListener("mousemove", onWinMove);
    window.removeEventListener("mouseup", onWinUp);
  };

  const onDown = (e: React.MouseEvent, size: string, kind: Kind) => {
    e.preventDefault();
    e.stopPropagation();
    const el = e.currentTarget as HTMLElement;
    // resize handles sit one level deeper than their box.
    const frame = (kind === "resize" || kind === "tresize"
      ? el.parentElement?.parentElement
      : el.parentElement) as HTMLElement;
    drag.current = { size, kind, frame };
    window.addEventListener("mousemove", onWinMove);
    window.addEventListener("mouseup", onWinUp);
  };

  const run = () => {
    const out: GuideTargets = {};
    for (const s of sizes) {
      out[s.value] = {
        focal: { ...pos[s.value].focal, zoom: zoomOf(boxes[s.value], focalBox(s)) },
        safe: { ...pos[s.value].safe, scale: tScales[s.value] || 1 },
      };
    }
    onRun(out);
  };

  return (
    <div className="guide-modal-backdrop">
      <div className="guide-modal" onMouseDown={(e) => e.stopPropagation()}>
        <div className="guide-modal-head">
          <div className="guide-modal-title">Position the guides per size</div>
          <div className="guide-modal-sub">
            Drag the <b className="dot-focal">visual</b> (corner = zoom) and the{" "}
            <b className="dot-safe">text</b> (corner = resize). The visual can be pushed past the
            edges. Then Run.
          </div>
        </div>

        {textPreview && (
          <img src={textPreview} alt="" style={{ display: "none" }}
            onLoad={(e) => { const im = e.currentTarget; setTextNat({ w: im.naturalWidth, h: im.naturalHeight }); }} />
        )}

        <div className="guide-frames">
          {sizes.map((s) => {
            const landscape = s.w >= s.h;
            const fw = landscape ? FRAME_MAX : FRAME_MAX * (s.w / s.h);
            const fh = landscape ? FRAME_MAX * (s.h / s.w) : FRAME_MAX;
            const st = pos[s.value];
            const fb = boxes[s.value];
            const zoom = zoomOf(fb, focalBox(s));
            const dispW = Math.min(fb.w, DISP_CAP), dispH = Math.min(fb.h, DISP_CAP);
            const ox = (1 - st.focal.x) * 100, oy = (1 - st.focal.y) * 100;
            const auto = textPreview ? textBox(fw, fh, textNat) : SAFE_BOX;
            const tsc = tScales[s.value] || 1;
            const tw = auto.w * tsc, th = auto.h * tsc;
            return (
              <div className="guide-frame-wrap" key={s.value}>
                <div className="guide-frame-label">{s.label} · {s.w}×{s.h}</div>
                <div style={{ position: "relative", width: fw, height: fh }}>
                  {/* clipped frame: visual preview + references */}
                  <div className="guide-frame" style={{ width: fw, height: fh }}>
                    {preview && (
                      <img src={preview} alt="" draggable={false}
                        style={{
                          position: "absolute", inset: 0, width: "100%", height: "100%",
                          objectFit: "cover", objectPosition: `${ox}% ${oy}%`,
                          transform: `scale(${zoom})`, transformOrigin: `${ox}% ${oy}%`,
                          opacity: 0.32, pointerEvents: "none", userSelect: "none",
                        }} />
                    )}
                    <div style={{
                      position: "absolute", left: 4, top: 4, padding: "1px 5px", borderRadius: 4,
                      fontSize: 10, fontWeight: 700, background: "rgba(0,0,0,.55)", color: "#ff9b3d",
                      pointerEvents: "none",
                    }}>{zoom.toFixed(1)}×</div>
                    <div className="guide-safearea" />
                    <div className="guide-crosshair" />
                  </div>

                  {/* guides overlay — overflow visible so boxes stay grabbable off-frame */}
                  <div style={{ position: "absolute", inset: 0, overflow: "visible" }}>
                    {/* FOCAL (visual) */}
                    <div className="guide-box focal"
                      onMouseDown={(e) => onDown(e, s.value, "focal")}
                      style={{
                        width: `${dispW * 100}%`, height: `${dispH * 100}%`,
                        left: `${(st.focal.x - dispW / 2) * 100}%`, top: `${(st.focal.y - dispH / 2) * 100}%`,
                      }}>
                      {!preview && <span>visual</span>}
                      <div onMouseDown={(e) => onDown(e, s.value, "resize")}
                        style={{
                          position: "absolute", right: -7, bottom: -7, width: 14, height: 14,
                          borderRadius: 3, background: "#ff8a3d", border: "2px solid #fff",
                          cursor: "nwse-resize", boxShadow: "0 1px 3px rgba(0,0,0,.5)",
                        }} />
                    </div>

                    {/* TEXT */}
                    <div className="guide-box safe"
                      onMouseDown={(e) => onDown(e, s.value, "safe")}
                      style={{
                        width: `${tw * 100}%`, height: `${th * 100}%`,
                        left: `${(st.safe.x - tw / 2) * 100}%`, top: `${(st.safe.y - th / 2) * 100}%`,
                        background: textPreview ? "transparent" : undefined, overflow: "visible",
                      }}>
                      {textPreview ? (
                        <img src={textPreview} alt="" draggable={false}
                          style={{ width: "100%", height: "100%", objectFit: "contain", opacity: 0.92, pointerEvents: "none" }} />
                      ) : (<span>text</span>)}
                      <div onMouseDown={(e) => onDown(e, s.value, "tresize")}
                        style={{
                          position: "absolute", right: -7, bottom: -7, width: 14, height: 14,
                          borderRadius: 3, background: "#2fd0ff", border: "2px solid #fff",
                          cursor: "nwse-resize", boxShadow: "0 1px 3px rgba(0,0,0,.5)",
                        }} />
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        <div className="guide-modal-foot">
          <button className="btn-ghost" onClick={onCancel}>Cancel</button>
          <button className="btn-primary" onClick={run}>Run adaptation</button>
        </div>
      </div>
    </div>
  );
};
