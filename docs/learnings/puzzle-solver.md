# Learnings: the Verdigris puzzle solver and fluid toys

## A blind search's "no shortcut" holds only for actions its genome can generate

**Symptom:** For three rooms, random 100 + MAP-Elites 200 reported 0 clears. One room had 1 clear in 4 when every control combination was enumerated by hand.

**Cause:** Coverage gaps in `src/routes/game/solver/genome.ts`:
1. `randomGenome` never emitted player gate toggles.
2. The first fix then toggled *every* gate in *every* candidate, so rooms with urn flush plugs drained themselves: First Rain went to 0/100.
3. Sweep (stir) genes were generated only inside the spring loop, so springless rooms never got stirring.

There was also a stop bug in `solver/evaluate.ts`: an idle pool counted toward the 120-frame settle window, ending runs before a delayed gate action fired.

**Fix:**
- Controls are sampled at 50% per genome, and mutation can add a control.
- Sweeps are generated independently of springs.
- Early-stop requires 120 ticks after the last action.
- Each has a node coverage test in `solver.test.ts`, e.g. `samples player gates independently in $id` and `generates and mutates sweeps without springs in %s`.

**Why this matters:** Before trusting a zero, count how many candidates contained the intended action combination; on the corrected runs it was 27/27, all clearing. Classify every clear by the control state at first urn arrival, then ablate (no-stir; no-vent) before calling anything a shortcut. Search results: `memory/research/verdigris-v3-2026-10-31/accept/v2/` (local).

## A toy's short horizon can report a mechanic that does not exist

**Symptom:** The air toy reported "strong updraft keeps 11.25/11.25 units aloft at tick 180" ("cloud shelf"). A room built on the exact same vent ((18,20)→(30,20), vy −96, radius 5) got 0.97/8 into the urn; the water fell after about 3 s.

**Cause:** The toy measured at one instant (tick 180). Delay was misread as suspension.

**Fix:** Before a mechanic becomes a level premise, measure it for at least 2× the time the level needs it. Read the steady state, not a snapshot. Evidence: `/tmp/verdigris-v3/rooms/cloud-shelf/` (copied to `memory/research/verdigris-v3-2026-10-31/rooms/cloud-shelf/`).

**Why this matters:** Two of seven planned rooms died at tuning: Cloud Shelf here, and Head Throw because a draining full tank sweeps back through every range. A long-horizon toy check would have caught both before a lane spent hours on them.

## Headless Chrome rAF timestamps quantize near 16.7 ms

**Symptom:** A run with 0% dropped vsync reported frame p95 = 16.8 ms and "failed" a literal ≤16.7 ms gate.

**Cause:** Headless synthetic-vsync timestamps step through about 16.6 / 16.7 / 16.8 ms. Chrome logs `CVDisplayLinkCreateWithCGDisplay failed` because there is no real display link.

**Fix:** Gate on dropped-vsync % (intervals > 1.5 × 16.67 ms) alongside p95, with tolerance for one quantization step. Evidence: `memory/research/verdigris-v3-2026-10-31/arch/floor/report.txt` (8/2 runs: 0% drops, one p95 = 16.8).

**Why this matters:** A literal p95 gate picks the wrong solver configuration. Here it selected 12/2 (−13% jet reach) over 8/2 (near-baseline quality).
