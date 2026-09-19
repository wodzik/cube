/**
 * One guide demo (data/guides' GuideDemo) as a cube: either a looping,
 * control-less player (single moves, triggers — LoopingCubeDemo) or a
 * player parked at the START of its scene with TwistyPlayer's own
 * play/scrub controls, so the reader plays the case at their own pace. A
 * demo with an empty alg is a static picture (checkpoints).
 *
 * Mounted only while on screen — see LoopingCubeDemo / useInView.
 */

import { useMemo, useState } from "react";
import { Hand } from "lucide-react";
import { CubeVisualisation } from "./CubeVisualisation";
import { LoopingCubeDemo } from "./LoopingCubeDemo";
import { VariantTest } from "./VariantTest";
import { useInView } from "../hooks/useInView";
import { guideMask } from "../logic/guideMasks";
import type { GuideDemo } from "../data/guides";
import type { DisplayConfig } from "../types/algorithm";

/** VariantTest only reads stickering/camera from this — the visualization fields are filler to satisfy the type. */
const TRY_DISPLAY_CONFIG: DisplayConfig = {
  stickering: { kind: "named", value: "full" },
  cardVisualization: "3D",
  cubeVisualization: "3D",
  cameraLatitude: 20,
  cameraLongitude: 20,
};

interface GuideCubeDemoProps {
  demo: GuideDemo;
  /** Name shown in the "Try this" popup's header. */
  tryTitle?: string;
  className?: string;
}

function cameraLatitude(view: GuideDemo["view"]): number {
  return view === "bottom" ? -35 : 25;
}

export function GuideCubeDemo({ demo, tryTitle, className = "" }: GuideCubeDemoProps) {
  const mask = useMemo(() => (demo.mask ? guideMask(demo.mask) : undefined), [demo.mask]);
  const [ref, inView] = useInView<HTMLDivElement>();
  const [showTry, setShowTry] = useState(false);

  if (demo.loop) {
    return (
      <div className={className}>
        <LoopingCubeDemo alg={demo.alg} setupAlg={demo.setup} repeat={demo.repeat} label={demo.label} mask={mask} cameraLatitude={cameraLatitude(demo.view)} />
        {demo.tryOnCube && <TryButton title={tryTitle ?? demo.label ?? demo.alg} alg={demo.alg} open={showTry} onOpen={() => setShowTry(true)} onClose={() => setShowTry(false)} />}
      </div>
    );
  }

  const isStatic = demo.alg.trim() === "";
  return (
    <div className={`flex flex-col items-center gap-2 ${className}`}>
      <div ref={ref} className={`w-full rounded-xl border border-white/[0.08] p-2 ${isStatic ? "aspect-square" : "aspect-[4/5]"}`}>
        {inView && (
          <CubeVisualisation
            visualization="3D"
            background="none"
            controlPanel={isStatic ? "none" : "bottom-row"}
            dragInput="none"
            setupAlg={demo.setup}
            setupAnchor="start"
            alg={demo.alg}
            tempoScale={2}
            stickeringMaskOrbits={mask}
            cameraLatitude={cameraLatitude(demo.view)}
            cameraLongitude={25}
            className="size-full"
          />
        )}
      </div>
      {demo.label && <span className="text-xs text-gray-400 text-center">{demo.label}</span>}
      {demo.tryOnCube && !isStatic && (
        <TryButton title={tryTitle ?? demo.label ?? demo.alg} alg={demo.alg} open={showTry} onOpen={() => setShowTry(true)} onClose={() => setShowTry(false)} />
      )}
    </div>
  );
}

function TryButton({ title, alg, open, onOpen, onClose }: { title: string; alg: string; open: boolean; onOpen: () => void; onClose: () => void }) {
  return (
    <>
      <button onClick={onOpen} className="btn-secondary text-xs" title="Practise this on a connected smart cube">
        <Hand size={13} /> Try this
      </button>
      {open && <VariantTest caseName={title} variantName={alg} alg={alg} displayConfig={TRY_DISPLAY_CONFIG} onClose={onClose} />}
    </>
  );
}
