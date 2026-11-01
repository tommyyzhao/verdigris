# Jetmaze G0 — dye-jet foundation gate

Status: **G3 PASSED — bounded two-second jet foundation.** Original G0/G1 failures and G2 guard stop preserved below. Room implementation is underway; sustained-runtime and actual-page validation remain pending.

## Purpose

The owner requested a mouse-follow, HP-based maze with colored fluid jets and step-on valve pads after finding Wake Courier insufficiently fun. The completed interview specifies red damage, blue slowing, green healing, yellow collectible sparks, reversible valves, real wall containment, three compact rooms and multiplicative scoring. Countercurrent's rejection and Wake Courier's incomplete validation remain unchanged.

Before replacing `/puzzles`, establish that the existing engine can provide independent material signals, readable moving plumes and harmless concentrations behind thick walls. This is a bounded technical experiment, not evidence of fun, unfamiliar-player comprehension, conservation or universal wall impermeability.

## Frozen experiment

Source base: `e9c23389027165682ce3233d670c53a962db5543`. Measured candidate: 666 files, manifest digest `8e7067932855bc75cd9fb213c3f9021a1de95c85c856637abf8dece1437c05f8`; every source hash remained unchanged throughout execution. This outcome report was updated afterwards.

- One owned-context `FluidEngine`; no engine, default, preset or public API changes.
- Square 128×128 simulation/dye/scalar fields; fixed 1/120-second ticks.
- Semi-Lagrangian advection; pressure 0.8, 40 pressure iterations; velocity dissipation 0.5, dye/yellow dissipation 1; no curl/viscosity/automatic splats/pointer input.
- Point source `(6.5/16, 8.5/16)`, public radius 0.005, rate 60, velocity `(4, 0)`, unit selected dye/scalar intensity.
- Emit for 60 ticks; observe 240 ticks total. No parameter sweep or automatic retuning.
- Six geometries: straight, corner and T wall layouts, each closed or with tile `(8,8)` opened. Walls are one tile thick on a 16×16 grid; the same tile authority generates SVG obstructions and disconnected-domain masks.
- Four isolated channels per geometry: dye R/G/B and named scalar `yellow` in scalar R. Plus open-straight zero-source and red+green controls: 26 cases total.

## Acceptance and evidence

- Every case completes 240 finite-field ticks; initial semantic fields are zero. Scalar alpha is not a material identity and starts at one in this engine.
- Every disconnected non-solid tile in closed layouts stays below 0.05 in each semantic channel. This includes left-side compartments behind the corner/T arms, not only the right-side receiver.
- Every open positive control exceeds 0.05 at the same right-side receiver (`x >= 9/16`). Red centroid must move more than 0.01 board units from the source. Direct Gaussian deposition at that receiver is separately estimated using `exp(-d²/(radius/100))` with source history and decay.
- Unselected semantic channels remain below 1e-6; red+green creates no yellow scalar. Finite gold pickup accounting is future game logic, not demonstrated here.
- Open-straight red stays above the deadzone after shutoff and fades between ticks 120 and 240.
- Post-step velocity displacement stays below 0.5 donor cell. Previous velocity plus source impulse is only a screening estimate; neither measurement proves every unobservable solver intermediate.
- Each case's four-tick batch p95 is at most 33 ms, including readbacks, analysis and Canvas2D rendering. Timer yields, screenshot/export costs and whole-case elapsed time are recorded separately. This is not a native 120 Hz/RAF claim.
- Raw dye/scalar arrays at ticks 30/60/120/240; 18 unmasked raw-field PNGs for red closed/open layouts at ticks 60/120/240. Visual inspection remains separate from numerical assertions. Numerical success reports `numeric-passed/visual-review-pending`, never an automatic G0 pass.
- Queued context loss/visibility changes invalidate evidence; the final readback is followed by an event-loop yield before completion. Failure values/ticks and partial rows must survive in JSON.

This single-source, single-pulse envelope does not establish arbitrary source placement, simultaneous jets, repeated pulses over 30–60 seconds, other resolutions or browsers. Room configurations must remain inside a justified tested envelope or receive their own explicit validation; do not extrapolate this gate to those cases.

## Verification to date

Integrated final fixture:

- `bun run test`: 57 files, 1000 tests passed.
- `bun run check`: 515 files, zero errors/warnings.
- `bun run prepack`: publint and strict public declarations passed; packaging emitted its `import.meta.env` portability warning.
- `bun run build`: passed. Packaging/build preceded the final diagnostic-only value/tick error-message correction; test/check were rerun afterwards.
- Independent static review corrected scalar-alpha initialization, incomplete fade evidence, missing disconnected-region coverage, missing raw presentation evidence, pooled timing and final-read interruption timing.

## Measured outcome

One frozen Chromium 148 run on M2; 26/26 cases completed. The browser assertion and native job both exited 1; original failure evidence retained.

| Check | Observed result |
| --- | --- |
| Open-wall positive controls | **FAIL:** all four semantic channels in all three layouts recorded maximum receiver intensity 0, required >0.05 |
| Closed disconnected regions | Maximum 0; threshold assertion passes, but not useful containment evidence because the opened-wall controls also receive nothing |
| Independent channels / zero / red+green | Assertions pass for this fixture |
| Source-off fade | Assertion passes |
| Maximum measured donor displacement | 0.1212300248 cells/tick, below 0.5 |
| Four-tick batch p95 | 15.9–26.7 ms across cases, below 33 ms; excludes yields/exports, not a native display-cadence measurement |
| Raw screenshots | 18 PNGs saved; reviewed straight-open ticks 60/240 and T-closed tick 240 show a small local red blot rather than a useful travelling jet |

