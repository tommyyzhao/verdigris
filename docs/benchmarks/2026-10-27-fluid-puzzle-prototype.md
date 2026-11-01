# Countercurrent — frozen Stage1 experiment (2026-10-27)

**Final verdict (2026-10-28): reject this frozen three-level design; stop implementation.** Stage1 demonstrated useful return flow and selected profile **4**, but Stage2 failed positional tolerance, capture margins and random-input discrimination. All128attempts completed; no additional search or redesign run. Engine coupling is demonstrated; a fair puzzle is not. No playable `/puzzles` page, hands-on precedent play, footage inspection or unfamiliar-player observation. The earlier isolation-guard refusal was resolved through owner-authorized corrected setup; no guard was changed or bypassed.

## Frozen manifest

Source base: `e9c23389027165682ce3233d670c53a962db5543`. Route-local probe: `src/routes/puzzles/puzzles.browser.test.ts`; pure model/tests beside it. Do not merge the earlier `00b0707` milestone.

- Same 512×512 canvas, reconstruct zero-state engine per attempt, `autoStart:false`; no engine RAF/native pointers.
- `dt=1/120`, 480 ticks. Point source traverses a centered straight 0.16 UV segment over ticks 0–59, endpoint-inclusive `tick/59`; nominal right from `(0.42,0.5)` to `(0.58,0.5)`, reversed left traverses the same segment backward. No source ticks 60–479.
- Velocity magnitudes **4, 8, 16, 32**, in order; each nominal then reversed; **eight attempts maximum**, no tuning after observation. Velocity-only `FlowSource`, dye omitted; public radius **0.4**, rate **60**. Public radius is divided by 100 internally, not a claimed UV radius.
- Simulation/dye resolution128; curl0; velocity dissipation0.5; pressure0.8; pressure iterations40; live flow; all edges closed; standard semi-Lagrangian advection; one substep; no viscosity, wall friction, adaptive confinement/performance, opening/random/automatic splats, obstacles, external forces/outlets, bloom/shading/sunrays or other enabled postprocessing. Exact route config plus `resolveConfig(CONFIG, DEFAULTS)` logged before attempts.
- Markers `(0.5,0.5)`, `(0.5,0.64)`; matching targets `(0.60,0.50)`, `(0.43,0.64)`; each radius0.045. Bottom-up row-major two-channel readback; bilinear coordinates `uW−0.5,vH−0.5`; UV velocity `(vx/W,vy/H)`. Post-step field held fixed for midpoint integration.
- Matching swept segment–circle entry captures/latches a point. Captured points stop, do not affect fluid. Earliest exit beats later capture; boundary ties fail. All captured by tick480 succeeds; exit/deadline otherwise fails. These are passive markers and geometric sensors, not rigid bodies, physical traps or conserved-volume particles.
- Select first profile with both nominal captures and reversed not both. Finish all four profile pairs before asserting rejection. Never move targets, enlarge sockets, retune duration/config or change solver to rescue results. Capability/readback/context failures mean **incomplete**, not puzzle loss or physical rejection. Shared tier refuses scoring without a verified loss-generation signal.

## Reproduction — authorized GPU lane only

Executed once on the M2 with a verified dedicated Chrome for Testing executable. Existing Chromium Vitest project; existing node project excludes `*.browser.test.ts`. Output path is the explicit opt-in because browser config forwards `SVELTE_FLUID_GPU_BENCH_OUT`, not `SVELTE_FLUID_GPU_BENCH` itself:

```sh
SVELTE_FLUID_GPU_BENCH_OUT=/tmp/countercurrent-stage1.json bun run test:browser src/routes/puzzles/puzzles.browser.test.ts
```

