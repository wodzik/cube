/**
 * How the cube looks everywhere in the app: the skin (or "auto" — the one
 * that suits the connected smart cube, by its brand / name), stickers
 * (stickerless as the skin is, or stickered: raised / thin / flat) and the
 * finish (matte / UV). Persisted; read by every CubeVisualisation.
 */

import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from "react";
import { SKINS, type Skin, type StickerStyle, withFinish, withStickers } from "@cubecore/skin";
import { useSmartCubeConnection } from "./useSmartCube";

const STORAGE_KEY = "nact_cube_look";

export type SkinName = keyof typeof SKINS;
export interface CubeLook {
  /** A skin name, or "auto": the connected cube's (the default skin when none is connected). */
  skin: SkinName | "auto";
  /** Stickered version of the skin, or "" for the skin as it is. */
  stickers: StickerStyle | "";
  /** Matte / UV-coated, or "" for the skin's own finish. */
  finish: "matte" | "uv" | "";
}

const DEFAULT_LOOK: CubeLook = { skin: "auto", stickers: "", finish: "" };

function readStored(): CubeLook {
  try {
    const raw = JSON.parse(localStorage.getItem(STORAGE_KEY) ?? "null") as Partial<CubeLook> | null;
    const look = { ...DEFAULT_LOOK, ...raw };
    if (look.skin !== "auto" && !(look.skin in SKINS)) look.skin = "auto";
    return look;
  } catch {
    return DEFAULT_LOOK;
  }
}

interface CubeLookValue {
  look: CubeLook;
  setLook: (patch: Partial<CubeLook>) => void;
  /** The skin to draw with. */
  skin: Skin;
  /** Which skin "auto" resolved to (for the settings page). */
  autoSkin: SkinName;
}

const CubeLookContext = createContext<CubeLookValue | null>(null);

export function resolveSkin(look: CubeLook, autoSkin: SkinName): Skin {
  const base: Skin = SKINS[look.skin === "auto" ? autoSkin : look.skin];
  const stickered = look.stickers ? withStickers(base, look.stickers) : base;
  return look.finish ? withFinish(stickered, look.finish) : stickered;
}

/** Mount inside SmartCubeProvider (it follows the connected cube for "auto"). */
export function CubeLookProvider({ children }: { children: ReactNode }) {
  const [look, setLookState] = useState<CubeLook>(readStored);
  const cube = useSmartCubeConnection();
  const autoSkin = (cube?.suggestedSkin as SkinName | null) ?? "default";

  const setLook = useCallback((patch: Partial<CubeLook>) => {
    setLookState((prev) => {
      const next = { ...prev, ...patch };
      try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
      } catch {
        // localStorage unavailable — the choice just won't persist.
      }
      return next;
    });
  }, []);

  const value = useMemo(() => ({ look, setLook, skin: resolveSkin(look, autoSkin), autoSkin }), [look, setLook, autoSkin]);
  return <CubeLookContext.Provider value={value}>{children}</CubeLookContext.Provider>;
}

/** The look; outside the provider (e.g. a shared-solve preview) the default skin. */
export function useCubeLook(): CubeLookValue {
  return (
    useContext(CubeLookContext) ?? {
      look: DEFAULT_LOOK,
      setLook: () => undefined,
      skin: SKINS.default,
      autoSkin: "default",
    }
  );
}
