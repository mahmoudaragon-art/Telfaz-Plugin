import React, { useState } from "react";

interface Props {
  title: string;
  defaultCollapsed?: boolean;
  footer?: React.ReactNode;
  children: React.ReactNode;
}

export const Accordion: React.FC<Props> = ({
  title,
  defaultCollapsed = false,
  footer,
  children,
}) => {
  const [collapsed, setCollapsed] = useState(defaultCollapsed);
  return (
    <div className={"accordion" + (collapsed ? " collapsed" : "")}>
      <div className="acc-head" onClick={() => setCollapsed((c) => !c)}>
        {title}
      </div>
      <div className="acc-body">{children}</div>
      {footer}
    </div>
  );
};
