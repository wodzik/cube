import type { Guide } from "./types";
import { GETTING_STARTED_GUIDE } from "./getting-started";
import { LAYER_BY_LAYER_GUIDE } from "./layer-by-layer";
import { LAST_LAYER_GUIDE } from "./last-layer";
import { BEGINNER_F2L_GUIDE } from "./beginner-f2l";

export type { Guide, GuideBlock, GuideCase, GuideDemo, GuideSection } from "./types";

/** Index order = learning order. */
export const GUIDES: Guide[] = [GETTING_STARTED_GUIDE, LAYER_BY_LAYER_GUIDE, LAST_LAYER_GUIDE, BEGINNER_F2L_GUIDE];

export function guideById(id: string): Guide | undefined {
  return GUIDES.find((g) => g.id === id);
}
