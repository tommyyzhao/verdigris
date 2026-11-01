# Jetmaze — three-room prototype

Status: **implemented and validated as a three-room localhost prototype** at `http://localhost:5180/puzzles`. Final functional, sustained-runtime, replay/refinement and held-out checks passed. Earlier failures remain below; enjoyment and unfamiliar-player timing remain unverified.

## Play contract

- `/puzzles`: mouse-follow character; click the character to start. Space on the focused arena pauses/resumes; native Pause, Resume and Restart buttons remain keyboard accessible. Pointer/focus loss pauses without automatic resumption.
- Three sequentially unlocked rooms: Read the Pulse, Crossflow, Switchback. Replay unlocked rooms; successful best scores persist locally in the browser. Invalid/unavailable storage falls back to in-memory progress.
- 100 HP. Independent raw red dye burns up to 40 HP/s; blue slows up to 40%, with a one-second fading tail at the latest exposure strength; green heals up to 25 HP/s. Intensity below 0.05 is harmless. Red and green apply simultaneously; healing does not erase gross damage for scoring.
- Yellow gold is a finite set of explicit, expiring spark IDs, moved by sampled fluid velocity and blocked by walls. Additive red+green color never creates gold.
- Valve pads toggle once per entry, with visible connections to complementary nozzles. Enabling a nozzle begins a complete warning. Source shutoff leaves real dye to dissipate.
- Reaching the exit alive wins; no hidden valve combination or gold requirement. Death resets the room and waits for a new click. No knockback, pathfinding, special abilities or cyan reaction.
- Successful score: `1000 × (1 + gold/maxGold) × (1 + clamp((90−activeSeconds)/60,0,1)) × (1 + max(0,1−grossDamage/100))`; a room without gold uses gold factor 1.

## Implementation

`jetmaze.ts` owns pure rules; `rooms.ts` owns tile geometry; `jetmaze-fluid.ts` adapts the existing engine; `render2d.ts` draws raw fields and gameplay state; `+page.svelte` owns lifecycle/input/persistence. No engine algorithm, library default or public API changed.

One 128×128 fluid simulation uses velocity-only upstream line nozzles and separate compact pigment sources. A single tile authority drives SVG fluid obstructions and player/spark collision. Hazard effects sample raw channel values, not rendered colors. Non-color plume symbols preserve overlapping identities; reduced motion removes decoration, not hazards or collectible positions.

Original sparse-divider layouts were rejected after actual page clears took only 4.0–4.6 active seconds without damage. The current revision uses serpentine corridors with a central shortcut: a valve trades an easier early corridor for an active jet at the shortcut. Room 1 offers finite recovery; room 2 adds finite gold near that current; room 3 adds a later blue redirect. Warning/emission/off remains 1/0.5/3.5 seconds; movement and damage were not slowed or increased to manufacture difficulty. Revised rooms are authored candidates, not proof of 30–60-second challenge or enjoyment; actual play must establish that.

Wake Courier is preserved at `/puzzles/courier`. Its older incomplete verdict, and Countercurrent's failed experiment, remain unchanged.

## Verification summary

- **CPU/package:** 1,020 tests passed; 527 files checked with zero errors/warnings; packaging, publint, public declarations and demo build passed. Packaging retains its `import.meta.env` portability warning.
- **Jet foundation:** 26 G3 cases passed; paired raw screenshots inspected. See `2026-10-29-jetmaze-gate.md` for preserved failures and measured bounds.
- **Sustained runtime:** 5/5 sixty-second configurations passed, including two simultaneous jets, repeated transport, concentration limits, channel checks, drain and timing.
- **Actual game:** three canonical damage-free wins; real red damage/death/reset, green recovery, blue chill, moving finite gold, pause and saved/in-memory progression observed. Three held-out perturbed routes also passed with blocked progress writes.
- **Mounted browser regressions:** 2/2 passed, including invalid/blocked storage and the synthetic loss-event guard.
- **Replay/refinement:** 12 full recorded-input runs passed. All three base/repeat/half-step walkthroughs won; repeats matched exactly, HP/gold matched, maximum final-position difference was 0.00125 board units and exit-time difference 0.004167 seconds.
- **Scope:** Chromium 148 on M2; agent-operated input, screenshots and recordings. No unfamiliar-player, other-browser, mobile hardware or enjoyment claim. Machine-local artifacts preserve every failed run.

