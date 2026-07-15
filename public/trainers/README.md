# Vendored trainer solvers (GPL-3.0)

The WASM solvers under this directory are vendored UNMODIFIED from or18's
RubiksSolverDemo (https://github.com/or18/RubiksSolverDemo), licensed
**GPL-3.0** — see ./LICENSE.

- `xcross/` — xcross trainer engine (`src/xcrossTrainer/` upstream):
  `xcross_search.func(scramble, length)` returns
  `"<scramble><optimal xcross solution of scramble>,<solution of a random
  xcross state at exactly `length` optimal depth>"`. Builds ~600 MB of
  move/prune tables in worker memory on first load (several seconds).
- `eocross/` — eocross trainer engine (`src/eocrossTrainer/` upstream):
  same 2-part `func` shape, target = cross + all edges oriented.
- `pairing/` — free-pair trainer engine (`src/pairingTrainer/` upstream):
  4-part response `"<scr><A>,<applA>,<B>,<applB>"` — goals are "pair formed,
  one insert away" states; applX is the insert generator from solved.
- `xxcross/` — xxcross trainer engine (`src/xxcrossTrainer/production/`
  upstream): 2-part `func`, message additionally takes
  `pairType: "adj"|"opp"` and `bucketModel` ("MOBILE_LOW").

LICENSING NOTE: while nact is private/unreleased this has no practical
effect. If nact is ever distributed, bundling these files makes the app a
GPL-3.0 derivative work — either comply (release the app source under
GPL-3.0) or replace this directory with a clean-room implementation first
(see plan-trainer.md §8). All access goes through
`src/services/xcrossTrainerService.ts` specifically to keep that swap
contained.
