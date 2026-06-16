/**
 * Publish a release end-to-end, all from here:
 *   1. bump version (package.json + plugin-meta.json)
 *   2. build the .ccx
 *   3. create a GitHub Release and upload the .ccx as an asset
 *   4. point plugin-meta.json → that asset's download URL
 *   5. commit + push
 * Everyone on an older version then gets the forced "Update required" screen
 * with a working Download button.
 *
 *   npm run publish 1.1     (→ V1.1)
 *   npm run publish 2       (→ V2)
 */
import fs from "node:fs";
import { execSync } from "node:child_process";

const REPO = "mahmoudaragon-art/Telfaz-Plugin";
const BRANCH = "webview-redesign"; // local branch that maps to remote main
const CCX = "ccx/com.bolt.uxp_PS.ccx";
const ASSET = "Telfaz-System.ccx"; // download name (no spaces)

const input = process.argv[2];
if (!/^\d+(\.\d+){0,2}$/.test(input || "")) {
  console.error("Usage: npm run publish <version>   e.g.  npm run publish 1.1");
  process.exit(1);
}
const parts = input.split(".").map(Number);
while (parts.length < 3) parts.push(0);
const v = parts.join(".");
const tag = "v" + v;

// GitHub token from the macOS keychain (same one git push uses).
const cred = execSync('printf "protocol=https\\nhost=github.com\\n\\n" | git credential fill', {
  encoding: "utf8",
});
const token = (cred.split("\n").find((l) => l.startsWith("password=")) || "").slice(9).trim();
if (!token) {
  console.error("No GitHub token found. Do a `git push` once so it's saved, then retry.");
  process.exit(1);
}
const hdr = { Authorization: `Bearer ${token}`, "User-Agent": "telfaz-release", Accept: "application/vnd.github+json" };
const writeJSON = (f, o) => fs.writeFileSync(f, JSON.stringify(o, null, 2) + "\n");

// 1) bump
const pkg = JSON.parse(fs.readFileSync("package.json", "utf8"));
pkg.version = v;
writeJSON("package.json", pkg);
const meta = JSON.parse(fs.readFileSync("plugin-meta.json", "utf8"));
meta.version = v;
writeJSON("plugin-meta.json", meta);

// 2) build
console.log(`\nBuilding v${v}…`);
execSync("cd webview-ui && npm run build", { stdio: "inherit" });
execSync("npm run ccx", { stdio: "inherit" });

// 3) create the GitHub Release
console.log(`\nCreating GitHub release ${tag}…`);
let rel = await (
  await fetch(`https://api.github.com/repos/${REPO}/releases`, {
    method: "POST",
    headers: { ...hdr, "Content-Type": "application/json" },
    body: JSON.stringify({ tag_name: tag, name: `Telfaz System ${tag}`, body: `Telfaz System ${tag}`, target_commitish: "main" }),
  })
).json();
if (!rel.id) {
  console.error("Release create failed:", rel.message || JSON.stringify(rel));
  process.exit(1);
}

// 4) upload the .ccx as a release asset
console.log("Uploading .ccx…");
const asset = await (
  await fetch(`https://uploads.github.com/repos/${REPO}/releases/${rel.id}/assets?name=${ASSET}`, {
    method: "POST",
    headers: { ...hdr, "Content-Type": "application/zip" },
    body: fs.readFileSync(CCX),
  })
).json();
if (!asset.browser_download_url) {
  console.error("Asset upload failed:", asset.message || JSON.stringify(asset));
  process.exit(1);
}

// 5) point plugin-meta.json at it + push
meta.downloadUrl = asset.browser_download_url;
writeJSON("plugin-meta.json", meta);
execSync(`git add -A && git commit -m "publish ${tag}" && git push origin ${BRANCH}:main`, { stdio: "inherit" });

console.log(`\n✓ Published ${tag}`);
console.log(`  Download: ${asset.browser_download_url}`);
console.log("  Everyone on an older version now gets the forced update with a working Download button.\n");
