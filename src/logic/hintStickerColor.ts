/**
 * Workaround for cubing.js #394 (open): Cube3D's floating hint ("back")
 * stickers are semi-transparent copies of the real colour, and masked-out
 * ("ignored") ones are a light grey (#ccc). So a WHITE back sticker is barely
 * visible on the light theme, and on the dark theme it looks exactly like an
 * ignored one.
 *
 * We recolour two of Cube3D's hint materials per theme:
 *   - white   → high contrast, nearly opaque (blue-grey on light, white on dark)
 *   - ignored → low contrast, fading into the page
 * Cube3D shares its materials across players and swaps them on every
 * stickering-mask change, so each player's scene is rescanned on every
 * scheduled render (a cheap walk over ~130 meshes); newly seen materials are
 * classified by their ORIGINAL colour and restyled. Follows <html data-theme>.
 *
 * Relies on cubing.js internals (experimentalCurrentThreeJSPuzzleObject and
 * the library's hint colours): if they change, nothing matches and the
 * library's own colours stay.
 */

import type { TwistyPlayer } from "cubing/twisty";

type Kind = "white" | "ignored";
type Theme = "light" | "dark";

const STYLE: Record<Kind, Record<Theme, { color: number; opacity: number }>> = {
  white: { light: { color: 0x6f7b8a, opacity: 0.9 }, dark: { color: 0xffffff, opacity: 0.9 } },
  ignored: { light: { color: 0xe6e6e6, opacity: 0.5 }, dark: { color: 0x333333, opacity: 0.6 } },
};

interface ThreeMaterial {
  side: number;
  transparent: boolean;
  opacity: number;
  needsUpdate: boolean;
  color?: { r: number; g: number; b: number; setHex(hex: number): void };
}

const BACK_SIDE = 1; // three.js BackSide — hint stickers are drawn from behind
const known = new Map<ThreeMaterial, Kind | null>();
const hooked = new WeakSet<TwistyPlayer>();
/** Players to redraw after a theme change (pruned once they leave the page). */
const live = new Set<TwistyPlayer>();
let observing = false;

function theme(): Theme {
  return document.documentElement.getAttribute("data-theme") === "light" ? "light" : "dark";
}

/** From the library's colour as three.js stores it: white hint = 1.0, ignored hint (#ccc) = 0.8. */
function classify(m: ThreeMaterial): Kind | null {
  if (m.side !== BACK_SIDE || !m.transparent || !m.color) return null;
  const { r, g, b } = m.color;
  if (Math.abs(r - g) > 0.002 || Math.abs(g - b) > 0.002) return null;
  if (r > 0.99) return "white";
  if (r > 0.79 && r < 0.81) return "ignored";
  return null;
}

function style(m: ThreeMaterial, kind: Kind): void {
  const s = STYLE[kind][theme()];
  m.color!.setHex(s.color);
  m.opacity = s.opacity;
  m.needsUpdate = true;
}

function scan(object: { traverse(fn: (node: unknown) => void): void }): void {
  object.traverse((node) => {
    const m = (node as { material?: ThreeMaterial }).material;
    if (!m || known.has(m)) return;
    const kind = classify(m);
    known.set(m, kind);
    if (kind) style(m, kind);
  });
}

function restyleAll(): void {
  for (const [m, kind] of known) if (kind) style(m, kind);
  // Material changes only show on the next render — force one, or the old
  // theme's colours linger until the cube is next moved.
  for (const player of live) {
    if (!player.isConnected) {
      live.delete(player);
      continue;
    }
    player
      .experimentalCurrentVantages()
      .then((vantages) => {
        for (const v of vantages) (v as unknown as { scheduleRender?: () => void }).scheduleRender?.();
      })
      .catch(() => {});
  }
}

/** Call once per Cube3D player (idempotent). */
export function adaptHintStickerColors(player: TwistyPlayer): void {
  if (hooked.has(player)) return;
  hooked.add(player);
  live.add(player);
  let object: { traverse(fn: (node: unknown) => void): void } | null = null;
  player
    .experimentalCurrentThreeJSPuzzleObject(() => {
      if (object) scan(object);
    })
    .then((o) => {
      object = o as unknown as typeof object;
      scan(object!);
      if (!observing) {
        observing = true;
        new MutationObserver(restyleAll).observe(document.documentElement, { attributes: true, attributeFilter: ["data-theme"] });
      }
    })
    .catch(() => {
      // cubing.js internals changed — keep the library's colours.
    });
}
