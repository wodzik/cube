# Vendored roux-trainers solver library (GPL-3.0)

Vendored from onionhoney's roux-trainers
(https://github.com/onionhoney/roux-trainers), `src/lib/` subset, licensed
**GPL-3.0** — see ./LICENSE.

Files: CubeLib, Defs, Math, Pruner, Solver, CachedSolver + min2phase/.
Modifications (marked in-file):
- `// @ts-nocheck` headers (vendored code isn't held to this repo's strict tsconfig),
- `Solver.tsx`: import paths for the settings shim (`./settings.ts`, added) and min2phase,
- `min2phase/min2phase.js`: CommonJS exports → ESM (Vite browser serving).

ALL access goes through `src/services/rouxTrainerService.ts` — same GPL
isolation policy as `public/trainers/` (see that README for the licensing
note; it applies verbatim here).
