# Verdigris v3 — "Aloft" plan (2026-10-31)

Evidence, matrix, architecture numbers and concepts: `/tmp/verdigris-v3/SYNTHESIS.md` (copied to `docs/benchmarks/2026-10-31-verdigris-v3-synthesis.md`).

## Owner decisions (2026-10-31)

| Choice | Decision |
|---|---|
| Concept | **A — Aloft.** Core rule: *air owns falling water; gravity owns still water.* |
| Air verb | **Vents + mist.** Player-switchable or rotatable vents plus a free mist puff that reveals drafts. Freehand stir stays as the signature look and a coarse nudge; **no room requires it.** |
| Devices | **Desktop/laptop only.** No iOS 16F path now. |
| Scope | **5 new rooms + the polished 3** (8 total), then the owner plays and runs the lean tester round. |

## Architecture (measured, no change)

Keep the WebGL2 liquid (24 iterations / 2 substeps) + air pair, one-way coupling, fixed-lag L=2.

M2 real-Breath frame timing over 3 runs: pooled p50/p95/p99 16.7/16.7/16.8 ms, 0.328% dropped vsync (arch-floor b700e2c).

Pre-registered trigger: if any v3 room drops >1% vsync on the M2, switch the liquid to 8 iterations / 2 substeps with an ADR. Measured cost of that switch:
- liquid GPU p95 9.2 → 5.8 ms;
- pool compression 0.16%;
- vessel error 0.026 cells;
- jet reach 33.4 vs 33.4 cells.

No WebGPU work, no two-way coupling, no siphon (G1 unfixed).

## Status (2026-11-02)

Renamed **Fluider** and live at https://fluider.sloprefinery.ai (Cloudflare Pages project `fluider`, Namecheap CNAME). The ending's primary action, “Play the next game”, links to https://delos.sloprefinery.ai/. Six rooms, wings 1/1/2/2/2/3. Every room passes acceptance 1–7. Air-off fails in every room except First Rain. Next: the owner runs the lean playtest (`2026-10-31-verdigris-v3-playtest-packet.md`).

## Rooms (insight graph order)

| # | Room | Insight node | Wrong belief broken | Status |
|---|---|---|---|---|
| 1 | First Rain | A0 water follows the ground | "Pour straight at the target" | Accepted. Blind search: random 40/100, all on the intended route |
| 2 | Breath | A1 wind bends a falling stream | "Water falls straight down" | Accepted. Envelope 10/10 ×3; blind search random 17/100 + MAP 34/200, all depend on the vent |
| 3 | Hidden Draft | A3 mist shows drafts | "The air in the room is still" | Accepted. Envelope 30/30; blind search random 9/100 + MAP 11/200: 19 counter-draft, 1 stir-countering, no shortcut |
| 4 | Still Pond | A2 → A6 | "Blow hard enough and the pond spills" | Accepted. Envelope 30/30; blind search random 2/100 + MAP 114/200, all vent right + plug |
| 5 | ~~Head Throw~~ | A5 | KILLED 2026-10-31: a draining full tank sweeps back through every range; no honest separation from a measured fill (full ≥ medium at catch widths 6/8/10; sap-shelf re-sketch both clear) | Dropped |
| 6 | ~~Cloud Shelf~~ | A4 | KILLED 2026-10-31: toy-exact updraft only delays (~3 s), canonical 0.97/8 | Dropped |
| 7 | Two Springs | C6 overflow carries colour | "Each vessel is independent" | Accepted. Envelope 10/10 ×3 (from 30%); blind search 0/100 + 0/200 |
| 8 | Bring It Back | A8 composition | "Water pooled in the wrong place is lost" | Accepted; finale follows. Envelope 10/10 ×3; blind search random 5/100 + MAP 126/200, all vent right + gate. Risk: easy to clear by luck |

Minimal forms and measured bases: SYNTHESIS §4 Concept A.

## Per-room acceptance (frozen before tuning)

1. The canonical timeline clears with 3 dewdrops on seeds 1/71/429.
2. Perturbation survival is ≥9/10 at each magnitude: ±3 ticks/.25 LU, ±6/.5, ±12/1.
3. Every naive plan fails: idle, dump-at-k, single-verb, two random plans, greedy fill.
   - Rooms 2–8 also include an air-off plan, which must fail.
   - The stir-only plan may clear; it is not required to.
4. A no-stir run of the canonical solution clears (stir is never required).
5. Blind random 100 + MAP-Elites 200: any clear outside the intended route signature is replayed, inspected (PNG), and either fixed or accepted as a valid alternative.
6. Ablation: with air off, the intended solution fails (rooms 2–8 except 5, where air off is allowed to work).
7. Node + GPU browser suites green; screenshots inspected.

## Lanes

1. **Verbs** (worktree). This lane lands first.
   - Player vent controls: switch (shutter) and rotate (pose detents); reuse the `toggle`/`pose` actions.
   - Mist puff action (presentation-only, recorded for replay).
   - Brighter mist.
   - Tank level gauge.
   - Convert Breath + Two Springs.
   - Room files under `game/rooms/`.
2. **Rooms A** (worktree, after Verbs): Hidden Draft, Still Pond (Head Throw killed).
3. **Rooms B** (worktree, after Verbs): Bring It Back (Cloud Shelf killed).
4. **Instrumentation** (worktree, parallel with Rooms): opt-in research-mode log + JSON export per `docs/playtest/instrumentation.md`.
5. **Solver acceptance** (after the rooms): criteria 1–6 for all 8 rooms. Run on the M1 FIFO lock and the M2 static build.
6. **Integration** (lead):
   - map with 8 rooms; finale after room 8;
   - adversarial review (opus, read-only);
   - owner playtest packet: freeze sheet, lean round on Still Pond + Bring It Back.

## Kill / fallback

- Re-sketch a room once if it fails the envelope after two tuning passes. If it still fails, drop it and keep 7.
- Air-off still clears (rooms 2–8): redesign the room, because it fails principle 2.
- Vent toggling causes a frame hitch (>1 dropped frame): switch vents from flow-source reconfigure to per-tick splats.