Earlier 676-file baseline digest `e410cdc4dfc0ca3abda5f24f649ef510397dde0b6f8f6502160ff710cc68cac0` is historical. The revised gameplay source is the 678-file candidate documented below; later test-only corrections and this report do not alter gameplay.

## Actual-page baseline, preserved

One nine-attempt agent-operated batch on the sparse-divider candidate recorded seven reported passes and two failures. Canonical room clears: 4.142 s, 4.567 s (all three gold), 4.000 s; each had 100 HP and zero gross damage. Pause/resume/reset/storage persistence and a small pointer perturbation worked in those observed runs. These times confirm the layouts were too trivial for the intended challenge; successful assertions were not treated as a fun verdict.

The red-contact/death and green-heal scenarios failed to observe damage. Their scripted approach unintentionally crossed a valve pad and disabled the target jet; this is a driver failure, not evidence that red cannot damage. Revised scripts explicitly check valve state and avoid the pad. Blue contact/chill and gold collection were observed. Two inherited Google Fonts requests were blocked and retained in the report; no application data was sent by the driver.

The runner mistakenly counted Playwright's video encoder as a second browser and retained its GPU lock. Separate exact PID/profile/group checks proved Chrome, encoder and server had exited. The owner explicitly approved release of only that job's lock; original failure receipt remains unchanged, with a separate recovery receipt. Future runners classify the browser and video helper separately.

## Serpentine actual-page authoring

Frozen 678-file candidate digest `33887f7c85f8df679a504528de28d5f006ba9eaa39914778fd279bf9762da4f3` completed a second nine-attempt actual-page batch: **8/9 reported passes**, no page errors. Canonical clears were **16.383 / 16.575 / 19.392 active seconds**, each 100 HP and zero gross damage; room 2 collected all three gold. Repeat and small pointer perturbation cleared room 1. These agent-operated clears are faster than the 30–60-second first-play target; that target and enjoyment remain unverified, not silently claimed met.

Red contact produced **95.089 damage**, leaving **4.911 HP** when its 30-second observation deadline ended; damage worked, death/reset was not yet observed. A separately recorded longer death-only check subsequently **passed**, with no game-balance change: actual contact caused death, the complete reset state matched the initial ready state (100 HP, time zero, valves/resources/sparks reset), and a real click restarted play. Green recovery increased HP from 72.560 to 73.560 during observation. Blue chill rose during contact and reached zero after leaving; two gold collected in the contact scenario. An uncollected gold spark moved from approximately x=0.4745 to x=0.5697 in 0.458 active seconds, then expired: actual fluid-carried movement, not only ambient-velocity inference. Lead inspected healing, blue/gold and completed-room screenshots. Chrome/video helper/server exit and owned-lock release were proved automatically by the corrected runner.

