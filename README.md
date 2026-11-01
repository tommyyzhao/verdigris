# Verdigris

A sleeping machine-garden. A little water, a little patience.

An intimate liquid puzzle game in six rooms. Desktop or laptop, WebGL2 with hardware acceleration.

Playtesting: stop reading here and open the game. The files below contain mechanisms and solutions.

Built on [svelte-fluid](https://github.com/tommyyzhao/svelte-fluid): the air is its Navier–Stokes `FluidEngine`, the water its PIC/FLIP `LiquidEngine`, both from `svelte-fluid/experimental`.

## Play locally

```sh
bun install
bun run dev        # http://localhost:5173
```

- `/` — the game. `?study=1` opens the consent-gated playtest panel (local JSON export only).
- `/check` — compatibility preflight for remote testers.
- `/lab/solver` — solver lab.

## Develop

```sh
bun run test       # node suite
bun run check      # svelte-check
bun run build      # static site in build/
```

Real-GPU suites (solutions, determinism, rooms) need hardware Chrome:

```sh
VITEST_BROWSER=1 VITEST_CHROME_PATH="/path/to/Chrome" bunx vitest run --project browser
```

## Docs

- `docs/plans/` — design plan and playtest packet; `docs/playtest/` — protocol, run card, instrumentation spec.
- `docs/benchmarks/` — v3 research synthesis, plus earlier prototype records (their paths refer to the old `svelte-fluid` `/puzzles` route).
- `docs/learnings/` — solver and toy-horizon gotchas.

History before 2026-11-01 lives in svelte-fluid's `feat/verdigris-v3` branch.

## License

MIT. See `LICENSE`.
