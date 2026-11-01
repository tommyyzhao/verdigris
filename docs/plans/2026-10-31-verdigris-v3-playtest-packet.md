# Verdigris v3 — owner playtest packet (lean round R01)

Method: `/tmp/verdigris-v3/research/playtest/` contains `protocol.md` (§2a lean format, §2b remote setup, §6 pass gates, §7 kill table), `checklist.md` (the run card) and `instrumentation.md`. This packet fills in the **freeze sheet**: everything that must be fixed before tester 1. Sign and date it, then hash it (`shasum -a 256`) and keep a read-only copy.

## Freeze sheet

```
round_id: R01   protocol_version: 1   format: lean (2 rooms, ≤40 min)   frozen_at: ____   owner: ____
build_commit: <feat/verdigris-v3 HEAD at freeze>   build_hash: shown in study log header
level_data_hash: study log room_start.level_hash   engine_settings: 192×120, 60 Hz, seed 71429
room_order (scored): still-pond, bring-it-back
  - Testers first play first-rain and breath, unscored, as onboarding (≤4 min, inside the 20-min silent block).
  - Hidden Draft and Two Springs are NOT assessed this round.
device: laptop/desktop (owner decision: no phones), current Chrome/Edge/Safari 26/Firefox
  - hardware acceleration on; /check = PASS before scored play
audio: on by default, tester may mute   progress: fresh (the study mode resets it on consent)
audience: puzzle-curious adults, never played Verdigris; quota 2 low / 1 medium / 2 high puzzle experience
known bugs: none open at freeze (review: 11/11 fixed; see the fixes merge)
prohibited help: no hints beyond the in-game tiers; no explaining controls beyond the neutral controls check
stop conditions: distress, technical failure (log as technical, not a quit), withdrawal
```

## Room keys (frozen)

### Still Pond: node A2→A6, "release still water so it falls through the wind"

- **Wrong belief:** "Blow hard enough and the pond spills over."
- **Insight statement:** Wind moves falling water, not resting water. Pull the plug so the pond becomes a falling ribbon, and aim the draft so it carries the ribbon over the wall.
- **Strategy dictionary:**
  - S1: vent aimed at the pond (expected first move).
  - S2: vent cycled through headings with the plug closed.
  - S3: plug opened with the vent off or left (water lost to waste).
  - S4: vent right, then plug (canonical).
  - S5: plug, then vent right within ~0.4 s (also clears, at lower reserve).
  - S6: stirring at the pond.
- **Correct rule clauses:**
  - (a) the target is the urn behind the wall;
  - (b) the draft only moves water that is falling or airborne;
  - (c) opening the plug turns the pond into a falling stream;
  - (d) the draft must point toward the urn while the water falls.
- **Critical misconception:** "the wind pushed the pond over the wall" or "the plug alone did it".
- **Transfer prompt:** freeze a screenshot of a new layout with the pond on the right, the urn on the left and the vent below the shelf. Ask: "Where should the vent point, and what do you do first? Why?" Answer key: point the vent left; open the plug; the vent moves the water only once it falls.
- **Normal waiting:** about 2 s of falling and settling after the plug opens.
- **Hints (in game):**
  1. Wind bends falling water, not water resting in a pond.
  2. The sill is above the pond. The brass floor plug can make a falling ribbon instead.
  3. Aim the side draft right. Pull the floor plug so the falling water travels over the wall.

### Bring It Back: node A8 composition, "still water is not lost: release it, then let the air take it"

- **Wrong belief:** "Water pooled in the wrong place is lost."
- **Insight statement:** The trapped water still has height. Open the sluice so it jets out, and turn the return draft so the falling jet is carried to the urn.
- **Strategy dictionary:**
  - B1: sluice opened with the vent at its default left heading (water lost).
  - B2: vent turned with the sluice closed.
  - B3: vent right, then sluice (canonical).
  - B4: sluice, then vent right soon after (also clears).
  - B5: stirring the pool.
- **Correct rule clauses:**
  - (a) the urn is the target;
  - (b) the tank's water level makes a jet when released;
  - (c) the draft bends the falling jet;
  - (d) the draft must point at the urn when the jet passes.
- **Critical misconception:** "the vent pulls water out of the tank".
- **Transfer prompt:** "If the tank were half as full, what would change, and what would you still need to do?" Answer key: the jet is shorter or weaker, but you still release it and aim the draft. Any causal mention of head or reach earns clause (b).
- **Normal waiting:** about 3 s of jet flow after release.

## Pre-registered gates (lean, selected rooms)

Use the defaults in protocol §6, unchanged:
- unaided clear ≥4/5 within 300 active s;
- understanding/transfer ≥4/5;
- supported aha ≥3/5;
- time to aha in the 30–180 s band;
- enjoyment median ≥5/7, competence median ≥4/7;
- want-more ≥3/5 in the 3-min choice;
- no quit cluster;
- fluid causality ≥4/5.

Strategy autonomy is NOT assessed in the lean format.

**Room-specific risk to watch.** Blind search clears both rooms often:
- Still Pond: 114/200 MAP-Elites;
- Bring It Back: 126/200 MAP-Elites, 5/100 random.

Every clear used the intended mechanism, so these are not shortcuts. But the kill table's "accidental success / too trivial" rows are the most likely failure. Score clause (b)/(d) explanations strictly. **Pre-registered response:** if ≥3/5 clear but cannot state clause (b), add one constraint that makes random cycling costly, for example a finite pond with no second chance per release, before re-testing with a fresh cohort.

## Build / run

1. **Build.**
   - Run `VITE_STUDY_BUILD_HASH=$(git rev-parse HEAD) bun run build`.
   - Serve `build/` over **HTTPS or localhost**. A static host is fine; nothing uploads.
2. **Pre-flight.** The tester opens `/check`, presses Run compatibility check, and reads the code aloud. The facilitator sets "Prior capability check = PASS" in the panel.
3. **Start.** The tester opens `/?study=1`.
   - Consent dialog: accept or decline.
   - The facilitator fills round R01, participant P0n, format lean, assessed rooms Still Pond and Bring It Back.
4. **During play.** Follow the run card (`checklist.md`). The study panel provides phase change, break, markers, free choice and finish/export.
5. **Export.** Use the local JSON download, with clipboard as fallback. Store it under `~/Documents/Verdigris-Research/R01/P0n/`, never in Git.

## What the evidence already says (for reading results)

- Each room verifies that **air is necessary**: air-off fails in Still Pond (0/12 units in the urn) and in Bring It Back (0 units).
- Each passes its jitter test: ±3/6/12 ticks and ±.25/.5/1 LU, 10/10 at each level.
- Determinism holds: same seed, identical particle hash. Proven same-device only.
- Frame pacing on a base M2 (Breath, real game): p95 16.7 ms, 0.3% dropped vsync.
- Hidden Draft's key cue is weak in stills: the mist drifts about 6 LU in 1.5 s. If it is tested later, watch whether players use the puff.