The Gaussian direct-source estimate at the receiver is approximately `2.06e-211`; it is not an advective transport prediction. The renderer/GPU backend was not instrumented and is unverified. Test duration was approximately 46.7 seconds.

**Verdict:** this frozen source/configuration does not establish the required jet mechanic. Neither a functioning maze nor wall impermeability follows from the closed-region zeros. No unfamiliar-player test, enjoyment or gameplay result exists. Room construction remains stopped. Any revised experiment requires a separately approved correction.

### Recorded-field diagnosis — no additional run

All 12 opened single-channel controls have receiver maximum exactly zero, not a near miss against the 0.05 threshold. Red centroid movement passes the separate 0.01 requirement: final centroids are approximately 0.443552, 0.443438 and 0.443219 for straight/corner/T, about 4.7–4.8 simulation cells beyond the source. In saved open-red frames, the above-deadzone front reaches cell x=60 (center 0.47265625) at tick 240; the wall starts at x=64 and the receiver at x=72. The plume never meaningfully challenges the wall.

The source velocity is an additive field impulse, not board-units-per-second movement. At rate 60 and dt 1/120, raw x strength 4 deposits `2 × Gaussian` per emission tick. Advection converts the resulting raw velocity to board displacement through `dt × velocity / 128`; projection also changes that field. Radius 0.005 has an e-fold width of approximately 0.905 cells. These engine semantics and the measured short travel explain an underpowered local plume; they do not demonstrate a solver containment defect.

The owner subsequently directed continuation until the game is completed, authorizing bounded evidence-led corrections. Original failed evidence remains preserved; thresholds are unchanged.

### G1 — stronger point impulse

Only raw source momentum changed from 4 to 12. Candidate digest `7fd1e7ea52da9e2e020d68a1da259bf0dd7b143a293b5fd257814b243d1c3e85`, 666 files. All 26 cases completed; all 12 open receivers still recorded zero. Maximum donor displacement approximately 0.2373; open red centroid reached approximately 0.468 and its saved above-deadzone front reached column 64, still short of receiver column 72. Numerical verdict **failed**. Per-case timing p95 at most 28.2 ms. Browser/process exit and owned-lock release proved; no source changes or forced cleanup.

### G2 — upstream velocity-only line

Momentum was separated from pigment: velocity-only line from `(5.5/16, 8.5/16)` to `(7.5/16, 8.5/16)`, strength 12; original compact pigment/scalar point retained without momentum. No dye deposited along the line; no source crosses the wall. Candidate digest `f915537fde14c5b02051d1351e0b9011f5787248fb76ee38ade17d4c391713d4`.

This broader forcing footprint produced excessive displacement: 25 active cases stopped at tick 15/16 on the unchanged prior-velocity-plus-impulse guard, with screening values approximately 0.503–0.527 against limit 0.5. Only the zero case completed. Result **incomplete**, test exit 1 / runner exit 70; no intended presentation frames reached. Partial JSON retained. Browser/process exit and lock release proved; no source changes.

### G3 — bounded line impulse

Next frozen revision reduces only the line strength from 12 to 3; the observed early growth motivates less distributed momentum, not relaxed safety thresholds. Candidate digest `2534605d233bdffbe639cee1cd17834937cb6b20ecaa4e02b190f5179c7d70b1`, 666 files. Same dose, radius, emission duration, grid, receiver and thresholds. **Measured pass for the bounded base envelope:** all 26 cases completed, all numerical checks passed, test/job exit 0. Open red receiver maxima were 0.246948 (straight), 0.217529 (corner), 0.157837 (T), exceeding 0.05; corresponding independent channel tests passed. Closed disconnected-region maxima remained zero. Maximum donor displacement approximately 0.383; per-case four-tick p95 15.3–25.9 ms.

Lead inspected paired straight open/closed tick-120 and T open/closed tick-240 screenshots: transported open plumes and wall-blocked closed plumes are visible. This accepts G3 as the two-second single-nozzle foundation, not a universal impermeability or full-game pass. Browser/process exit and lock release proved, source unchanged, maximum load 1.71. Runtime concurrency/repeated pulses, game rendering, room solutions and actual pointer play remain separate gates. No engine algorithm has changed.

Cleanup receipt proves the dedicated browser/profile exited, the owned process group is empty and the owned GPU lock was released; no signals were needed. Maximum observed host load was 1.738. Completed remote job and evidence remain preserved under the cleanup hold.

## Preservation and operations

Original untracked prototype files were archived with a verified manifest before integration. Existing Wake Courier page and old experiments remain unchanged. Archive/process/job handles stay in machine-local memory, not this document.

Execution is delegated to M2 under the owned atomic GPU lock, start load ≤6, stop load >10, with a 1200-second deadline and exact owned browser/process exit evidence. No M1 GPU work, dependency installation, commit, push or release. Completed remote jobs remain retained under the helper cleanup hold. No retuning after the frozen run; a failure stops room construction and informs a separately approved correction.
