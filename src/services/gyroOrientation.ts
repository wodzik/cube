/**
 * The smart cube's gyro, the app's side — the work is cubecore's
 * (SmartCubeSession: calibration "as shown", drift, other brands' axes;
 * GripRecorder: grips and rotations by stream position):
 *
 * - Calibration: the first gyro view a session is shown in calibrates it
 *   ("held as shown", that view's orientation); "Reset gyro" = held as the
 *   view on screen now shows it. Later views keep the calibration — the
 *   orientation is absolute (identity = white top, green front).
 * - Axes: a cube whose brand reports its gyro unlike GAN keeps its own
 *   correction (My cubes / Debug → Gyroscope), applied on connecting.
 * - One GripRecorder per session: the rotations of a solve (SolvePage), the
 *   live grip (Debug).
 */

import { DEFAULT_AXES_SPEC, GripRecorder, IDENTITY, type Quat, type SmartCubeSession } from "@wodzik/cubecore/bluetooth";

const calibrated = new WeakSet<SmartCubeSession>();
const recorders = new WeakMap<SmartCubeSession, GripRecorder>();

/** The session's grips (followed from the first call on — call it on connecting). */
export function gripRecorder(session: SmartCubeSession): GripRecorder {
  let r = recorders.get(session);
  if (!r) {
    r = new GripRecorder(session);
    recorders.set(session, r);
  }
  return r;
}

/** This cube's axis correction ("x,y,z" = as GAN). */
export function applyAxes(session: SmartCubeSession, spec: string | undefined): void {
  session.setAxes(spec || DEFAULT_AXES_SPEC);
}

/** "The cube is held as `shown` now" (a view's orientation; identity = white top, green front). */
export function calibrateAs(session: SmartCubeSession, shown: Quat = IDENTITY): void {
  session.calibrate(shown);
  calibrated.add(session);
  recorders.get(session)?.reset();
}

/** Calibrated on purpose on this connection (else the first reading counts as held white top, green front). */
export const isCalibrated = (session: SmartCubeSession) => calibrated.has(session);

let shownView: Quat = IDENTITY;
/** The gyro view on screen shows the cube in `shown` ("Reset gyro" = held like that); returns the undo. */
export function setShownView(shown: Quat): () => void {
  shownView = shown;
  return () => {
    if (shownView === shown) shownView = IDENTITY;
  };
}
/** "Reset gyro": held as the view on screen shows it now. */
export const resetToShown = (session: SmartCubeSession) => calibrateAs(session, shownView);
