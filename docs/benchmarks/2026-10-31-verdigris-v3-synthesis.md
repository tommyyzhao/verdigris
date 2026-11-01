# Verdigris v3 — synthesis (lead, 2026-10-31)

Raw artefacts: `/tmp/verdigris-v3/` (machine-local; not retained in git).

Raw evidence lives beside this file; every number below is copied from a primary artefact named in brackets. "Hypothesis" means design judgement, not a playtest result.

## 1. Evidence dossier — what players enjoy, what they quit over

**Bottom line.** Players separate four things: *discovering* a consequence, *applying* it, *physically executing* it, and *fighting the interface*. They enjoy the first two and quit over the last two [research/puzzle/dossier.txt §BOTTOM LINE; 769 negative reviews coded across Baba Is You, SSR, The Witness, Opus Magnum, SpaceChem, World of Goo, Portal 1/2]. Fluid games show the same split. Novel liquid motion attracts players. Quitting follows unreadable or fragile execution, repeated cost after the insight is known, or shallow use of the fluid [research/fluid/reviews-coded-v2.json, n=334].

| Evidence | Numbers (source) |
|---|---|
| Acclaimed-game funnels: achievement prevalence, not retention | Baba: Lake 53.3% → Island 26.6% → normal ending 8.4%. Portal finish 52.1% (64.4% normalised). Portal 2 34.1% (46.1%) [research/puzzle/funnels.json] |
| Fluid-game funnels | Puddle: first chapter 51.1% → Nursery 27.7% → all 3.0%. Vessel repairs 19.3 → 16.1 → 11.7%. Noita victory 10.0% [research/fluid/funnels.json] |
| Fluid negative reviews, strict codes | Puddle n=100: unfair 14%, fiddly 20%, camera 21%. Vessel n=71: unfair 14.1%, redo-from-varying-liquid 8.5%, known-solution execution tax 8.5%. PixelJunk Shooter n=41: shallow/boring 43.9%, wants deeper fluid use 12.2%. Pooled frame-rate complaints 1.5% |
| Friction grows late | Vessel early vs later reviewers: unfair 8.1 → 21.2%, redo 2.7 → 15.2%, fiddly 5.4 → 18.2%. Puddle <2 h vs ≥2 h: unfair 10.8 → 20% |
| Blind first-play footage, 60 timestamped moments | Impasse causes: imported constraints, correct plan defeated by execution, perceptual/state ambiguity, unnoticed affordance, premature theory, no next hypothesis. Aha triggers: diagnostic action, an object's second property, viewpoint shift, revisit, breaking a familiar rule, visible state. No defensible impasse-duration threshold exists [research/footage/analysis.txt] |
| Designers | Barth: hardest content after the story; too much text means change the game. Valve GDC 2008 p42: an intense boss alienated a cerebral audience. Teikari: interaction first, surprise. Traynor GDC 2024: "things almost happen"; trim the possibility space. Blow/ten Bosch: lightest contrivance, generosity [puzzle dossier §7; science dossier] |
| Insight science | Insight is representational change [Ohlsson; Kaplan & Simon, "notice invariants"]. A greedy approach must visibly stall [MacGregor 2001]. Incubation effect .29 [.21, .39], 117 studies [Sio & Ormerod 2009]. Restructuring ≠ subjective aha [Wiley & Danek 2024]. Undirected think-aloud r = −.03 on accuracy [Fox, Ericsson & Best 2011] |
| Hydraulics vocabulary | Communicating vessels, Torricelli head-jet, weir/lip, surge and slosh, splitter. Siphon and Pythagorean cup are conceptually strong but fail in our engine (§2) [science dossier PART B + probe matrix] |

### Five design principles

