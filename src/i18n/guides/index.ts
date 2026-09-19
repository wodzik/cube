import type { GuideText } from "../guideText";
import { GETTING_STARTED_PL } from "./getting-started.pl";
import { LAYER_BY_LAYER_PL } from "./layer-by-layer.pl";
import { LAST_LAYER_PL } from "./last-layer.pl";
import { ZETA_SLOTTING_PL } from "./zeta-slotting.pl";
import { BEGINNER_F2L_PL } from "./beginner-f2l.pl";

/** Polish overlays by guide id — one file per guide. */
export const GUIDES_PL: Record<string, GuideText> = {
  "getting-started": GETTING_STARTED_PL,
  "layer-by-layer": LAYER_BY_LAYER_PL,
  "last-layer": LAST_LAYER_PL,
  "zeta-slotting": ZETA_SLOTTING_PL,
  "beginner-f2l": BEGINNER_F2L_PL,
};
