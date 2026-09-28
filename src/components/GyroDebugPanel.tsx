/**
 * GyroDebugPanel (Debug → Gyroscope) — the connected cube's gyro as the
 * rotation counting reads it: the grip right now (top / front), the rotations
 * as they're detected, and this cube's axis correction — found by a short
 * detector (hold white top / green front, then an x, then a y) for brands
 * that report their gyro axes unlike GAN (services/gyroOrientation).
 */

import { useEffect, useState } from "react";
import type { Face } from "@wodzik/cubecore/core";
import { AXES_SPECS, DEFAULT_AXES_SPEC, IDENTITY_GRIP, type Quat, detectAxes, gripQuaternion, readGrip, rotateGrip } from "@wodzik/cubecore/bluetooth";
import { useSmartCubeConnection } from "../hooks/useSmartCube";
import { useGyro } from "../hooks/useGyro";
import { listCubes, updateCube } from "../services/cubeRegistry";
import { applyAxes, gripRecorder, resetToShown } from "../services/gyroOrientation";
import { CubeVisualisation } from "./CubeVisualisation";

const COLOUR: Record<Face, string> = { U: "white", D: "yellow", F: "green", B: "blue", R: "red", L: "orange" };

const STEPS = [
  "Hold the cube white top, green front — then Capture.",
  "Now an x: turn the whole cube so the green front comes up (white goes to the back). Hold still — Capture.",
  "Back to white top, green front, then a y: turn it so the red right side comes to the front. Hold still — Capture.",
];