1. **The fluid's consequence is the discovery; execution is never the test.** Once the plan is known, it must clear across a stated input envelope (±6 ticks / ±0.5 LU), verified by the seeded solver. Evidence: puzzle P1 (Portal "knew it, couldn't execute"; Baba conceptual vs precise); Vessel/Sprinkle reviews; footage impasse cause 2; Puddle fiddly 20%.
2. **The fluid must change the solution (ablation test).** Remove air, or replace the liquid with a scripted transfer, and the intended solution must break. Evidence: Noita physics-as-VFX after ~20 min; Puddle "always knows what to do"; PixelJunk Shooter shallow 43.9%; protocol fluid-causality gate.
3. **Show every invariant, never let the picture lie.** Levels, counts, open/closed state and air direction (mist) are all visible. Pigment and sensors must never disagree. Evidence: Puddle off-screen loss; Noita water/ice and poison/grass misreads (M42, M45); Fluidity's object/background separation; Kaplan & Simon.
4. **Each room breaks one everyday wrong belief, through a cheap diagnostic action, ideally by revealing a second property of something already known.** Greedy play must visibly stall. Evidence: footage triggers A/B (strongest fluid-specific opportunity); Knoblich constraint relaxation; MacGregor progress monitoring.
5. **Cheap recovery, separate mastery, a way out.** Deterministic restart, staged hints that relax a constraint, and optional dewdrops that never reclassify a solve. Leaving a stuck room for another is allowed. Evidence: puzzle P4–P6 (SSR Cold Frustration, Barth histograms, Opus contrary voices); Sio & Ormerod.

Anti-patterns adopted as kill rules:
- tilt/precision courses;
- lethal systemic surprise;
- exact dye-hue or concentration goals;
- 5 Hz stirring as a requirement;
- one compulsory late room blocking the story;
- colour-only state.

## 2. Find the fun — design-space matrix with toy results

Real-engine greybox toys, no engine edits:
- Hydraulics: 52 presets, 364 seeded runs, 35,854 conserved sensor frames; every same-seed triplet is bit-exact [toys/hydraulics/toys.md].
- Air: 210 matrix cells, 7 runs per scenario [toys/air/toys.md].
- Hydraulics scores: 34 of 70 cells strong (3), 15 dead (0). Air: 16 of 210 strong, 170 dead (mostly "needs two-way coupling").

| Verb × property | Score | Measured result |
|---|---:|---|
| gate/plug × timing | 3 | Closing during the reverse slosh traps MORE downstream: receiver 105.6–105.9 units vs 84.7–85.0 left open [interplay-plug/gate.json] |
| gate × head (vessels) | 3 | Connected pools level to 0 cells error (connector 4/6/8). Connector 12 overshoots 8 cells and settles later [vessels-*.json] |
| pour × head (jet) | 3 | Head 12/24/36 gives nozzle 64–66 / 88–94 / 108–110 cells/s and reach 17 / 27–31 / 33–39 cells. Head drains during the shot [jet-h*.json] |
| aim-nozzle × rate (splitter) | 3 | Nozzle offset −3/0/+3 cells gives left share 97.1–98.4% / 56.1–56.9% / 14.8–16.4%. Centre ≠ half [momentum-splitter-*.json] |
| pour × mixing | 3 | Exact species ratio: a 6-tick late stop shifts 1.22 points, seed spread ≤ .05 [mix-delay*.json] |
| wax/lip × overflow | 3 | Lip order is a reliable clock: ≥1 unit at 348–360 ticks across 5 seeds [clock-*.json] |
| vent × momentum | 3 | Draft moves landing from x85.3 to x109.7 (left draft: x67.0). All 720 markers conserved [air meter-*.json] |
| vent × timing (updraft shelf) | 3 | Strong updraft keeps all 11.25 units aloft at tick 180. Off: 8.66 landed. Moderate: delays, does not freeze |
| release-dye × momentum | 3 | A mist pulse reveals an otherwise invisible draft. Mist is currently too dim in screenshots |
| stir × momentum | 3 coarse / chore exact | 10 sweeps route all right; 1 sweep leaves it left. ±2-cell/±2-tick input gives landing range 2.25 cells; one seed leaks 0.5 unit. 10 strokes in 2 s = 5 Hz (workload proxy) |
| wax × momentum (air) | 3 | One obstacle reverses the downstream probe, i.e. the return current |
| pool × wind | (property) | Pools are shielded: uniform +60 for 10 s drifts a broad pool 3.37 cells [arch/hybrid] |
| prime/siphon | 0 — kill | A zero-marker crest cell becomes p=0 atmosphere at tick 7–17 and the flow stops with the source full (G1, fix 2–7 engineer-days, unproven) |
| Tesla valve | 0 — research | Forward/reverse/straight throughput are equal (diodicity ≈ 1) |
| vortex clock / RGB titration / dye concentration | 0 — kill | Wake period CV 0.48–1.07. Colour variance 0.19345 → 0.19317 when stirred. Region dose varies 5.6× across phase |

