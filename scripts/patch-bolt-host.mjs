/**
 * Ensure vite-uxp-plugin writes `host` as an ARRAY in each per-app .ccx
 * manifest. The stock plugin writes a single object, which the Adobe installer
 * (UPIA) rejects with "Compatible app required". Run before packaging (wired
 * into the "ccx"/"zip" npm scripts). Idempotent + survives `npm install`.
 */
import fs from "node:fs";

const FILE = "node_modules/vite-uxp-plugin/lib/ccx.js";
const FROM = "{ id: uniqueId, host, entrypoints:";
const TO = "{ id: uniqueId, host: [host], entrypoints:";

try {
  let src = fs.readFileSync(FILE, "utf8");
  if (src.includes(TO)) {
    console.log("✓ vite-uxp-plugin already patched (host array)");
  } else if (src.includes(FROM)) {
    fs.writeFileSync(FILE, src.replace(FROM, TO));
    console.log("✓ patched vite-uxp-plugin: .ccx host → [host]");
  } else {
    console.warn(
      "⚠ vite-uxp-plugin ccx.js changed — host patch NOT applied. Verify the .ccx manifest `host` is an array, or the installer may reject it.",
    );
  }
} catch (e) {
  console.warn("⚠ could not patch vite-uxp-plugin:", e.message);
}
