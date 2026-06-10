import React, { useEffect, useState } from "react";
import type { Config } from "../config";
import { LogoMarkLarge } from "../Icons";
import type { API } from "../../../../src/api/api";

interface Props {
  cfg: Config;
  api: API;
}

export const AboutView: React.FC<Props> = ({ cfg, api }) => {
  const { about } = cfg;
  const [version, setVersion] = useState("1.0.0");
  useEffect(() => {
    api
      .getPluginVersion()
      .then(setVersion)
      .catch(() => {});
  }, []);
  return (
    <section className="view active">
      <div className="about-hero">
        <div className="about-logo">
          <LogoMarkLarge />
        </div>
        <div className="about-name">Brand Layout</div>
        <div className="about-ver">v{version}</div>
      </div>
      <div className="card">
        <div className="about-bio">{about.bio}</div>
      </div>
      <div className="card about-author">
        <div className="about-author-name">{about.author || "—"}</div>
        <div className="about-author-role">{about.role || ""}</div>
        <a
          className="about-link"
          href="#"
          onClick={(e) => {
            e.preventDefault();
            if (about.email) api.openExternal("mailto:" + about.email);
          }}
        >
          {about.email || "—"}
        </a>
      </div>
      <div className="about-foot">Brand Layout · Photoshop &amp; Illustrator · UXP</div>
    </section>
  );
};
