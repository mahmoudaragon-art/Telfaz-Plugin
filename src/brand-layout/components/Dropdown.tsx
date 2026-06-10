import React, { useEffect, useRef, useState } from "react";
import type { Option } from "../config";
import { Chevron } from "../Icons";

interface Props {
  items: Option[];
  value: string | null;
  placeholder: string;
  onChange: (value: string) => void;
}

export const Dropdown: React.FC<Props> = ({ items, value, placeholder, onChange }) => {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onDoc = (e: MouseEvent) => {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("click", onDoc);
    return () => document.removeEventListener("click", onDoc);
  }, [open]);

  const selected = items.find((it) => it.value === value);

  return (
    <div ref={rootRef} className={"dropdown" + (open ? " open" : "")}>
      <button
        className="dropdown-trigger"
        onClick={(e) => {
          e.stopPropagation();
          setOpen((o) => !o);
        }}
      >
        <span className={"dropdown-value" + (selected ? " selected" : "")}>
          {selected ? selected.label : placeholder}
        </span>
        <span className="chevron">
          <Chevron />
        </span>
      </button>
      <div className="dropdown-menu">
        {items.map((it) => (
          <div
            key={it.value}
            className={"dropdown-item" + (it.value === value ? " active" : "")}
            onClick={() => {
              onChange(it.value);
              setOpen(false);
            }}
          >
            {it.label}
          </div>
        ))}
      </div>
    </div>
  );
};