Mounted-page regression initially passed blocked-storage/context-loss handling but failed its reduced-motion visibility oracle because a white hazard glyph covered the sampled pixel (`255 > 305`). The oracle now compares added red-dominant pixel area against a no-field baseline; renderer/gameplay unchanged. Deterministic replay/refinement subsequently passed: 12 completed runs across three rooms (base, identical repeat, half timestep and zero-source control). The frozen ten-second early-corridor inputs reproduced exactly; half-timestep comparisons had zero final HP/position difference and matching status/gold. These traces do not reach the exit, so they are not full winning-walkthrough refinement proof. Sustained runtime subsequently passed **5/5 cases**, each 7,200 ticks (60 simulated seconds), plus the sources-off check. Both open lanes exceeded 0.05 on every one of 12 pulse cycles; minimum recorded per-lane pulse maximum was 0.118469. Closed fixture exposure stayed zero. Maximum donor displacement was 0.382891; per-case 16-tick p95 was 72.6–98.4 ms against a 132 ms budget. All fields were already below the deadzone at the first drain tick after the final off period. This validates the specified repeated-source configurations, not arbitrary geometry or physical impermeability. The longer death/reset check passed. Corrected mounted regression passed **2/2 tests**: real mounted input/pause/reset and blocked-storage/synthetic context-loss guard. This synthetic event test is not a hardware context-loss test. Held-out pointer perturbations passed **3/3 actual-page clears**, all 100 HP/zero damage, at 16.542 / 16.450 / 19.375 active seconds. All three attempted progress writes were deliberately blocked; storage stayed empty while in-memory unlock progression still worked. Full winning-recording refinement then passed **12/12 completed runs**: all base/repeat/half-step walkthroughs won, exact repeats matched, HP/gold matched, maximum position difference 0.00125 board units and maximum exit-time difference 0.004167 seconds. Recorded base wins reproduced the actual page's 16.383 / 16.575 / 19.392-second outcomes. The fixture preserves the source recording hash and literal input ticks; no position or win state is injected.

CPU suite: 1,020 tests passed; check: 527 files, zero errors/warnings; package/build pass. The initial long-runtime job lost its browser connection after approximately 148 seconds and produced no attempt JSON; that failure is preserved. After M2 restoration, exact exit/lock proof was recovered, progress checkpoints were added, and the subsequent complete sustained run passed. Disconnect cause remains unknown.

## Verdict and remaining limits

**The requested three-room prototype is functional and ready to play.** Real-page observations cover every color, valves, completion, death/reset, pause and local/in-memory progression; numerical and sustained checks passed. No additional feature work or GPU jobs are queued.

Known limits: unfamiliar-player fun/30–60-second first-clear timing unverified; recorded practiced clears are 16–19 seconds. Only the tested Chromium/M2 environment is claimed. Mobile hardware, other browsers and real hardware-triggered context loss remain unverified. The time-score factor intentionally reaches its existing cap below 30 seconds; it does not distinguish the recorded fast clears. No late balance retune was made to manufacture better results.

All final browser/video-helper/server process exits and GPU-lock releases were verified. Remote artifacts remain preserved under the cleanup hold; localhost preview is intentionally retained. No commit, push, release or dependency installation performed. GPU execution stays on M2 under owned lock/load/lifecycle controls; raw job and process handles remain machine-local. No universal browser, physical-fluid or fun claim follows from passing tests.

## Crossfire revision — G0, first arena only

The tighter-control, Geometry Dash–inspired revision replaces the serpentine candidate with Crossbeat first; Undertow and Pressure Room are not yet authored. The earlier verdicts above describe the earlier prototype, not this revision. **G0 overall failed:** the open divider's first complete 216-tick cycle reached only **0.035583** in its middle receiver lane, below 0.05 (other lanes: 0.100525 and 0.088562). The remaining 32 full cycles passed the lane control; open drain was not reached. No retry or tuning occurred.

| Case | Simulated ticks | Result | Maximum donor displacement | 16-tick p95 | Source-off drain |
|---|---:|---|---:|---:|---:|
| Closed | 7,200 | Complete; receiver maximum 0 | 0.400035 cells | 86.3 ms | 762 ticks |
| Open | 7,200 | Failed first-cycle lane control | 0.389374 cells | 89.2 ms | Not reached |
| Crossbeat | 7,200 | Complete; not an overall pass | 0.413032 cells | 88.7 ms | 744 ticks |

