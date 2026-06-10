/* Per-client logos. Bundled into the webview (single-file build) so they always
   render regardless of the plugin path. To add a client logo: drop the file in
   webview-ui/src/assets/clients/, import it here, and add it to `clientLogos`. */
import Budget from "../assets/clients/Budget.webp";
import Nava from "../assets/clients/Nava.png";
import Noug from "../assets/clients/Noug.png";
import NEO from "../assets/clients/NEO.png";
import SNB from "../assets/clients/SNB.png";
import GWM from "../assets/clients/GWM.png";

export const clientLogos: Record<string, string> = {
  Budget,
  Nava,
  Noug,
  NEO,
  SNB,
  GWM,
};

/** Clients whose logo art isn't white — recolor to white for the dark UI. */
export const whiteClients = new Set(["Budget", "Noug", "NEO"]);
