import React, { useState } from "react";

import * as webviewAPI from "./webview-api";
import { initWebview } from "./webview-setup";
import { BrandLayoutApp } from "./brand-layout/BrandLayoutApp";

export const App = () => {
  // Establish the Comlink bridge to the UXP host exactly once, at first
  // render (when window.uxpHost has been injected by UXP). `api` is the
  // type-safe proxy to src/api/api.ts; every call on it is async.
  const [{ api }] = useState(() => initWebview(webviewAPI));
  return <BrandLayoutApp api={api} />;
};