**Surprise log.** Each item is a catch a level can use.
- Closing later keeps more (slosh).
- A wider connector settles slower.
- Centre gives 56%, not 50%.
- Head 16 vs 8 gives >4× the overflow slope, not 2.8×.
- Render mixing ≠ species homogenisation.
- Visible spilling precedes a countable overflow.
- Updraft is a shelf, not a levitation point; the ribbon curls sideways.
- A long stroke saturates at the impulse cap; repeating it matters.
- Endpoint wind sign ≠ source direction.
- A final dye gauge hides an interior current reversal.

**Core tension: chaotic simulation vs fair puzzle.** Resolved, measured rather than asserted:
- Score conserved macro outcomes over sustained windows (≥1 unit past a lip; ±2-cell level band for 60 ticks; ratio bands wider than the 1/64 marker quantum).
- Fixed-lag L=2 delivery makes every replay bit-identical (game proven; 9/9 solver runs identical; 0 stalls at 60 fps).
- The solver proves each intended plan survives an input envelope.
- Droplets stay expressive, never adjudicative.

**The emergent core rule.** Both toy lanes found it independently, and it is the most promising sentence in the corpus:

> *Air owns falling water; gravity owns still water.*

Wind bends a stream, holds a pour aloft, and chooses the basin. It cannot move a pool. Making still water move again (open a gate, overflow a lip, build head for a jet) is how you hand it back to the air. That rule gives the "second property" aha: the pool you could not blow becomes steerable the moment it falls.

## 3. Architecture — measured

| | Current: WebGL2 liquid + air, one-way, fixed-lag 2 | Hybrid: current + texture obstruction + opt-in two-way (gain 0.25) | Unified: WebGPU compute MAC-FLIP + air, one device |
|---|---|---|---|
| M1 Max frame (S1, p50/p95) | 14.0/16.1 ms [arch/hybrid] | 12.5–14.4/16.5–16.7 ms | GPU 3.3 ms p95; wall 4.1/4.4 ms. Not work-parity: no production render, dye or sensors |
| Base M2 (8-core GPU), fence-waited | **18.2/22.8 ms; liquid step 9.43/12.45** — over budget | 19.1/24.8 ms | 5.7/8.5 ms [arch/m2/summary.txt] |
| Cost driver | Liquid fixed pass floor: 64×40 costs 6.73 ms vs 192×120 6.85 ms; 1k vs 20k markers 6.27 vs 10.38 ms. 2 substeps × 24 iterations × 2 = 96 pressure passes per tick | same | — |
| Determinism | Bit-identical (fixed-lag 2, same device) | Hashes ×3 identical; +4.3 units arrive by 10 s, so retuning is needed | Fixed-point atomics, hashes 3/3. i32 overflow guard needed. Cross-GPU unverified everywhere |
| Coupling quality | Wind shift +25.9 / +51.6 cells at +15/+30 | Adds near-sheet entrainment 30 cells/s and in-pool air p95 10.8 → 1.1 | +26.9/+53.4; entrainment overtuned (max 174.5) |
| Physics quality | Production reference | same | **18.7% area compression at 30k**; non-conservative multiphase |
| Code cost | 0 | 500–950 LOC | +2,500–5,000 LOC, 4–8 engineer-weeks plus cross-device QA |
| Browser support | WebGL2 97.97%. EXT_color_buffer_float 99.95%. **EXT_float_blend 93.6% overall but iOS 50.8%** [web3dsurvey, accessed 2026-10-31]; caniuse lists iOS Safari 16–26.6 unsupported, and the liquid engine requires it (LiquidEngine.ts:414) | same | Chrome/Edge 113+, Android 121+, Safari 26, Firefox 141 Win / 145 macOS. Needs a secure context |

**Recommendation (numbers in hand; arch-floor lane refining).** Keep the current two-engine WebGL2 architecture:
- It is the only one with production rendering, sensors, and proven bit-identical replay.
- No recommended level needs liquid→air feedback.

