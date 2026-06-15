import { UXP_Manifest, UXP_Config, UXP_Config_Extra } from "vite-uxp-plugin";
import { version } from "./package.json";

const extraPrefs: UXP_Config_Extra = {
  hotReloadPort: 8080,
  webviewUi: true,
  webviewReloadPort: 8082,
  copyZipAssets: ["public-zip/*"],
  uniqueIds: true,
  debugger: "udt",
};

export const id = "com.bolt.uxp"; 
const name = "Telfaz System"; 

const manifest: UXP_Manifest = {
  id,
  name,
  version,
  main: "index.html",
  // manifestVersion 5 is the common denominator: Photoshop AND Illustrator
  // both support it. (v6 is Photoshop-only, which hid the plugin in Illustrator.)
  manifestVersion: 5,
  // host entries carry a `data` block (apiVersion 2 = UXP v2 API). The Adobe
  // installer needs this to generate the extension metadata; without it the
  // .ccx fails with "manifest invalid" / "compatible app required".
  host: [
    {
      app: "PS",
      minVersion: "24.2.0",
      data: { apiVersion: 2, loadEvent: "use" },
    },
    {
      app: "AI",
      minVersion: "26.0",
      data: { apiVersion: 2, loadEvent: "use" },
    },
  ] as any,
  entrypoints: [
    {
      type: "panel",
      id: `${id}.main`,
      label: {
        default: name,
      },
      minimumSize: { width: 230, height: 200 },
      maximumSize: { width: 2000, height: 2000 },
      preferredDockedSize: { width: 230, height: 300 },
      preferredFloatingSize: { width: 450, height: 400 },
      icons: [
        {
          width: 23,
          height: 23,
          path: "icons/panel.png",
          scale: [1, 2],
          theme: ["darkest", "dark", "medium", "lightest", "light", "all"],
        },
      ],
    },


    // * Example of a UXP Secondary panel
    // * Must also enable the <uxp-panel panelid="bolt.uxp.plugin.settings">
    //* tag in your entrypoint (.tsx, .vue, or .svelte) file
    // {
    //   type: "panel",
    //   id: `${id}.settings`,
    //   label: {
    //     default: `${name} Settings`,
    //   },
    //   minimumSize: { width: 230, height: 200 },
    //   maximumSize: { width: 2000, height: 2000 },
    //   preferredDockedSize: { width: 230, height: 300 },
    //   preferredFloatingSize: { width: 230, height: 300 },
    //   icons: [
    //     {
    //       width: 23,
    //       height: 23,
    //       path: "icons/dark-panel.png",
    //       scale: [1, 2],
    //       theme: ["darkest", "dark", "medium"],
    //       species: ["chrome"],
    //     },
    //     {
    //       width: 23,
    //       height: 23,
    //       path: "icons/light-panel.png",
    //       scale: [1, 2],
    //       theme: ["lightest", "light"],
    //       species: ["chrome"],
    //     },
    //   ],
    // },

    // * Example of a UXP Command
    // {
    //   type: "command",
    //   id: "showAbout",
    //   label: {
    //     default: "Bolt UXP Command",
    //   },
    // },

  ],
  featureFlags: {
    enableAlerts: true,
  },
  requiredPermissions: {
    localFileSystem: "fullAccess",
    launchProcess: {
      schemes: ["https", "slack", "file", "ws"],
      extensions: [".xd", ".psd", ".bat", ".cmd", ""],
    },
    network: {
      domains: [
        "https://hyperbrew.co",
        "https://github.com",
        "https://raw.githubusercontent.com", // plugin-meta.json (update check + sign-in list)
        "https://vitejs.dev",
        "https://svelte.dev",
        "https://reactjs.org",
        "https://vuejs.org/",
        `ws://localhost:${extraPrefs.hotReloadPort}`, // Required for hot reload
        `http://localhost:${extraPrefs.webviewReloadPort}`, // Webview dev server
      ],
    },
    clipboard: "readAndWrite",
    webview: {
      allow: "yes",
      allowLocalRendering: "yes",
      domains: "all",
      enableMessageBridge: "localAndRemote",
    },
    ipc: {
      enablePluginCommunication: true,
    },
    allowCodeGenerationFromStrings: true,

  },
    icons: [
    {
      width: 48,
      height: 48,
      path: "icons/plugin-icon.png",
      scale: [1, 2],
      theme: ["darkest", "dark", "medium", "lightest", "light"],
      species: ["pluginList"],
    },
  ],
};

export const config: UXP_Config = {
  manifest,
  ...extraPrefs,
};
