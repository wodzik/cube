# (ANOTHER) Cube trainer

A speedcubing training app built around **Bluetooth smart cubes**: every
physical turn of your cube is tracked live, so scrambles verify themselves,
timers start and stop on their own, method stages and algorithm cases are
recognised as you solve, and the trainers can tell you — exactly — how many
moves you used versus the optimal solution.

Runs entirely in the browser at **[cubetrainer.cc](https://cubetrainer.cc)**.
No backend, no accounts — everything is stored locally in your browser.

## Pages

| Page | What it does |
|---|---|
| **Solve** | Timed speedsolves: random-state scrambles (one is always ready), live scramble tracking with wrong-move repair and turn arrows, automatic start / stop, CFOP / Roux / LBL stage detection, a per-stage recognition / execution breakdown with a 3D replay — the **case** each stage started from (F2L pair, OLL, PLL, CMLL), one click from its algorithms, and your cross against the optimal one — one click from practising that exact cross. Sessions, statistics, share links. |
| **Practice → Algorithms** | Algorithm sets (F2L, OLL, PLL, CMLL, COLL, ZBLL, VLS, … and your own): execute cases on the cube, times per algorithm, learning status. Built-in sets are fixed — add your own algorithms to their cases, pick the default, hide cases you don't use, or duplicate a set as your own (fully editable). |
| **Practice → Steps** | Step trainers with **known-optimal scrambles** (below), in *Scramble* mode (the case scrambled on your cube) or *Recognize* mode (the case on the screen, the time to your first turn measured). |
| **Practice → Blindfolded** | Old Pochmann blindfolded: letter schemes (Speffz, ruwix), memo from the cube, execution followed letter by letter, letters read aloud. |
| **Practice → Time Attack** | Every case of a set in one timed run. |
| **Versus** | Two smart cubes, one scramble, 3-2-1 and race. |
| **Analyze → Analyze a scramble** | A scramble through CFOP, Roux and ZZ, step by step (optimal cross / blocks, pairs, last-layer cases), each playable on the 3D cube — also opened from any of your solves. |
| **Analyze → Stats** | Per case: how often it came up in your solves and how fast you solved it, your drill times, your recognition times. Each case opens its algorithms with their stats — ⚡ the fastest, 🏆 the most consistent — and a Drill button. |
| **Academy** | Guides to learn solving, from the first layer to F2L. |
| **Settings** | Cube look (skins, stickers, finish, a logo of your own), your smart cubes each with its own settings, turn arrows, backup (export / import). |

### Steps — the step trainers

Every scramble is generated so that the trained target has an **exactly
known optimal solution length**. You solve on the physical cube; the app
detects completion the instant the target is reached, stops the timer, and
tells you `your moves / optimal` — with a hint (the first move of an optimal
solution from where you are now) and the optimal solutions afterwards.

| Family | Steps | Optimal lengths |
|---|---|---|
| **Cross+** | Cross · XCross · XXCross · Pair | 1–8 · 2–10 · 3–10 · 1–9 |
| **F2L** | Slots (random F2L, the other slots solved or free) | — |
| **LL** | OLL · PLL (by case group, random AUF) | — |
| **Roux** | FS · FB · FB+DR · SS · SB last slot · CMLL · EOLR · LSE | 2–6 · 3–8 · 2–7 · 3–10 · 2–9 · — · 3–10 · 3–12 |
| **ZZ** | EOLine · EOCross · Block | 2–9 · 3–10 · 3–10 |

Any colour down (colour neutral), retry of the exact same case, and
**Ladder**: after each attempt, if at least 80% of your last 10 at this
length were optimal, the next ones get one move longer.

The next scramble is generated **from wherever your cube is** — there is
no re-solving between attempts. *Mark as solved* recovers from any
tracking drift.

## Requirements

- A browser with **Web Bluetooth**: Chrome, Edge or Opera (desktop or
  Android). Firefox and Safari don't support Web Bluetooth.
- A supported smart cube: **GAN, MoYu, QiYi, GoCube / Rubik's Connected,
  Giiker** and compatible (see smartcube-web-bluetooth below).

The app also works without a cube — browsing and drilling algorithms on the
screen, Recognize mode, analysing scrambles — but the live tracking is the
point.

## Running

With [Bun](https://bun.sh):

```sh
bun install
bun run dev        # dev server at http://localhost:5173
bun test           # unit tests
bun run build      # type-check + production build into dist/
bun run preview    # serve the production build
```

Pushes to `main` are tested, built and deployed to GitHub Pages
(`.github/workflows/ci.yml`).

First use: open the app in Chrome / Edge, press **Cube** (top right), pick
your cube in the Bluetooth chooser, and make sure the cube is **solved**
(or press *Mark as solved*). The solver builds its tables on first use (in a
worker; the trainers' tables are kept in IndexedDB) — the first case of a
kind can take a few seconds.

## Credits & prior art

- **[cubecore](https://github.com/wodzik/cubecore)**
  ([`@wodzik/cubecore`](https://www.npmjs.com/package/@wodzik/cubecore),
  MPL-2.0) — the cube library the app is built on: state and notation,
  method stages and case recognition, the solvers behind scrambles,
  trainers and analysis, smart-cube sessions, the 3D cube, skins and
  pictures, the player.
- **[smartcube-web-bluetooth](https://github.com/poliva/smartcube-web-bluetooth)**
  by Pau Oliva and Andy Fedotov (MIT) — the Bluetooth protocols of the
  supported cubes (inside cubecore) and the GAN smart timer.
- **[cubing.js](https://js.cubing.net/)** by Lucas Garron and Tom Rokicki —
  earlier versions ran the 3D cube, the notation and the solve-stage
  detection on it; all of that is cubecore's now.
- **[RubiksSolverDemo](https://github.com/or18/RubiksSolverDemo)** by or18
  and **[roux-trainers](https://github.com/onionhoney/roux-trainers)** by
  onionhoney — the ideas of the CFOP and Roux case trainers (exact-depth
  scrambles). Earlier versions bundled their GPL-3.0 engines; the trainers
  now run on cubecore's own solver.
- **[speedcubedb.com](https://speedcubedb.com)** — the case numbering,
  names and groups (F2L, OLL, PLL, CMLL).
- **[csTimer](https://cstimer.net/)** — long-time inspiration for timer UX
  and statistics conventions.
- Also: React, Vite, Tailwind CSS, Recharts, lucide icons, dnd kit.

## License

**GPL-3.0** — see [LICENSE](./LICENSE). If you change the app and share it
(a fork, a hosted copy), share its source under the same licence.

That's a choice, not something a dependency requires: the GPL-3.0 engines
earlier versions bundled are gone, and everything the app uses now is
MIT / ISC / Apache-2.0 / MPL-2.0 (cubecore).

"Rubik's Cube" is a trademark of its respective owner, as are the smart
cube brands named here; this project is not affiliated with or endorsed by
any of them.
