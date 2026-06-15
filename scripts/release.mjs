/**
 * Cut a new release: bump the version in package.json + plugin-meta.json, then
 * build the distributable .ccx. Prints the remaining manual steps.
 *
 *   npm run release 1.1     (→ V1.1)
 *   npm run release 2       (→ V2)
 *   npm run release 2.2     (→ V2.2)
 */
import fs from "node:fs";
import { execSync } from "node:child_process";

const input = process.argv[2];
if (!/^\d+(\.\d+){0,2}$/.test(input || "")) {
  console.error("Usage: npm run release <version>   e.g.  npm run release 1.1  |  2  |  2.2");
  process.exit(1);
}
// Display is major.minor, but store a full 3-part semver (the installer needs it).
const parts = input.split(".").map(Number);
while (parts.length < 3) parts.push(0);
const v = parts.join(".");

const writeJSON = (file, obj) => fs.writeFileSync(file, JSON.stringify(obj, null, 2) + "\n");

// 1) bump package.json (the plugin reads its version from here)
const pkg = JSON.parse(fs.readFileSync("package.json", "utf8"));
const from = pkg.version;
pkg.version = v;
writeJSON("package.json", pkg);

// 2) bump plugin-meta.json version (the update check compares against this)
const meta = JSON.parse(fs.readFileSync("plugin-meta.json", "utf8"));
meta.version = v;
writeJSON("plugin-meta.json", meta);

console.log(`\nVersion ${from} → ${v}. Building…\n`);
execSync("cd webview-ui && npm run build", { stdio: "inherit" });
execSync("npm run ccx", { stdio: "inherit" });

console.log(`\n✓ Built ccx/com.bolt.uxp_PS.ccx (v${v})\n`);
console.log("Next steps to push it to the team:");
console.log("  1. Upload  ccx/com.bolt.uxp_PS.ccx  to Google Drive.");
console.log('  2. Paste the share link into plugin-meta.json → "downloadUrl".');
console.log('  3. git add -A && git commit -m "release ' + v + '" && git push origin webview-redesign:main');
console.log("\n  → Everyone on an older version sees the 'Update required' screen on next open.\n");