export function GyroDebugPanel() {
  const conn = useSmartCubeConnection();
  const session = conn?.session ?? null;
  const cubeId = conn?.cubeId ?? null;
  const { supported } = useGyro();
  const [live, setLive] = useState<{ top: Face; front: Face; off: number } | null>(null);
  const [log, setLog] = useState<string[]>([]);
  const [axes, setAxesState] = useState(() => listCubes().find((c) => c.id === cubeId)?.gyroAxes ?? DEFAULT_AXES_SPEC);
  const [samples, setSamples] = useState<Quat[]>([]);
  const [result, setResult] = useState<{ spec: string; errorDeg: number }[] | null>(null);

  useEffect(() => {
    if (!session) return;
    let last = 0;
    const offAbs = session.on("orientation", (q) => {
      const now = performance.now();
      if (now - last < 100) return;
      last = now;
      const { grip, offDeg } = readGrip(q);
      setLive({ top: grip.face.U, front: grip.face.F, off: Math.round(offDeg) });
    });
    const offGrip = gripRecorder(session).onChange((h) => {
      if (h.rotation) setLog((l) => [`${h.rotation}  →  ${COLOUR[h.grip.face.U]} top, ${COLOUR[h.grip.face.F]} front`, ...l].slice(0, 30));
    });
    return () => {
      offAbs();
      offGrip();
    };
  }, [session]);

  if (!session) return <p className="p-6 text-sm text-gray-500">Connect a smart cube with a gyroscope.</p>;
  if (!supported) return <p className="p-6 text-sm text-gray-500">This cube reports no gyroscope.</p>;

  const chooseAxes = (spec: string) => {
    applyAxes(session, spec);
    setAxesState(spec);
    if (cubeId) updateCube(cubeId, { gyroAxes: spec === DEFAULT_AXES_SPEC ? undefined : spec });
  };

  const capture = () => {
    const raw = session.rawOrientation;
    if (!raw) return;
    const next = [...samples, raw];
    if (next.length < 3) {
      setSamples(next);
      setResult(null);
      return;
    }
    setSamples([]);
    setResult(detectAxes(next[0], next[1], next[2], gripQuaternion(rotateGrip(IDENTITY_GRIP, "x")), gripQuaternion(rotateGrip(IDENTITY_GRIP, "y"))).slice(0, 3));
  };

  const grip = gripRecorder(session).grip;

  return (
    <div className="flex flex-1 min-h-0 flex-col sm:flex-row">
      <div className="flex-none sm:w-72 xl:w-96 sm:border-r border-white/[0.06] flex flex-col items-center gap-3 p-6">
        <div className="w-full aspect-square">
          <CubeVisualisation visualization="3D" background="none" controlPanel="none" dragInput="none" followGyro="always" className="size-full" />
        </div>
        <button onClick={() => resetToShown(session)} className="btn-secondary text-xs" title="Hold it white top, green front, then press">
          Reset gyro (white top, green front)
        </button>
      </div>

      <div className="flex-1 overflow-y-auto p-6 space-y-6 text-sm">
        <section>
          <h3 className="text-[10px] font-semibold text-gray-400 uppercase tracking-widest mb-2">Held now</h3>
          {live ? (
            <p className="text-gray-200">
              <b>{COLOUR[live.top]}</b> top, <b>{COLOUR[live.front]}</b> front{" "}
              <span className={live.off > 35 ? "text-amber-400" : "text-gray-500"}>({live.off}° off square)</span>
            </p>
          ) : (
            <p className="text-gray-500">No gyro reading yet — move the cube.</p>
          )}
          {grip && (
            <p className="text-[11px] text-gray-500 mt-1">
              Counted grip: {COLOUR[grip.face.U]} top, {COLOUR[grip.face.F]} front (changes after it's held within 35° for 150 ms)
            </p>
          )}
        </section>

        <section>
          <h3 className="text-[10px] font-semibold text-gray-400 uppercase tracking-widest mb-2">Rotations detected</h3>
          {log.length === 0 ? (
            <p className="text-gray-500 text-xs">Rotate the whole cube — each x / y / z shows here.</p>
          ) : (
            <ul className="font-mono text-xs text-gray-300 space-y-0.5">
              {log.map((l, i) => (
                <li key={i}>{l}</li>
              ))}
            </ul>
          )}
        </section>

        <section>
          <h3 className="text-[10px] font-semibold text-gray-400 uppercase tracking-widest mb-2">Gyroscope axes (this cube)</h3>
          <p className="text-xs text-gray-500 mb-2">
            If the drawn cube turns the wrong way (common with non-GAN cubes), let the detector find the right axes: three captures.
          </p>
          <div className="rounded-lg bg-white/[0.03] p-3 space-y-2">
            <p className="text-xs text-gray-300">
              {samples.length + 1}/3 · {STEPS[samples.length]}
            </p>
            <div className="flex gap-2">
              <button onClick={capture} className="btn-primary text-xs">
                Capture
              </button>
              {samples.length > 0 && (
                <button onClick={() => setSamples([])} className="btn-secondary text-xs">
                  Start over
                </button>
              )}
            </div>
            {result && (
              <div className="text-xs space-y-1 pt-1">
                {result.map((r, i) => (
                  <div key={r.spec} className="flex items-center gap-2">
                    <span className="font-mono text-gray-200 w-24">{r.spec}</span>
                    <span className={r.errorDeg < 25 ? "text-emerald-400" : "text-amber-400"}>{Math.round(r.errorDeg)}° off</span>
                    {i === 0 && r.spec !== axes && (
                      <button onClick={() => chooseAxes(r.spec)} className="btn-secondary text-[11px] py-0.5">
                        Use
                      </button>
                    )}
                    {r.spec === axes && <span className="text-gray-500">in use</span>}
                  </div>
                ))}
                {result[0].errorDeg >= 25 && <p className="text-amber-400">Not a clean match — try again, holding the cube still at each capture.</p>}
              </div>
            )}
          </div>
          <label className="flex items-center gap-2 text-xs text-gray-400 mt-3">
            Axes
            <select
              value={axes}
              onChange={(e) => chooseAxes(e.target.value)}
              className="bg-gray-950/60 border border-white/10 rounded-lg px-2 py-1 text-xs text-gray-300 font-mono"
            >
              {AXES_SPECS.map((a) => (
                <option key={a} value={a}>
                  {a}
                  {a === DEFAULT_AXES_SPEC ? " (GAN)" : ""}
                </option>
              ))}
            </select>
          </label>
        </section>
      </div>
    </div>
  );
}
