import React, { useEffect } from "react";
import { webviewInitHost } from "./webview-setup-host";

/**
 * UXP-context shell.
 *
 * The entire Brand Layout UI now lives in the webview (webview-ui/), which gets
 * full HTML/CSS/JS support. This component runs in the restricted UXP context
 * and only boots the webview + exposes the host `api` bridge to it. It renders
 * nothing visible itself.
 */
export const App = () => {
  const webviewUI = import.meta.env.VITE_BOLT_WEBVIEW_UI === "true";
  useEffect(() => {
    if (webviewUI) {
      webviewInitHost({ multi: false }).catch((e) =>
        console.error("webviewInitHost failed", e),
      );
    }
  }, [webviewUI]);

  return <></>;
};