Crossbeat's post-warmup full-cycle active coverage medians were **17.956–25.098%**, with maximum sampled active coverage **25.418%** and no coverage failures. Coverage counts raw RGB/yellow above 0.05 in the 128² core texels of tiles 2–13, excluding walls and the spawn tile; source halos and line endpoints remain included. Maximum spawn concentration was 0.00000751. The conservative safe-tile diagnostic found a route in 601/601 samples; it is not a player-path or cover-protection proof. Lead inspection of raw PNGs showed compact jets and residue, not proof of whole-room flooding or enjoyment. Raw coverage alone does not indicate a pigment-radius increase.

All cases started with zero sampled fields. Final integrated CPU verification: **1,023 tests passed**, 528 files checked with zero errors or warnings. The frozen 270-file source digest was `856d0b086fa9e361bde910dedec47175301b889a757010a5dd471e6747ef8890`; collected evidence JSON SHA-256 was `3839cfcba07d90182bc98cc328f33b881aa147a12324a8756c4e35bd3bbd73f4`. Source parity and owned process exits were verified; the owned GPU lock was released.

Actual-page play, fresh-start rush, green activation, human enjoyment and the remaining arenas remain untested. Renderer identity is unverified. No claim transfers the old three-room results to this candidate.

### Subsequent G0 actual-page diagnostic

Execution completed, but **cold-start rush design failed**. A 0.2-board north target was reached in 0.083333 game seconds; the subsequent straight clear took 0.53125 active seconds with 100 HP, zero damage and no valve/resource use. A separate fresh border rush cleared in 0.639583 seconds with the same HP, damage and choices. Neither result establishes engaging first play.

A central observation ran 25.04 seconds after entry: green activation and healing occurred, with 80.310 HP remaining and 34.457 gross damage at the end; reported healing included capped healing. Green containment and numerical envelope were not tested. Inspected screenshots showed sparse cold-start source-local dye and later red patches, not proof of enjoyment or continuous action. The earlier open-lane numeric failure remains unchanged. Renderer identity, human fun, full temporal video review and remaining rooms remain unverified. Exact frozen source digest matched G0; page evidence report SHA-256 `0ebec9cd7dcafa60ca084a1d607498aacc217a820558ec24adc37f53f49319fe`. Owned process exits and lock release were verified.

### Local warmed Crossbeat G1

One local numeric invocation passed all three cases under the **warmed initial condition**: 216 fluid-only warmup ticks, 7,200 active ticks and source-off drain per case. Cold G0's failure above remains unchanged. Closed receiver maximum was 0; open control exceeded 0.05 in all three lanes on the first active cycle and all 33 complete cycles, and drained. Crossbeat late-cycle median active coverage was **22.150–25.519%**, maximum sampled coverage **25.950%**; maximum donor displacement **0.413032** cells/tick and 16-tick p95 **93.4 ms**. Finite fields, containment, spawn, open-control and drain checks passed without threshold changes. Renderer identity was not instrumented.

Three actual-page attempts observed 0.2-board tracking in **0.083333 active seconds** and byte-identical Ready captures across resets, with time 0, HP 100 and resources unused. A direct clear took **0.285417 s**, with **0.5357 gross damage**. A perimeter route cleared in **0.620833 s**, HP 100, no damage or valve/resource choices: a weak bypass remains despite the warmed field. Central play won at **25.7125 s**, HP **75.9108**, gross damage **46.8994**, gross healing events **33.6373** (including capped healing), with green used and valves toggled. No page errors, engine interruptions or movement timeouts occurred. Inspected images do not establish fun, continuous action, green containment or full temporal video review.

The local source manifest contained 270 files, digest `730c04a5737ff54de1be10e4cf4db09ad81ddd1d25f637652f430d72b5a90e86`; source hashes were unchanged. Evidence and exact owned-process exit/lock cleanup are retained in the machine-local archive; numeric evidence SHA-256 `c41e853eea15c482c7abebe0da95e80dc9e76a219a5318ea4947c331b3b38b3d`. The prior M2 G1 exit 70 remains unresolved after SSH loss; no M2 pass is claimed. Only Crossbeat was tested here. A room 1 upstream-exit candidate at tiles (6,10) is underway; rooms 2 and 3 remain unvalidated. No unfamiliar-player enjoyment claim.

