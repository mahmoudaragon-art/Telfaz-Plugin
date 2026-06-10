import * as photoshop from "./photoshop";
import * as illustrator from "./illustrator";
import { uxp } from "../globals";
import * as uxpLib from "./uxp";
import * as brand from "../brand-layout/host";

const hostName =
  uxp?.host?.name.toLowerCase().replace(/\s/g, "") || ("" as string);

// prettier-ignore
let host = {} as
  & typeof uxpLib
  & typeof photoshop
  & typeof illustrator;

// The webview UI calls everything through this type-safe surface over Comlink.
// `brand` adds the Brand Layout operations (connect/place/verify/colors/T&C…).
export type API = typeof host & typeof uxpLib & typeof brand;

if (hostName.startsWith("photoshop")) host = photoshop;
if (hostName.startsWith("illustrator")) host = illustrator;

export const api = { ...uxpLib, ...host, ...brand };
