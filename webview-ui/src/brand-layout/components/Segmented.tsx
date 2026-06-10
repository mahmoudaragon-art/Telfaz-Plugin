import React from "react";
import type { Option } from "../config";

interface Props {
  items: Option[];
  value: string | null;
  onChange: (value: string) => void;
}

export const Segmented: React.FC<Props> = ({ items, value, onChange }) => (
  <div className="segmented">
    {items.map((it) => (
      <div
        key={it.value}
        className={"seg-item" + (it.value === value ? " active" : "")}
        onClick={() => onChange(it.value)}
      >
        {it.label}
      </div>
    ))}
  </div>
);
