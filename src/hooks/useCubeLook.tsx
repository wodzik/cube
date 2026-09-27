/**
 * How the cube looks everywhere in the app: the skin (or "auto" — the one
 * that suits the connected smart cube, by its brand / name), stickers
 * (stickerless as the skin is, or stickered: raised / thin / flat) and the
 * finish (matte / UV). Persisted; read by every CubeVisualisation.
 *
 * A connected cube gets the skin that suits it (by its brand / name) unless
 * it has its own (Settings → My cubes); the other parts it sets (stickers,
 * finish, logo) replace the app's while it's connected. The app's skin is
 * for when no cube is connected. A logo (the app's, or an image you added)
 * can sit on the white centre.
 */

import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { SKINS, type Skin, type StickerStyle, withFinish, withStickers } from "@cubecore/skin";
import { useSmartCubeConnection } from "./useSmartCube";
import { type KnownCube, listCubes, onCubesChange } from "../services/cubeRegistry";
import { logoImage, onLogosChange } from "../services/logoStore";

const STORAGE_KEY = "nact_cube_look";

export type SkinName = keyof typeof SKINS;
export interface CubeLook {
  /** A skin name, or "auto": the connected cube's (the default skin when none is connected). */
  skin: SkinName | "auto";
  /** Stickered version of the skin, or "" for the skin as it is. */
  stickers: StickerStyle | "";
  /** Matte / UV-coated, or "" for the skin's own finish. */
  finish: "matte" | "uv" | "";
  /** Logo on the white centre: "" none, "app", or an added image's id (services/logoStore). */
  logo: string;
}

const DEFAULT_LOOK: CubeLook = { skin: "auto", stickers: "", finish: "", logo: "" };

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
  /** The connected cube's own look, when it has one. */
  cubeLook: Partial<CubeLook> | null;
}

const CubeLookContext = createContext<CubeLookValue | null>(null);

export function resolveSkin(look: CubeLook, autoSkin: SkinName): Skin {
  const base: Skin = SKINS[look.skin === "auto" ? autoSkin : look.skin];
  const image = logoImage(look.logo);
  // The logo on the white (U) centre, upright as the cube is usually held.
  const withLogo: Skin = image ? { ...base, decals: [...(base.decals ?? []), { select: { stickers: [4] }, image, size: 0.56, rotate: 2 }] } : base;
  const stickered = look.stickers ? withStickers(withLogo, look.stickers) : withLogo;
  return look.finish ? withFinish(stickered, look.finish) : stickered;
}

/**
 * The look for a connected cube: the app's, with the cube's own parts over
 * it — and its skin its own, or the one that suits it ("auto"), never the
 * app's (that's for when no cube is connected).
 */
export function lookForCube(app: CubeLook, own: Partial<CubeLook> | undefined): CubeLook {
  const set = Object.fromEntries(Object.entries(own ?? {}).filter(([, v]) => v !== undefined)) as Partial<CubeLook>;
  if (set.skin && set.skin !== "auto" && !(set.skin in SKINS)) delete set.skin;
  return { ...app, ...set, skin: set.skin ?? "auto" };
}

/** Mount inside SmartCubeProvider (it follows the connected cube for "auto"). */
export function CubeLookProvider({ children }: { children: ReactNode }) {
  const [look, setLookState] = useState<CubeLook>(readStored);
  const cube = useSmartCubeConnection();
  const autoSkin = (cube?.suggestedSkin as SkinName | null) ?? "default";
  const [cubes, setCubes] = useState<KnownCube[]>(listCubes);
  useEffect(() => onCubesChange(() => setCubes(listCubes())), []);
  const cubeLook = useMemo(() => {
    const own = cube?.cubeId ? cubes.find((c) => c.id === cube.cubeId)?.look : undefined;
    if (!own) return null;
    const set = Object.fromEntries(Object.entries(own).filter(([, v]) => v !== undefined)) as Partial<CubeLook>;
    if (set.skin && set.skin !== "auto" && !(set.skin in SKINS)) delete set.skin;
    return Object.keys(set).length ? set : null;
  }, [cube?.cubeId, cubes]);

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

  // Added / removed logo images: draw again.
  const [logosVersion, setLogosVersion] = useState(0);
  useEffect(() => onLogosChange(() => setLogosVersion((n) => n + 1)), []);
  const connected = !!cube?.session;
  const value = useMemo(
    () => ({ look, setLook, skin: resolveSkin(connected ? lookForCube(look, cubeLook ?? undefined) : look, autoSkin), autoSkin, cubeLook }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [look, setLook, autoSkin, cubeLook, connected, logosVersion]
  );
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
      cubeLook: null,
    }
  );
}