Spend the engineering on the measured bottleneck, the liquid pass floor:
- pressure iterations, substeps, warm start;
- an RGBA16F path so iPhones without EXT_float_blend can run.

The arch-floor lane is measuring the quality cost per cell plus the whole-game rAF frame on the M2. Adopt the hybrid texture obstruction (0.6 vs 4.3 ms rebuild) when the first level edits terrain under air. WebGPU unified stays a 7/10 "continue investigating" option. It becomes the plan only if the floor cuts cannot bring the M2 under 16.7 ms p95 at acceptable quality. That trigger is pre-registered here.

## 4. Three strongest concepts

Each concept passes principle 2: the ablation column states why both engines are necessary. Graph notation: `node [prerequisites]`.

### Concept A — ALOFT: "Air owns falling water; gravity owns still water"

The player pours from springs (cursor), taps gates/plugs, and switches/places a few authored vents. A free mist puff reveals drafts. Freehand stirring is a coarse, optional extra; no room requires repeated sweeps.

Insight graph:
- A0 water follows the ground [First Rain]
- A1 wind bends a falling stream [A0] (Breath)
- A2 wind cannot move still water [A1]
- A3 mist shows hidden drafts [A1]
- A4 an updraft is a shelf: water waits aloft until the vent stops [A1, A3]
- A5 head is the aim: a fuller tank throws farther, and the throw shortens as it drains [A0]
- A6 to steer still water, set it moving: gate, lip or jet [A2, A5] — the second-property aha
- A7 a wall turns the wind back (return current) [A3]
- A8 composition: jet → shelf → release [A4, A6]

| Level | Wrong belief broken | Minimal form (LU, board 48×30) | Measured basis / fairness | Ablation |
|---|---|---|---|---|
| A-1 Still Pond [A2→A6 seed] | "Blow hard enough and the pond spills over" | Pond on a shelf, sill 2 LU above the surface (≥ the 3.4-cell drift ×2). Floor plug. Fixed side vent across the drop. Urn behind a wall | Pool drift 3.37 cells at +60 for 10 s, so the sill can't be breached. Draft landing +24 cells (6 LU); urn ≥ 4 LU wide | No air: the falling water misses behind the wall. Scripted transfer: no reason to open the plug |
| A-2 Hidden Draft [A3] | "The air in the room is still" | Two identical glass chutes; a draft behind one; free mist puff; one spring that can pour into either | Mist reveals transport (cell 3) once brightened. Landing shift is stable across 5 seeds | No air: both chutes equivalent, so nothing to discover |
| A-3 Cloud Shelf [A4] | "Water always falls at once; I need two hands" | A geyser spring gushes for 2 s. The gutter gate below must be opened, which takes the single pointer. Updraft toggle | Strong updraft: 11.25/11.25 units aloft at tick 180. Show "11 aloft"; broad catch zone | No air: the gush falls before the gate opens |
| A-4 Head Throw [A5] | "More water is always better" | Side-outlet tank with a level gauge. Plug. Urn across a gap; a spoil basin beyond it. Pour into the tank | Reach 17 / 27–31 / 33–39 cells at head 12/24/36. Catch ≥ seed spread 6 cells + 1 LU margin. The drain-sweep makes the timing generous | Scripted transfer: the head–reach relation vanishes. Air: a draft adds or subtracts reach in the A-5 variant |
| A-5 Bring It Back [A8] | "Water that pooled in the wrong place is lost" | Pool trapped low, upwind. Urn on a high shelf. Gate raises head into a side jet that rises into an updraft column, then a vent carries it over | Composition of the measured jet, shelf and vent cells. Solver must show no shortcut within 300 random + 200 MAP-Elites | Each engine removed breaks a different link |

### Concept B — LEVEL: lock-keeper of a sunken garden (hydraulics-first)

Verbs: pour, dig, gates/plugs. Air is weather. It is necessary in 2 of 5 rooms, which is honest but weaker on the dual-engine requirement.

Insight graph:
- B0 water follows the ground
- B1 connected pools share a level, not an amount [B0]
- B2 you can lift water without a pump: fill through a low connector [B1]
- B3 closing late keeps the surge [B1]
- B4 the lower lip spills first: lips are clocks of order, not speed [B0]
- B5 head aims a jet [B1]
- B6 wind bends the jet [B5 + Breath]

