import React, { useEffect, useState } from "react";
import type { Config } from "../config";
import type { API } from "../../../../src/api/api";
import telfazLogo from "../assets/telfaz-logo.png";

interface Props {
  cfg: Config;
  api: API;
  /** Currently signed-in work email (sign-in gate). */
  authEmail?: string | null;
  onSignOut?: () => void;
}

export const AboutView: React.FC<Props> = ({ cfg, api, authEmail, onSignOut }) => {
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
        <div className="about-logo has-img">
          <img className="about-logo-img" src={telfazLogo} alt="Telfaz" />
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
      {authEmail && (
        <div className="card about-account">
          <div className="about-account-row">
            <span className="about-account-label">Signed in as</span>
            <span className="about-account-email">{authEmail}</span>
          </div>
          <button className="btn-ghost about-signout" onClick={onSignOut}>
            Sign out
          </button>
        </div>
      )}
      <div className="about-foot">Brand Layout · Photoshop &amp; Illustrator · UXP</div>
    </section>
  );
};
