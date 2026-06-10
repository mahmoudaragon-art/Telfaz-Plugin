/* Generate the plugin's panel/manifest icons: a retro TV with a bold "T".
   Run with `npm run icons`. Outputs PNGs into public/icons (copied to dist). */
import sharp from "sharp";
import { mkdirSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const outDir = resolve(here, "../public/icons");
mkdirSync(outDir, { recursive: true });

/** Retro TV + "T". `stroke` = body/line color, `screen` = screen fill,
 *  `t` = letter color, `bg` = rounded backdrop (for the colored app icon). */
const tvSVG = ({ stroke, screen = "none", t = stroke, bg = "none" }) => `
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 48 48">
  <rect width="48" height="48" rx="11" fill="${bg}"/>
  <!-- antenna -->
  <path d="M19 9 L24 16 L29 9" fill="none" stroke="${stroke}" stroke-width="2.4"
        stroke-linecap="round" stroke-linejoin="round"/>
  <circle cx="19" cy="8.2" r="1.7" fill="${stroke}"/>
  <circle cx="29" cy="8.2" r="1.7" fill="${stroke}"/>
  <!-- tv body -->
  <rect x="7" y="16" width="34" height="25" rx="5" fill="none" stroke="${stroke}" stroke-width="2.6"/>
  <!-- screen -->
  <rect x="11" y="20" width="20" height="17" rx="2.5" fill="${screen}" stroke="${stroke}" stroke-width="2"/>
  <!-- bold T on the screen -->
  <path d="M15 24.6 H27 M21 24.6 V33" stroke="${t}" stroke-width="2.6" stroke-linecap="round"/>
  <!-- knobs -->
  <circle cx="36" cy="23" r="1.8" fill="${stroke}"/>
  <circle cx="36" cy="30" r="1.8" fill="${stroke}"/>
</svg>`;

const darkThemeIcon = tvSVG({ stroke: "#ececf2" }); // light icon for dark UI
const lightThemeIcon = tvSVG({ stroke: "#202028" }); // dark icon for light UI
const pluginIcon = tvSVG({ stroke: "#ffffff", screen: "#ff5c1a", t: "#0a0a0c", bg: "#141418" });

const render = (svg, size, file) =>
  sharp(Buffer.from(svg)).resize(size, size).png().toFile(resolve(outDir, file));

await Promise.all([
  render(darkThemeIcon, 23, "dark.png"),
  render(darkThemeIcon, 46, "dark@2x.png"),
  render(lightThemeIcon, 23, "light.png"),
  render(lightThemeIcon, 46, "light@2x.png"),
  render(pluginIcon, 48, "plugin-icon.png"),
  render(pluginIcon, 96, "plugin-icon@2x.png"),
]);

console.log("✓ icons written to", outDir);
