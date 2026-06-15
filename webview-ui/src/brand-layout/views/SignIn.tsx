import React, { useState } from "react";
import { isValidEmail } from "../config";
import telfazLogo from "../assets/telfaz-logo.png";

interface Props {
  /** Called with the typed email when it passes the allow-list check. */
  onSignIn: (email: string) => void;
  /** Returns true if the email is allowed (checked against the live list). */
  isAllowed: (email: string) => boolean;
  version?: string;
}

/**
 * Email-only sign-in gate. The person types their work email; if it's on the
 * allowed list (hosted JSON, with a baked fallback) they're in — no password.
 * Soft gate by design (no identity verification), suitable for an internal team.
 */
export const SignIn: React.FC<Props> = ({ onSignIn, isAllowed, version }) => {
  const [email, setEmail] = useState("");
  const [error, setError] = useState<string | null>(null);

  const submit = () => {
    const e = email.trim();
    if (!isValidEmail(e)) {
      setError("Enter a valid email address.");
      return;
    }
    if (!isAllowed(e)) {
      setError("This email isn't authorized. Ask the admin to add it.");
      return;
    }
    setError(null);
    onSignIn(e);
  };

  return (
    <div className="signin">
      <div className="signin-card">
        <img className="signin-logo-img" src={telfazLogo} alt="Telfaz" />
        <div className="signin-title">Brand Layout</div>
        <div className="signin-sub">Sign in with your work email to continue</div>

        <input
          className="signin-input"
          type="email"
          inputMode="email"
          autoComplete="email"
          placeholder="name@telfaz.com"
          value={email}
          onChange={(ev) => {
            setEmail(ev.target.value);
            if (error) setError(null);
          }}
          onKeyDown={(ev) => {
            if (ev.key === "Enter") submit();
          }}
        />

        {error && <div className="signin-error">{error}</div>}

        <button className="btn-primary signin-btn" onClick={submit}>
          Sign in
        </button>

        <div className="signin-foot">No password needed · authorized team only{version ? ` · ${version}` : ""}</div>
      </div>
    </div>
  );
};
