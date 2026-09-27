/**
 * Logos for the cube's centre: the app's own mark, and images you add
 * yourself (kept in this browser only — e.g. your cube brand's logo; brand
 * logos are trademarks, so the app ships none). Chosen app-wide in Cube look
 * or per cube in My cubes.
 */

import appLogoSvg from "../../public/favicon.svg?raw";

const KEY = "nact_logos";
const EVENT = "nact-logos";
/** The app's own logo (the favicon mark). */
export const APP_LOGO = "app";

export interface StoredLogo {
  id: string;
  name: string;
  /** A small PNG data URL (scaled down when added). */
  image: string;
}

export function listLogos(): StoredLogo[] {
  try {
    const raw = JSON.parse(localStorage.getItem(KEY) ?? "[]") as StoredLogo[];
    return Array.isArray(raw) ? raw : [];
  } catch {
    return [];
  }
}

function save(logos: StoredLogo[]): void {
  localStorage.setItem(KEY, JSON.stringify(logos));
  window.dispatchEvent(new Event(EVENT));
}

export function onLogosChange(fn: () => void): () => void {
  window.addEventListener(EVENT, fn);
  return () => window.removeEventListener(EVENT, fn);
}

/** The image of a logo choice ("" none, "app", or a stored logo's id), or null. */
export function logoImage(choice: string | undefined): string | null {
  if (!choice) return null;
  if (choice === APP_LOGO) return appLogoSvg;
  return listLogos().find((l) => l.id === choice)?.image ?? null;
}

/** Add an image file as a logo: scaled to fit 256 px (a PNG that keeps transparency). */
export async function addLogo(file: File): Promise<StoredLogo> {
  const url = URL.createObjectURL(file);
  try {
    const img = await new Promise<HTMLImageElement>((resolve, reject) => {
      const i = new Image();
      i.onload = () => resolve(i);
      i.onerror = () => reject(new Error("Not an image the browser can read"));
      i.src = url;
    });
    const scale = Math.min(1, 256 / Math.max(img.naturalWidth || 256, img.naturalHeight || 256));
    const w = Math.max(1, Math.round((img.naturalWidth || 256) * scale));
    const h = Math.max(1, Math.round((img.naturalHeight || 256) * scale));
    const canvas = document.createElement("canvas");
    canvas.width = w;
    canvas.height = h;
    canvas.getContext("2d")!.drawImage(img, 0, 0, w, h);
    const logo: StoredLogo = { id: `l${Date.now().toString(36)}`, name: file.name.replace(/\.[^.]+$/, ""), image: canvas.toDataURL("image/png") };
    save([...listLogos(), logo]);
    return logo;
  } finally {
    URL.revokeObjectURL(url);
  }
}

export function removeLogo(id: string): void {
  save(listLogos().filter((l) => l.id !== id));
}