Hardware lane must additionally supply its verified `VITEST_CHROME_PATH`, atomic project lock/load checks and execution permission. This command does not authorize bypassing the remote guard. No local GPU fallback. Without nonempty output path the experimental test is skipped, not passed. With it, require eight attempt rows plus a final decision, confirm the test actually executed. JSON stdout preserves every attempt; existing `writeBenchJson` writes the complete manifest/rows/decision before conceptual assertions. A rejected result is `passed:false`, status `rejected`, assertion failure after complete evidence; incomplete capacity is separately labeled and also nonzero. Probe timing is diagnostic synchronous step/readback/model plus one render, **not** a live-speed UI performance claim. No raw private GL access.

## Research selection and limits

Evidence labels: **S** primary-source statement; **T** fetched developer transcript; **I** design inference. Research below carried from the approved plan, not newly observed play. Unedited-gameplay fetch attempts yielded descriptions/empty pages; failed-attempt behavior remains unobserved.

| Family / source | Evidence; lesson / uncertainty |
|---|---|
| Local forcing — [Push Back](https://js13kgames.com/2019/games/push-back), [source](https://github.com/ErikSom/js13k-pushback) | S: drag creates currents moving boats shoreward; separate fluid/object particles. I: nearby strokes can overshoot/disturb other cargo. Exact hold/reset/loss/budget rules unresolved; no proof of puzzle depth/anti-scribbling. |
| Routing tools — [Enigmo instructions](https://www.pangeasoft.net/enigmo/files/Enigmo%20Instructions.pdf), pp7–11 | S: place/rotate tools, every tank needs50 drops, stopped inflow drains counters, streams operate gates. Evaporation prevents serial tank filling/reuse; nonfatal timer/precision controls aid recovery. Navier–Stokes pooling not established. |
| Excavation — [Where’s My Water?](https://apps.apple.com/us/app/wheres-my-water/id449735650), [secondary level1-7 guide](https://www.ign.com/wikis/wheres-my-water/1-7_Drain_It_First) | S: cut dirt, route substances; guide drains acid before useful water. I: premature connection sacrifices separation. Exact failure/undo thresholds not verified. Finite supply/free surfaces outside engine scope. |
| Global tilt/phase — [Hydroventure](https://www.nintendo.com/en-gb/Games/WiiWare/Hydroventure--285513.html), [developer interview](https://www.nintendolife.com/news/2010/12/interviews_curve_studios_fluidity_hydroventure) | S: tilt, jump, split water/carry objects/change phase; jump cooldown prevents infinite jumping. I: stranding trailing water likely failure. Different model; useful fairness counterexample. |
| Explicit accounting — [Liquid Measure](https://armorgames.com/play/3799/liquid-measure), [Waterworks!](https://scriptwelder.itch.io/waterworks) | S: capacity/no-waste routing versus card/resource coverage. I: incorrect topology/allocation cannot be repaired by waiting. Continuous hydrodynamics not established as necessary. |
| Indirect agents — [Vessel developer transcript](https://www.youtube.com/watch?v=lTbCp1YWPCg), [developer article](https://blog.playstation.com/2014/02/26/liquid-puzzle-game-vessel-coming-to-ps3-on-march-11th) | T:3:33–4:11 liquid through grate grows worker at switch;6:23–8:20 lure/overfeed until bursting. I: sequence/release wastes useful agent. Transcript read, footage not watched; requires excluded agent/volume/phase systems. |
| Stirring sandbox — [TroyDev](https://www.troydev.co.uk/fluid-dynamics.html) | S: separate stir/dye/wall brushes, arrows/tracers, one stroke rolls tracers into paired spirals. Different staggered solver; no objective/puzzle-depth evidence. |

Conditional choice: **Countercurrent**, velocity-driven markers with transparent geometric capture. Hypothesis: useful opposite-side return flow allows coupled control; one fixed-work stroke constrains spam. Dye-detector switchboard rejected for diffuse thresholds/readability/unjustified volume interpretations. Single draggable baffle rejected for boundary/mask/engine risk. Three candidates only; gate failure does not automatically authorize an alternative. Dye is pigment plus passive thickness, not conserved water volume; numerical pressure is not calibrated physical pressure.

## Stage1 results and remaining evidence

One browser test passed, zero skips; eight complete attempts, 480 velocity readbacks each. Chrome for Testing **148.0.7778.96**, Bun **1.3.14**, Node **26.0.0** on M2. Renderer identity was not instrumented; no hardware-specific speed claim. Frozen snapshot manifest digest: `d419e32f4751243539f42ff0a085e02c24b6c9bce2f1f40d811d26cd5ee49661`; all **658 source hashes unchanged** after execution.

| Magnitude | Nominal outcome | Capture ticks (two markers) | Reversed outcome |
| --- | --- | --- | --- |
| 4 | Both captured | 50.106 / 90.915 | Deadline; neither captured |
| 8 | Both captured | 36.706 / 57.006 | Deadline; neither captured |
| 16 | Both captured | 26.643 / 40.224 | Deadline; neither captured |
| 32 | Both captured | 19.032 / 29.569 | Boundary exit; neither captured |

The first profile, **4**, is selected exactly as preregistered. No targets, source settings or criteria changed after observation. JSON trajectories, output, status and lifecycle receipts preserved locally. Browser/process exit proved, GPU lock released; completed remote job retained under the cleanup hold. These are technical calibration observations, not player tests.

- Four-profile/eight-attempt calibration: **passed**. Stage2 positional tolerance, authored levels, repeated outcomes, random baseline and finer timestep checks remain required before page construction.
- Integrated CPU verification: **987 tests passed across 55 files**; **507 files checked, zero errors/warnings**; prepack/publint/strict public declarations and full demo build passed. Existing `import.meta.env` packaging advisory remains. Synthetic zero/uniform/affine/rotation fixtures, dt refinement, swept capture/exit ordering and reset are CPU evidence only.
- Independent static review found queued context-loss events could escape the final synchronous completion check. The probe now yields with listeners alive, checks interruption/visibility and validates fresh readback before accepting completion. Static recheck accepted the fix; browser regression remains unexecuted.
- Stage2 subsequently exercised the three authored fixtures,120/240Hz timestep comparison, tolerance neighborhoods, reverse/zero controls, numerical repeats and random baseline; results below. Actual UI, rendering-cadence/layout coverage, cross-browser results, live-speed play and unfamiliar-player comprehension remain **unperformed**.
- Passing calibration alone would not establish robustness, a finished game, comprehensibility, conserved quantities or responsive presentation.

## Stage2 frozen validation (before execution)

Profile **4** remains fixed. Three authored fixtures from the approved plan: Push `(0.5,0.5)` to `(0.6,0.5)` with a rightward stroke; Return `(0.5,0.64)` to `(0.57,0.64)` with a leftward stroke; Together `(0.5,0.5)` / `(0.64,0.5)` to `(0.5,0.6)` / `(0.64,0.43)` with an upward stroke. All radius0.045; original source/config unchanged.

Exactly **120 Stage2 attempts**, **128 cumulative** including Stage1:27 neighborhoods at120Hz,27 matching neighborhoods at240Hz,6 reversed/zero controls,12 additional canonical replays and48 seeded random actions (24 each for Return/Together; seed0xC0FFEE). Every center in `{0.48,0.50,0.52}²` must win with its intended direction. Fine-step pairs must agree in outcome, paths within0.01UV, capture times within0.1s; both schedules need clearance≥0.01UV plus measured path deviation. Non-authoritative uncaptured shadow paths measure clearance, never affect capture. Random wins must be≤6/24 for each tested level. Four120Hz ticks plus one render have a diagnostic p95 gate≤33ms; actual UI responsiveness remains separate.

Static review caught an initial test that checked clearance only at the canonical center. **Before any Stage2 execution**, fine-step coverage was expanded from3 to27 and every pair now enforces the same margin. Targets and thresholds were not changed. Full action manifest is logged before outcomes; all rows and comparisons saved before verdict assertions. One frozen batch only; capability/interruption errors mean incomplete, not physical rejection.

```sh
SVELTE_FLUID_GPU_BENCH_STAGES=stage2 SVELTE_FLUID_GPU_BENCH_OUT=/tmp/countercurrent-stage2.json bun run test:browser src/routes/puzzles/puzzles.browser.test.ts
```

Stage1 is intentionally skipped in this invocation, not rerun. Stage2 must execute120 complete rows; a skipped test is not validation. Same delegated GPU/load/ownership rules apply.

### Stage2 result: needs revision (2026-10-28)

All **120/120 attempts completed** in one frozen batch; source manifest `3b72bfa052445a25ada37d7360fff3d568e6c20b90895d09b7514ddaec286cbe`, all658file hashes unchanged. The browser assertion failed because the design did not meet its criteria—not because setup failed. Original failure/output/trajectories retained.

| Level | Canonical strategy | Neighborhoods at120/240Hz | Reverse / zero | Random wins |
| --- | --- | --- | --- | --- |
| Push | Captured | 9/9 at both | Neither wins | Not sampled |
| Return | Captured | 6/9 at both | Neither wins | **10/24**, above6limit |
| Together | Captured | 6/9 at both | Neither wins | 0/24 |

Return missed for all three centers with x0.48; Together missed for all three with y0.52. All27coarse/fine outcome pairs agree, all12repeat traces exactly agree. Thus the main failure is geometric tolerance/selectivity, **not observed timestep-dependent win/loss instability**.20/27pairs fail clearance; two also exceed0.01UV path deviation (max0.0109962). Capture-time differences stay below0.1s (max0.0424342s). The canonical return paths themselves only penetrate about0.0038UV into the socket, making them shallow captures rather than robust examples.

Diagnostic four-tick-plus-render timing: median6.8ms,p957.1ms,zero>33ms among11,160samples. This is not actual-UI or cross-device performance evidence. Browser/child exit proved, lock released, no process signals; remote job retained under cleanup hold.

**Disposition:** no page build from these failed fixtures; no retuning/replay of the original batch. The owner-approved option of one evidence-led redesign was assessed and declined. Simply widening sockets would weaken the already-failing random-input discrimination. No new solver or broad search is justified.

## Why stop rather than redesign?

Existing trace inspection is training evidence, not another validation run. Across the nine Return neighborhoods, the marker's largest rightward displacement is only0.0241–0.0457UV, with substantial downward curvature. The intended straight-opposite destination is reached only shallowly, or missed. This explains the failures without suggesting a dependable point-arrival rule.

Directional crossing gates could acknowledge the curved path, but broadening the sensor alone would not exclude the northward random shortcuts. Adding another required marker could restore selectivity, but would change both the completion rule and the teaching level. That is a different experiment, not a demonstrated repair. Existing trajectories would be training data; new held-out evidence and an independently understandable player prediction would still be needed.

The remaining112attempts in the240ceiling are not a quota to spend. This pass stops at128complete attempts. Preserve the source fixtures and failures for reproduction; do not present them as a working or player-validated game. No actual-route/cross-browser/layout/player testing occurred because the design gate failed before UI construction. No localhost URL is available for this rejected prototype.

Final Countercurrent code checks: **988 CPU tests passed**, **507 files checked with zero errors/warnings**, prepack/publint/strict public declarations and full build passed. The opt-in Stage2 browser assertion remains a genuine, preserved **failure**. At closure, all657non-report source files matched the measured Stage2 manifest; only this evidence document changed afterward. No library code, public API or default changed. No commit, push or publication.

## Separately authorized revision: Wake Courier

The owner's subsequent request—“Based on all our learnings, proceed with an improved more fun version”—authorizes a new interaction design. It does not revise the Countercurrent verdict above. Original fixtures and128attempts remain intact.

New hypothesis: **observe, correct, continue** is more engaging and forgiving than one blind shot. Three fixed-strength strokes each execute0.5simulation seconds of injection plus0.5seconds of coast, automatically pausing between them. Fluid velocity and checkpoint progress persist. Broad numbered directional gates replace point sockets; intermediate crossings latch progress, final crossing delivers the marker. No target attraction, rigid-body/volume claims, engine changes or new dependencies. Multiple real-fluid solutions are acceptable; random deviation from a preferred strategy is not automatically an exploit.

One plain `/puzzles` route and three seed levels (Delivery, Bend, Split delivery) are being built before extensive validation. Actual-page authoring permits one disclosed geometry revision before held-out checks. New concept ceiling41complete attempts:2integration, up to9training/confirmation,18held-out,6exploratory and6other-browser nominal. No retuning after held-out failures; original failed fixtures will not be overwritten.

Status: **plain route implemented and served at http://localhost:5180/puzzles; browser gameplay validation pending**. HTTP response contains the board and controls. Four new route-local files; original Countercurrent model/tests/probe unchanged. Integrated checks:993CPUtests,512files checked with zero errors/warnings, prepack/publint/strict declarations and full build passed. Static review fixed reduced-motion decoration handling and hidden invalid-input feedback; browser regressions authored, not yet executed. Seed snapshot:662files,digest`86045c092a44cc9c03313eedf421acce831c3d55f40031d2c2515d34ccf78037`.

More fun remains a hypothesis. Automated browser actions will be identified as such; no unfamiliar-player observation is claimed.

### Wake Courier actual-page training

Six agent-operated attempts through real mouse/native controls, with a screenshot and read-only state inspected after each stroke before choosing corrections. No page errors or failed input commands;21requests and21PNG/HTML/JSON observations retained. This is not unfamiliar-human testing.

| Level | Intended attempt | Deliberately imperfect first stroke |
| --- | --- | --- |
| Delivery | Won in2strokes, tick130 |45° first stroke recovered; won in2strokes, tick171 |
| Bend | Lost after3strokes |−15° first stroke; lost after3strokes |
| Split delivery | Won in2strokes, tick206 |−30° first stroke recovered; won in3strokes, tick324 |

Both Bend attempts crossed the first gate, then passed the final gate's height just to its right: x0.590484 and0.584766 versus endpoint0.58. These are observed failures, not proof that Bend is unsolvable. The predicted correction loop was demonstrated on Delivery/Split. A no-source integration fixture passed; all662source hashes stayed unchanged, both owned browsers exited, owned server stopped and GPU lock released. Renderer unverified.

**Single planned authoring revision, before held-out testing:** move Bend's upward final gate at y0.60 from x0.38…0.58 to x0.48…0.72. Its new center aligns a right-then-up route beyond the first x0.55 gate, rather than requiring an extra leftward correction against retained momentum. No other level, force strength, action budget or solver setting changes. Original geometry and both losses remain archived. Three recorded-strategy confirmation attempts come next; then freeze geometry. No further edits to accommodate held-out failures.

### Current delivery and validation limitation

The revised gate is implemented and served at **http://localhost:5180/puzzles**. Independent static review accepted the scoped revision. **994 CPU tests passed; 512 files checked with zero errors/warnings; prepack/publint/strict declarations and full build passed.** The frozen candidate has662files, manifest digest`f2f8e796f5d65d3b00d5d85b25f3bea409b2cdf8783f53e783bd8d2d4be21ae9`.

Final confirmation/held-out execution is **unverified**. The first dispatch failed before tests or GPU work because only the last of two transfer inputs was retained. A single combined input bundle corrected that setup error without changing the candidate or test logic. The corrected dispatch then timed out connecting to the M2; a read-only same-job inspection also timed out. Its execution status is unknown. Do not assume the job never ran or start a duplicate: inspect that exact job after connectivity returns. Resource handles and recovery details remain machine-local.

**Verdict: promising interaction, incomplete validation.** Actual-page training demonstrated corrective recovery on Delivery and Split delivery, not independently established enjoyment. Revised Bend, input-variation robustness, final browser regressions, finer-step comparisons and other-browser coverage have no completed final validation receipt. No unfamiliar-human playtest occurred. The earlier Countercurrent rejection remains unchanged. No commit, push or publication.