Levels:
- **Two Basins [B1]:** "pour equal amounts". A wide near basin is connected to a narrow sealed far basin with a level stripe (connector 8 cells; error 0 cells).
- **The Lock [B2]:** "water can't go up". Fill a lock chamber, open the upper gate, and the high channel fills.
- **Surge Catch [B3]:** "close early to keep more". 105.6 vs 84.7 units measured.
- **Lip Clock [B4]:** "equal pours finish together". Two machines must fire in order.
- **Wind Gap [B5, B6]:** a jet across a canyon with a crosswind vent. Head and vent jointly set the landing.

### Concept C — DYER'S GLASSHOUSE: recipes by placement (v2 continuation)

Species recipes with exact counts, splitters, metered streams, spill contamination; air nudges streams between splitter lanes.

Insight graph:
- C0 pour position
- C1 wind bends [C0]
- C2 centre ≠ half [C0]
- C3 a nudge beats a flood: a 3-cell shift takes the left share from 98% to 15% [C2]
- C4 looking green ≠ equal [C0]: the plaque shows counts
- C5 storage delays: equal pours ≠ equal finish [C0]
- C6 overflow carries colour to a neighbour [C4, C5] (Two Springs)

Levels:
- **Even Split [C2]**
- **Two-to-One [C3, C1]:** a wind nudge sets the ratio.
- **Green Isn't Even [C4]**
- **Race [C5]**
- **Spillway [C6]**

Risk: ratio rooms drift toward titration twitch. 1 tick = .125 unit, so bands must be ≥ ±1% and sustained.

**Recommendation: build A (Aloft) as the spine, with B1/B3 (vessels and surge) folded in as A's hydraulic half.**
- A is the only concept where both engines are needed in almost every room.
- Its core rule is one sentence and yields a second-property aha.
- Every node maps to a measured strong cell; none depends on a killed mechanic.

The existing First Rain and Breath rooms are already nodes A0/A1. Two Springs and C-style recipes become optional mastery / late composition.

## 5. Solver plan (headless, seeded, real engines)

Status: code at cbf6572 → 587b719. Determinism: 9/9 identical hashes; 0 stalls at L2/L3/L4 at 16.7 ms pacing. Throughput 2–2.8 simulated s per wall s, so a 20 s evaluation costs 7–10 s and a 10-minute lock window holds 60–80 evaluations. The M2 runs the GA in parallel (job verdigris-solver-ga2). Results so far:
- **Naive suites:** First Rain 5/10 clear (expected for a tutorial). Breath 0/10. Two Springs 0/11 (no-stir comes close: green 13.56 of 14).
- **Breath perturbation (n=10 each):** baseline 10/10; ±3 ticks/.25 LU 9/10; ±6/.5 LU 10/10; ±12/1 LU 9/10.

Per v3 level, acceptance (frozen before tuning):
1. Canonical: 3 engine seeds clear with all dewdrops.
2. Envelope: ≥9/10 survive at ±3/.25, ±6/.5 and ±12/1 (tick/LU) perturbation magnitudes.
3. Naive suite all fail: idle, dump-at-k, no-air, single-verb, random input ×2, greedy-fill.
4. Blind search, random 100 + MAP-Elites 200: every clear outside the intended route signature is a shortcut candidate. Replay it, inspect the PNG, then fix the level or accept it as a valid alternative (principle 3: diversity is fine unless it skips the room's insight).
5. Ablation: air off, and liquid replaced by a teleport transfer. The intended solution must fail in at least one, per principle 2.
6. Discrete fixture choices (vent slot, gate) are enumerated exhaustively. Timing goes on a 6-tick lattice.

Budget: ~400 evaluations ≈ 1 GPU-hour per level, split across the M1 lock windows and the M2.

## 6. Playtest protocol

Done: [research/playtest/protocol.md, instrumentation.md, checklist.md].
- Five fresh testers per round, silent play, then a retrospective replay-cued interview.
- Pre-registered gates: unaided clear ≥4/5 within 300 active seconds; explanation/transfer ≥4/5; supported aha ≥3/5; enjoyment median ≥5/7; fluid-causality ≥4/5.
- Kill/pivot table §7. Lean remote format §2a–2b.
- The owner recruits and runs; the build exports logs locally.