### Three-room local numeric candidate

Five numeric jobs and five identity/channel cases passed on the 269-file candidate digest `0b7a2f300a89ca10691633bc505b0bf4460b311073fc8d428f85f895f9d2d207`. Late-cycle median active coverage was **22.23–27.11%** in Crossbeat, **24.28–28.61%** in Undertow and **16.08–20.44%** in Pressure Room. Maximum donor displacement was **0.4268235** cells/tick; maximum 16-tick p95 was **98.5 ms**. Closed receiver maximum was 0 and protected-spawn maximum was **0.000003636**. All four open-control lanes passed their first full cycle; drains passed. Finite green/gold source windows and channel identities passed. Raw PNGs were inspected. These local numerical results do not establish gameplay, enjoyment or an M2 pass.

CPU verification: **1,029 tests passed**, 527 files checked with zero errors or warnings; prepack and build passed. Numeric evidence SHA-256 `30c281da05536bc0efedc5658b5df0a9e2c85654623995afa2a8c65e4a6b9976`. Actual-page, regression and replay results are recorded below.

The local final batch passed **4/4 mounted regressions** and completed **8/8 actual-page attempts**. Canonical room wins took **0.570833 / 0.570833 / 0.6375 active seconds**, with HP **98.1252 / 99.4388 / 99.9064** and gold **0 / 2 / 1**. Three held-out wins were verified with one, two and three blocked storage writes, respectively. Red exposure caused death; the full warmed reset, death feedback and a real click restarting play were observed. Tiny gold movement was observed in raw spark positions, not established as visibly obvious. All sampled blue chill in the quick wins was zero; the focused probe below subsequently observed it.

A fresh perimeter clear took **0.5375 s**, with **0.5321 damage** and no valve or resource choices. Fast clears are legal, but this remains a weak challenge observation, not evidence for a 30–60-second first clear or unfamiliar-player enjoyment. Source digest remained unchanged throughout the batch. Exact owned cleanup was confirmed; the 62-artifact archive is retained machine-locally. Page evidence SHA-256 `71858f9aab31440204347b0f5b788653f80dd83261516ca2c17d82e052c09858`.

The focused blue actual-page probe completed **2/2 observations**, without reported errors: room 1 unlocked room 2 in **0.5875 s**; blue contact was observed over **8.016667 active seconds**, reaching chill strength **1**. Room 2 then won at **9.354167 s**, HP **91.875687**, gross damage **8.124313**, with two gold collected. Sixteen spark frames were retained; this does not establish visibly obvious gold motion. Blue evidence SHA-256 `d1d391d6c27a886a1b66842616267ce1ac6046841a9b63b2160281c94636fbfd`.

Recorded winning inputs replayed in the model across **12/12 complete, error-free runs**. Three exact repeats matched; base runs matched actual-page HP, position and time exactly. Half-timestep HP differences were **0.0744055 / 0.0414351 / 0.0281931**; final position and time differences were zero, with matching gold and status. Three zero-source controls completed 5,400 ticks. Replay is not a second actual-page run or proof of solver intermediates. Replay evidence SHA-256 `925bc19697170c8933ce5aa7bd7d248c54dda4a80117801b31bd519b843fd85d`.

The final 269-file replay/blue source digest was `b58c183b9e646f5f14ba1e7a7e355fab1f660e66108d65cee5441ce4b6357a5b`; only the replay test differed from the earlier digest, with production source unchanged. Owned browser and helper exits and local lock release were recorded; independent inspection found no owned processes, profile directories or source changes, with the local lock absent. M2 remained untouched. Practiced fast clears do not establish unfamiliar-player fun or a 30–60-second first clear; cross-browser and mobile hardware remain unverified.
