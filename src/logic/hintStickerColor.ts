/**
 * Workaround for cubing.js #394 (open): Cube3D's floating hint ("back")
 * stickers are semi-transparent copies of the real colour, so the WHITE ones
 * vanish against the light theme's near-white page. Cube3D shares one hint
 * material per face colour across every player on the page, so we find the
 * white one once, through the experimental three.js object, and recolour it
 * for the current theme (following <html data-theme> changes).
 *
 * Relies on cubing.js internals: if a future version changes them, the
 * lookup simply finds nothing and the library's own colours stay.
 */

import type { TwistyPlayer } from "cubing/twisty";

/** Light theme: a blue-grey that reads as "the white face" yet stays distinct from ignored stickers (#ccc). */
const LIGHT_THEME_WHITE_HINT = { color: 0x9aa3ae, opacity: 0.85 };

interface HintMaterial {
  side: number;
  transparent: boolean;
  opacity: number;
  needsUpdate: boolean;
  color: { r: number; g: number; b: number; setHex(hex: number): void; getHex(): number };
}

let whiteHint: { material: HintMaterial; original: { color: number; opacity: number } } | null = null;
let lookup: Promise<void> | null = null;
let observing = false;

function currentTheme(): "light" | "dark" {
  return document.documentElement.getAttribute("data-theme") === "light" ? "light" : "dark";
}

function apply(): void {
  if (!whiteHint) return;
  const { material, original } = whiteHint;
  const target = currentTheme() === "light" ? LIGHT_THEME_WHITE_HINT : original;
  material.color.setHex(target.color);
  material.opacity = target.opacity;
  material.needsUpdate = true;
}

const BACK_SIDE = 1; // three.js BackSide — hint stickers are drawn from behind

/** Call for every Cube3D player; the (shared) material is only looked up until it's found once. */
export function adaptHintStickerColors(player: TwistyPlayer): void {
  if (whiteHint || lookup) return;
  lookup = player
    .experimentalCurrentThreeJSPuzzleObject()
    .then((object) => {
      object.traverse((node) => {
        const material = (node as unknown as { material?: HintMaterial }).material;
        if (whiteHint || !material?.color || material.side !== BACK_SIDE || !material.transparent) return;
        const { r, g, b } = material.color;
        if (r > 0.99 && g > 0.99 && b > 0.99) {
          whiteHint = { material, original: { color: material.color.getHex(), opacity: material.opacity } };
        }
      });
      apply();
      if (whiteHint && !observing) {
        observing = true;
        new MutationObserver(apply).observe(document.documentElement, { attributes: true, attributeFilter: ["data-theme"] });
      }
    })
    .catch(() => {
      // cubing.js internals changed — keep the library's colours.
    })
    .finally(() => {
      if (!whiteHint) lookup = null; // let a later player try again
    });
}
