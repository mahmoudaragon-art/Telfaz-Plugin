import React from "react";

import * as webviewAPI from "./webview-api";
import { initWebview } from "./webview-setup";
import { BrandLayoutApp } from "./brand-layout/BrandLayoutApp";

// Establish the Comlink bridge to the UXP host once, at module load.
// `api` is the type-safe proxy to everything in src/api/api.ts (incl. the
// Brand Layout host operations). Every call on it is async over the bridge.
const { api } = initWebview(webviewAPI);

export const App = () => {
  return <BrandLayoutApp api={api} />;
};
