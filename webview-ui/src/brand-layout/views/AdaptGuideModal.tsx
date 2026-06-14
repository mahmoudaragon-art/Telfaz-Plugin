import React, { useRef, useState } from "react";
import type { SizeOption } from "../config";

/** Per-size guide centres (normalized 0–1 in the frame) — matches host AdaptTargets. */
export type GuideTargets = Record<
  string,
  { focal: { x: number; y: number }; safe: { x: number; y: number } }
>;

interface Props {
  sizes: SizeOption[];
  onRun: (targets: GuideTargets) => void;
  onCancel: () => void;
}

const FRAME_MAX = 190; // px — longest side of each mini-frame

// Rough display footprint of each guide box (normalized to its frame). Move-only,
// so these sizes are just visual reference; only the centre position is used.
const focalBox = (s: SizeOption) => {
  if (s.h > s.w) return { w: 0.5, h: 0.64 }; // portrait
  if (s.w > s.h) return { w: 0.64, h: 0.5 }; // landscape
  return { w: 0.58, h: 0.58 }; // square
};
const SAFE_BOX = { w: 0.72, h: 0.16 };

const clampCenter = (v: number, half: number) => Math.max(half, Math.min(1 - half, v));

export const AdaptGuideModal: React.FC<Props> = ({ sizes, onRun, onCancel }) => {
  const [pos, setPos] = useState<GuideTargets>(() => {
    const init: GuideTargets = {};
    for (const s of sizes) init[s.value] = { focal: { x: 0.5, y: 0.5 }, safe: { x: 0.5, y: 0.22 } };
    return init;
  });

  const drag = useRef<{ size: string; kind: "focal" | "safe"; frame: HTMLElement } | null>(null);

  const onDown = (e: React.PointerEvent, size: string, kind: "focal" | "safe") => {
    e.preventDefault();
    e.stopPropagation();
    drag.current = { size, kind, frame: e.currentTarget.parentElement as HTMLElement };
  };

  const onMove = (e: React.PointerEvent) => {
    const d = drag.current;
    if (!d) return;
    const r = d.frame.getBoundingClientRect();
    const nx = (e.clientX - r.left) / r.width;
    const ny = (e.clientY - r.top) / r.height;
    const s = sizes.find((z) => z.value === d.size)!;
    const box = d.kind === "focal" ? focalBox(s) : SAFE_BOX;
    setPos((prev) => ({
      ...prev,
      [d.size]: {
        ...prev[d.size],
        [d.kind]: { x: clampCenter(nx, box.w / 2), y: clampCenter(ny, box.h / 2) },
      },
    }));
  };

  const onUp = () => {
    drag.current = null;
  };

  return (
    <div className="guide-modal-backdrop" onPointerMove={onMove} onPointerUp={onUp}>
      <div className="guide-modal" onPointerDown={(e) => e.stopPropagation()}>
        <div className="guide-modal-head">
          <div className="guide-modal-title">Position the guides per size</div>
          <div className="guide-modal-sub">
            Drag the <b className="dot-focal">focal</b> and <b className="dot-safe">text</b> boxes
            where you want them in each frame, then Run.
          </div>
        </div>

        <div className="guide-frames">
          {sizes.map((s) => {
            const landscape = s.w >= s.h;
            const fw = landscape ? FRAME_MAX : FRAME_MAX * (s.w / s.h);
            const fh = landscape ? FRAME_MAX * (s.h / s.w) : FRAME_MAX;
            const st = pos[s.value];
            const fb = focalBox(s);
            return (
              <div className="guide-frame-wrap" key={s.value}>
                <div className="guide-frame-label">
                  {s.label} · {s.w}×{s.h}
                </div>
                <div className="guide-frame" style={{ width: fw, height: fh }}>
                  {/* non-interactive references */}
                  <div className="guide-safearea" />
                  <div className="guide-crosshair" />
                  <div
                    className="guide-box focal"
                    onPointerDown={(e) => onDown(e, s.value, "focal")}
                    style={{
                      width: `${fb.w * 100}%`,
                      height: `${fb.h * 100}%`,
                      left: `${(st.focal.x - fb.w / 2) * 100}%`,
                      top: `${(st.focal.y - fb.h / 2) * 100}%`,
                    }}
                  >
                    <span>focal</span>
                  </div>
                  <div
                    className="guide-box safe"
                    onPointerDown={(e) => onDown(e, s.value, "safe")}
                    style={{
                      width: `${SAFE_BOX.w * 100}%`,
                      height: `${SAFE_BOX.h * 100}%`,
                      left: `${(st.safe.x - SAFE_BOX.w / 2) * 100}%`,
                      top: `${(st.safe.y - SAFE_BOX.h / 2) * 100}%`,
                    }}
                  >
                    <span>text</span>
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        <div className="guide-modal-foot">
          <button className="btn-ghost" onClick={onCancel}>
            Cancel
          </button>
          <button className="btn-primary" onClick={() => onRun(pos)}>
            Run adaptation
          </button>
        </div>
      </div>
    </div>
  );
};
