# NACT — Smart Cube Trainer

A speedcubing training app built around **Bluetooth smart cubes**: every
physical turn of your cube is tracked live, so scrambles verify themselves,
timers start and stop on their own, method stages are detected as you solve,
and the case trainers can tell you — exactly — how many moves you used
versus the optimal solution.

Runs entirely in the browser. No backend, no accounts — everything is
stored locally (`localStorage`).

## Modes

| Tab | What it does |
|---|---|
| **Solve** | Timed speedsolves: random-state scrambles, live scramble tracking with wrong-move repair, automatic start/stop, live CFOP / Roux / LBL stage detection, per-stage recognition/execution breakdown with 3D playback, sessions and statistics. |
| **Training** | Algorithm drills (F2L / OLL / PLL case browser): pick cases, execute them on the physical cube, per-variant timing and learning status. |
| **Attack** | OLL/PLL/F2L "attack": execute every case of a group in a reorderable queue against one continuous session timer. |
| **Trainer** | Case trainers with **known-optimal scrambles** (see below). |
| **Settings** | Data export/import, preferences. |

### The Case Trainer

Every scramble is generated so that the trained target has an **exactly
known optimal solution length**. You solve on the physical cube; the app
detects completion the instant the target state is reached, stops the
timer, and tells you `your moves / optimal` — you don't have to follow the
optimal solution, but you'll know when you beat it or missed it.

| Family | Types | Levels |
|---|---|---|
| **CFOP** | Cross · XCross · XXCross · Free Pair · EOCross | cross 1–8, xcross/xxcross/eocross 1–10, pair 1–9 |
| **Roux** | FS · FB · FB+DR · SS · CMLL · EOLR | fs 2–6, fb 3–8, fbdr 2–7, ss 3–10, eolr 3–10, cmll case-based |

Extras: on-demand **hint** (first move of an optimal solution from your
*current* mid-solve state), **reveal full solution(s)**, **retry the exact
same case** (fresh scramble, same target state), **ladder mode**
(auto-raises the level once you're ≥80% optimal over 10 attempts),
wasted-move analysis (cross), and **STM-fair counting** for Roux (a
physical M turn reaches the app as two face turns and is counted as one).

A key design choice: the next scramble is generated **from wherever your
cube currently is** — a trainer attempt deliberately ends with the cube
unsolved, so there is no re-solving between attempts. Start each session
from a solved cube; the *Resync* button recovers from any tracking drift.

## Requirements

- A browser with **Web Bluetooth**: Chrome, Edge or Opera (desktop or
  Android). Firefox and Safari do not support Web Bluetooth.
- A supported smart cube — anything
  [smartcube-web-bluetooth](https://github.com/poliva/smartcube-web-bluetooth)
  speaks: **GAN, MoYu (incl. AI v10/32), QiYi, Giiker, GoCube/Rubik's
  Connected, XMD Tornado V4**, and compatible.
- [Bun](https://bun.sh) (package manager / test runner).

The app also works without a cube for browsing algorithms and revealing
trainer solutions — but the live tracking features are the point.

## Running

```sh
bun install
bun run dev        # dev server at http://localhost:5173
```

Other commands:

```sh
bun test           # unit tests
bun run build      # type-check + production build into dist/
bun run preview    # serve the production build
```

First use: open the app in Chrome/Edge, press **Cube** (top right), pick
your cube from the Bluetooth chooser, and make sure the physical cube is
**solved** before starting a session. Note: the heavier trainer engines
(XCross/XXCross/Pair/EOCross) build large in-memory tables on first use —
a few seconds and a few hundred MB of RAM in their workers.

## Credits & prior art

This app stands on the shoulders of the cubing open-source community:

- **[cubing.js](https://js.cubing.net/)** (`MPL-2.0 OR GPL-3.0-or-later`) —
  puzzle model (kpuzzle), 3D visualisation (twisty), random-state scramble
  generation and the solver used to compose trainer scrambles.
- **[smartcube-web-bluetooth](https://github.com/poliva/smartcube-web-bluetooth)**
  by Pau Oliva (MIT) — the Bluetooth smart-cube layer: one unified move
  stream across all supported cube brands.
- **[RubiksSolverDemo](https://github.com/or18/RubiksSolverDemo)** by or18
  (GPL-3.0) — the CFOP case-trainer concept (exact-depth scramble
  generation) and the vendored WASM engines in `public/trainers/`
  (xcross, xxcross, free pair, eocross).
- **[roux-trainers](https://github.com/onionhoney/roux-trainers)** by
  onionhoney (GPL-3.0) — the Roux trainer concepts and the vendored
  pure-TypeScript solver library in `src/vendor/roux/` (FB/FS/FBDR/SS/EOLR
  solvers, min2phase, CMLL reference algorithms).
- **[csTimer](https://cstimer.net/)** — long-time inspiration for timer UX
  and statistics conventions.

## License

**GPL-3.0** — see [LICENSE](./LICENSE).

The app bundles GPL-3.0 components (the or18 WASM engines and the
roux-trainers solver library, see above), which makes the combined work
GPL-3.0 as a whole. All other dependencies (MIT/ISC/Apache-2.0/MPL-2.0)
are GPL-compatible. Vendored code keeps its upstream license files
(`public/trainers/LICENSE`, `src/vendor/roux/LICENSE`) and in-file change
notices.

Commercial use is permitted by the GPL — but any distribution (including
serving the app to browsers) must make the complete corresponding source
available under the same license. A proprietary build would require
replacing the two GPL surfaces first; both are isolated behind single
service modules (`src/services/or18TrainerWorkers.ts`,
`src/services/rouxTrainerService.ts`) for exactly that reason.

"Rubik's Cube" is a trademark of its respective owner; this project is not
affiliated with or endorsed by it.
