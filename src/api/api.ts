import * as photoshop from "./photoshop"; 
import * as illustrator from "./illustrator"; 
import { uxp } from "../globals";
import * as uxpLib from "./uxp";

const hostName =
  uxp?.host?.name.toLowerCase().replace(/\s/g, "") || ("" as string);

// prettier-ignore
let host = {} as 
  & typeof uxpLib 
  & typeof photoshop 
  & typeof illustrator; 

export type API = typeof host & typeof uxpLib;

if (hostName.startsWith("photoshop")) host = photoshop; 
if (hostName.startsWith("illustrator")) host = illustrator; 

export const api = { ...uxpLib, ...host };
