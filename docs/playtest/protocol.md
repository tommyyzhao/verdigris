# Verdigris v3 — five-fresh-player playtest protocol

**Status:** proposed protocol, not test results. Version 1, 2026-10-31. Sources `[ID]` resolve to URLs, exact support, verification limits and access date in `sources.md`. All numerical gates below are **predeclared owner/design targets**, not universal research norms. No claim of statistical validation, critical acclaim or commercial demand follows from passing.

## 1. Decision question and round structure

Can fresh players discover a **causal fluid relationship**, use it deliberately to overcome a meaningful obstacle, explain/transfer it, then voluntarily want more? A clear animation alone is insufficient. Games need appropriate challenge, not maximal efficiency [P03]; combine behavior, context and subjective experience [A09, TRUE08, GUR18].

| Round | Five new testers; one frozen scored build | Primary decision |
|---|---|---|
| A: mechanism discovery | One onboarding + one core discovery + one composition room; greybox acceptable | Is there an intelligible, desirable puzzle rather than uncontrolled fiddling? |
| B: teach/transfer | New players; revised sequence; one changed causal hypothesis | Do learning and insights survive a different configuration without facilitator explanation? |
| C: confirmation | New players; content lock; no between-player changes | Do all preregistered gates pass again? Proceed to broader testing, not release certification. |

Run A/B as needed. Two consecutive fully passing frozen rounds, including C, permit expansion. If resources allow only five total, call it one formative round and retain uncertainty. The scheduled rounds are not an excuse to ship three batches of identical failure.

**RITE lane, explicitly separate:** obvious broken controls/readability may be repaired immediately and verified with the next fresh tester [R02]. Once changed, assign a new build/condition ID, preserve prior rows, terminate that frozen cohort; recruit a fresh five for an actual 4/5 gate. Do not label mixed builds “one n=5 round.” A severe blocker can stop a round after one person; never keep distressing people to fill a denominator. Ambiguous causes require more observation, not automatic feature additions [R02].

### What n≈5 can/cannot tell us

Can reveal recurring control misunderstandings, wrong causal models, accidental solves, extreme stalls and concrete reasons to iterate. Can falsify an intended experience for those players. Cannot estimate a population solve/enjoyment rate precisely, rank market appeal, detect rare failures reliably, compare architectures or prove that a UI change caused improvement. The same five people playing three rooms are **five independent people, not n=15**. Fixed-order rooms test a teaching sequence, not independent room difficulty [NL93, TRUE08].

**Exact two-sided 95% binomial intervals (Clopper–Pearson, α=.05), independent-trial model** [NIST]. Values computed via binomial-CDF inversion; use these instead of normal intervals.

| Observed k/5 | Sample rate | 95% interval |
|---|---:|---:|
| 0/5 | 0% | 0.00–52.18% |
| 1/5 | 20% | 0.51–71.64% |
| 2/5 | 40% | 5.27–85.34% |
| 3/5 | 60% | 14.66–94.73% |
| 4/5 | 80% | 28.36–99.49% |
| 5/5 | 100% | 47.82–100.00% |

Thus 4/5 is an engineering gate, not evidence that ≥80% of a population succeeds. Even 0/5 quits does not establish a rare quit rate. Quota/convenience sampling adds selection bias; intervals do not repair that. Multiple outcomes/rounds do not have simultaneous 95% coverage. At a true issue occurrence of 10%, five independent tests find it with probability only `1−.9^5 ≈ 41%`; Nielsen/Landauer’s average-problem model is not a five-user guarantee [NL93].

## 2. Freeze sheet — complete BEFORE tester 1

Owner signs/date-stamps a read-only copy (or hashes it) before recruitment results are opened. No hindsight changes to targets. Record deviations next to results, retain original.

```
round_id / protocol_version / frozen_at / owner:
build_commit / build_hash / level_data_hash / engine_settings_hash:
room_order: onboarding, discovery, composition (exact IDs):
input/device/browser class / audio/default onboarding / progress state:
intended audience / recruitment channels / experience quotas:
room-specific insight statement (one sentence each):
observable strategy categories + target zones (dictionary version):
correct rule clauses / critical misconception / transfer prompt + answer key:
three hint texts for each room (relationship / location / procedure):
normal physical waiting states, predeclared per room:
primary thresholds: defaults below OR dated replacements before testing:
known bugs / prohibited facilitator help / stop conditions:
```

**Do not score an insight gate until its answer key and strategy dictionary exist.** New v3 rooms require new keys, reviewed against real-engine replays. Do not substitute existing v2 solutions for unbuilt v3 designs. Keep normal onboarding visible; benchmark “unaided by facilitator/hints,” not “untrained.” Record onboarding version.

### Example keys grounded in current v2 only

Existing authored data [CODE in `sources.md`] supports these provisional keys, not evidence of participant understanding:

- **First Rain:** pour onto a usable gutter/catch route, not straight at the urn; finite supply, stop after enough liquid; flow follows the geometry. Counterfactual: point to an existing alternative release position and predict catch vs waste before playing. Score causal route, not the exact authored x-coordinate.
- **Breath:** a directional air sweep affects falling liquid and enables a catch route; time the pour with the useful moving air. A stirred pool is not equivalent to redirecting airborne drops. Counterfactual: reverse the sweep before the same pour; predict trajectory change. Verify actual behavior before using the prompt.
- **Two Springs:** the mixed urn needs both species at the target ratio while the lower urn must stay pure sap; right-lip overflow can contaminate its neighbor; route/order/amount matter. Wax is available but is **not mandatory**: authored solution uses stir/pour without wax. Counterfactual: add dew to the pure-sap vessel or spill mixed fluid toward it; predict spoil/recovery. Accept any causally valid alternate solution.

One point each: target/constraint; operative causal relationship; deliberate controlling action; correct novel counterfactual. See scoring rubric below. Copy/pasting hint wording earns no causal point unless applied correctly.

## 2a. LEAN ROUND — solo owner, remote-first, ≤40 minutes

**Recommended starting format:** five fresh remote testers, **two preselected core rooms**, not the entire three-room sequence. Preregister `format=lean`, exact room IDs, prior training, available free-choice options and all exceptions. Never pool lean/full cohorts.

| Block | Hard cap | Change from full session |
|---|---:|---|
| Silent play | **≤20 min** | Two rooms ≤8 min each, same 300/360/420/480-s rules; remaining ≤4 min for neutral input checks/transitions, not a third full room |
| Behavioral free choice | **3 min** | Same equal choices; enacted still input + ≥60 s or earlier clear; shorter opportunity labeled |
| Questionnaire + transfer | **8 min** | Two rule/transfer keys, aha presence/dimensions, four enjoyment + four competence items; **omit strategy-autonomy items/gate** |
| Cued retrospective | **6 min** | ≤2 clips selected by fixed rules; all scored play ended |
| Debrief + save | **3 min** | Criticism/access question, withdrawal reminder, consented download/receipt check |
| **Maximum** | **40 min** | Consent/pre-flight completed beforehand; if needed during booked slot, subtract from silent allowance and label any unexposed room not assessed. Never rush consent/access rights |

Send information sheet/screener beforehand; verbally confirm consent **before any capture**. A 40-minute measured test block is not permission for undisclosed setup time: invitation states pre-flight is asynchronous, with a brief live consent check. If total live contact must be ≤40 minutes, complete consent within that cap, shorten neutral transitions or test one room; preserve each assessed room’s 300-s success window rather than silently truncating it.

### Lean primary-gate coverage

| Primary gate from §6 | Lean status | Interpretation |
|---|---|---|
| Reachable/operable | **ASSESSED — selected rooms only** | Same device scope; omitted room/full progression not assessed |
| Unaided clear ≥4/5 | **ASSESSED — selected rooms only** | Same ≤300 active-s window, cumulative restarts, no help/hints |
| Understanding/transfer ≥4/5 | **ASSESSED — selected rooms only** | Same causal/novel-prediction rubric; account for free-choice learning |
| Supported aha ≥3/5 | **ASSESSED — selected core rooms** | Same owner target; uncertainty retained, no latent-process proof |
| Time-to-supported-aha band | **ASSESSED if ≥3 timed events** | Otherwise inconclusive, not invented times; two clips may limit precision |
| Productive reasoning/impasse recovery | **ASSESSED if video/account sufficient** | Candidate telemetry alone cannot pass; absent evidence = inconclusive |
| Enjoyment/competence | **ASSESSED** | Same four items each; no shortened single-item substitution |
| Strategy autonomy | **NOT ASSESSED** | Four bespoke items omitted to protect the 8-min questionnaire budget; no autonomy pass claimed |
| Want-more behavior | **ASSESSED — 3-min opportunity** | Same declared ≥3/5 more-puzzle and ≥2/5 replay targets; cannot pool with 5-min full format |
| No quit cluster | **ASSESSED — short selected sequence** | No long-session/complete-sequence inference |
| Fluid causality | **PARTLY ASSESSED** | Causal explanations in selected rooms; dual-engine necessity requires both mechanics represented plus external real-engine ablation evidence |
| Omitted room/full progression/endurance | **NOT ASSESSED** | No full-protocol pass or complete teaching-sequence claim |

Two passing lean rounds permit **only the scoped decision** that the selected core mechanics merit further work; not a full-protocol pass. Later fresh full-format confirmation can assess omitted gates. If both core rooms require a teaching room first, include training inside ≤20 minutes with a frozen separate cap; do not claim three rooms received the full 8-minute protocol. Fewer clips can leave initial-understanding attribution inconclusive; never fill missing evidence with confidence.

## 2b. REMOTE SESSION — shared static-build link

**Implementation prerequisite:** current reviewed baseline has no research recorder, Finish-study/export control, or study questionnaire. Remote telemetry/download wording below specifies the required study build, not existing functionality. Until implemented and verified, owner may run a clearly labeled video/notes-only formative test; telemetry-derived gates/export claims remain unavailable. Remote is a mode, not automatic consent to transmit recordings. Complete ordinary hosting approval in the owning release lane; this protocol does not publish a build. Share the immutable versioned study link and information sheet privately; no solution documents or walkthrough previews. No installation required. Verify the static link’s build hash, research mode, fresh research progress and local export beforehand. Record coarse input/browser class and network interruptions; do not collect device fingerprints.

### Exact remote pre-flight checklist — complete before scored exposure

Owner sends a **capability-only test page** at a stable URL from the same approved static-build release. **No such page is verified in the current baseline**; implementation prerequisite, not an invented working URL. Test page contains no puzzle geometry, solution, onboarding mechanic or persistent player ID. It must exercise the actual liquid+air engines under the same settings, not only inspect extension strings.

- [ ] **Browser/build:** participant opens the exact versioned study link in a current supported browser; reads displayed build ID aloud. Owner records coarse browser family/version and input class, not full user agent or fingerprint. Use isolated research window/profile where feasible; no changes to ordinary browsing data.
- [ ] **Hardware acceleration/GPU:** ask “Is hardware acceleration enabled in this browser?” If not, offer ordinary browser settings/relaunch instructions if participant wants; never demand experimental flags, disabled security settings or driver installs. No collection of GPU vendor/device strings. A browser can report extensions yet fail allocation, so continue the actual test below.
- [ ] **Capability page:** “Please open the test page, press Run compatibility check, and tell me PASS or the displayed error category.” Require WebGL2, `EXT_color_buffer_float`, `EXT_float_blend`, renderable RGBA32F, successful actual liquid-engine allocation and air-engine initialization. The baseline explicitly checks the two extensions and RGBA32F framebuffer support in `LiquidEngine.ts:411–418` [CODE].
- [ ] **60-second smoke test:** both canvases render, test-only pour/stir inputs visibly respond, no unavailable/context-lost/error state or persistent frozen display. Record pass/fail and coarse error category; no personal paths/stacks. This is a compatibility check, not a performance benchmark. Dispose test engines before opening scored rooms to avoid extra live contexts/GPU load.
- [ ] **Audio/input/display:** “Can you hear this neutral test sound? Is the text readable? Does the test pointer respond?” Participant chooses volume/mute, mouse/trackpad, accommodations. Game sound remains on their device; browser-tab/system-audio sharing optional, microphone communication separately consented. Headphones if wanted; no music/voice-content capture required.
- [ ] **Share/meeting:** share **browser tab** if the meeting/browser supports it; otherwise game window only. Webcam optional/off accepted. Microphone for facilitator communication or agreed text fallback; voice recording/transcription separately consented, platform transcription disabled by default. Close chat/notifications that would cover game. Confirm “You can hear/read me, and I can see the game tab; not your other tabs.”
- [ ] **Log/download preflight:** on capability page, consented dummy-log export creates a local file without upload; participant can find it and use agreed private upload channel. No real personal data in dummy test. Research recorder shows enabled/disabled consent state and available storage/session status.
- [ ] **Clean first exposure:** no earlier rooms/screenshots/solutions; normal frozen onboarding enabled, study progress fresh, no coaching companion. Mark technical check complete, close capability page, then start room-ready timing.

**Capability failure fallback, exact wording:**
> “This device cannot currently run the game’s required graphics features. That is a compatibility issue, not anything you did. We can try another supported browser or another device if you want, reschedule, or finish now with the same compensation.”

Do not substitute a video walkthrough, facilitator remote-control session, lower-capability different physics or noninteractive replay as that person’s scored puzzle attempt. A streamed demo may be separately consented for UI impressions but is **not** direct fluid-control play; all solve/aha/transfer/agency gates not assessed there. Failed capability checks remain in reliability/recruitment counts. Replacement fresh tester may complete a fixed cohort, with original failure disclosed; do not exclude failures from the record. If a later room was previewed during troubleshooting, that tester is no longer fresh for it. Avoid recruiting around an unknown systemic compatibility fault; repair/recheck first.

**Before screen sharing, say:**
> “Please open the game in a separate browser window. Turn off notifications and share only the game browser tab, or that window if tab sharing is unavailable—not your desktop or other tabs. Sharing lets me observe live; recording is a separate choice. Your webcam is optional and can stay off. Keep the game’s audio at a comfortable volume; sharing tab audio is optional. You can stop sharing, pause, or end the session at any time. Please do not open design notes, walkthroughs or other people’s streams during scored play.”

Use the participant’s approved meeting service. Explain that live screen/audio sharing itself transmits content to that service and any meeting-platform recording/transcription feature must remain **off unless separately consented**. No bot recorder/AI notes. If they decline live screen share, proceed with local telemetry and private answers if acceptable; observer behavioral/impasse evidence becomes limited/unknown, not negative. Avoid mandatory webcam: no face stream means no nonverbal-face codes.

**No-help chat policy, read before silent play:**
> “During play, use voice or chat only for a technical/access problem, a break, a hint request, or stopping. Spontaneous reactions are fine; you don’t need to narrate. I won’t give puzzle advice or answer strategy questions over voice or chat. The game’s own hint button is available. If another person sends advice or you see a solution elsewhere, tell me so I can mark that room assisted; there is no penalty.”

Keep chat visible only on facilitator’s device if its notifications would obscure play. Respond to strategy requests with the same neutral script as in-person; log any accidental coaching. Do not ask them to report thoughts by chat or hold their cursor still. At the scheduled escalation time use the fixed offer; flag connection delay rather than counting it as player indecision.

**Timing:** runtime logs monotonic wall/active clocks locally, independent of meeting latency. At room-ready, facilitator notes the video timestamp/stopwatch offset and study room ID; optional consented recording provides a replay cue. Live facilitator marks candidate impasse onsets from video, then aligns with `idle_gap`/actions/hint/pause events in downloaded JSON. The ≥20-s idle threshold is candidate only; ≥30-s confirmed impasse requires exclusion of normal physical waiting and retrospective/spontaneous corroboration. A frozen share/network dropout is technical missingness, not an idle player. No local log until session end means live timings provisional; reconcile afterward, retain uncertainty rather than invent real-time telemetry streaming.

### Remote impasse/aha coding and connection drops

**Impasse/aha evidence, not webcam mind-reading:** observer places a timestamp marker for an ≥20-s no-action interval or repeated failed strategy seen on shared screen. After export, align video room-ready/pauses/restarts with local `wall_ms`, `exposure_active_ms`, `model_tick` and event sequence; keep mapping uncertainty. ≥30-s gap with expected waiting excluded remains candidate until participant corroborates no next idea. Spontaneous “oh”/changed strategy is a candidate, not confirmation. Cued replay asks “What did you expect here?” and allows no recollection. Aha support additionally requires post-play report and correct causal/transfer evidence; outcome/fanfare and quick cursor motion do not prove aha. Webcam-off means nonverbal facial codes **unavailable**, not absent. If recordings declined, live notes + local log may support selected codes with reduced precision; do not manufacture replay or exact insight times.

**Connection-drop instructions, read before play:**
> “If the call or screen share drops, release the pointer, press Escape to pause the game if you can, and leave the game tab open. Don’t reload or discuss the puzzle with anyone. We’ll reconnect through the same agreed channel. If you cannot pause, stop making inputs; we’ll mark that interval uncertain. If we cannot reconnect, you may finish the session and keep the same compensation.”

**Facilitator rule:** mark last reliable video time, stop live clock, send only reconnect/pause instructions. No strategy content. If reconnects within two minutes, verify whether game actually paused and whether unobserved actions/flow occurred. Local paused interval excluded from task clock; call downtime **not automatically subtracted** if gameplay continued. Continued/unobserved play remains in local gameplay duration but is observation-missing; log `connection_drop`, timing uncertainty and any scoring deviation. Do not restart the same room and call it fresh. If no inputs/paused state verifiable, resume from preserved state; if unknown, keep clear logs but mark observation-dependent aha/impasse gates inconclusive. If two-minute reconnect fails or player prefers stop, end session as technical interruption, not voluntary frustration quit; arrange safe export/withdrawal via agreed channel. A reload/context loss creates technical attempt/reset; lost log is missing data, never reconstructed as complete. Reschedule remaining **unseen** rooms or recruit a fresh replacement with failure disclosed.

**Export script, consented automatic local download:**
> “When you press Finish study, may the game download one gameplay JSON file to your device? Nothing is uploaded by the game. Please keep the file, and only send it through the private channel we agreed if you still consent. If your browser blocks the download, use Download log. You can decline sending or request deletion.”

With advance consent, `Finish study` is the user gesture that ends capture and triggers **one local auto-download**. Show filename/success-or-blocked status plus manual Download log fallback; browsers may block downloads, so never promise delivery. No auto-upload, unsolicited file chooser, download on page-close, or recording download without consent. If automatic download is declined, allow explicit manual save or no export. Owner confirms receipt and parses file; do not say complete just because the browser click occurred.

**Participant upload instructions, after download:**
> “Find `verdigris-[your study code]-[session ID].json` in your Downloads folder. Open the private upload link we agreed, check that it names this study and the intended owner, choose that JSON file only, and press Upload. Do not send your Downloads folder, screenshots of other windows, or recordings unless separately agreed. Tell me when it says complete; I will confirm receipt. You can decline the upload or ask to delete your data.”

Owner supplies an explicitly approved access-restricted upload destination before the session, never an invented/public URL. If no approved upload channel exists, keep the file local and agree a method later; **do not** claim delivery or pressure email/cloud sharing. Consent must cover the chosen service’s transfer/storage; no automatic game upload. Owner verifies code/build/sequence coverage and acknowledges receipt privately; no repeated upload request without explaining a failed receipt. Declining transfer is consent withdrawal for collection, not poor engagement.

**File handoff:** owner preregisters an access-restricted research folder **outside Git and outside ephemeral `/tmp`**, e.g. `~/Documents/Verdigris-Research/R01/P01/`; this is a suggested local path, not a directory created by this task. Store `session.json`, redacted `notes.csv`, consented `screen-recording` separately; recruiter/payment/consent identity mapping in a different restricted folder. Tell participant the exact approved private channel before sending; do not paste logs into public issues or this research dossier. No email/cloud transfer assumed authorized. Record raw/coded deletion due dates and actual deletion. Research-method artifacts remain in `docs/playtest/`.

## 3. Recruitment

- **Five fresh adults per round**, none previously saw this game/build, recordings, screenshots revealing solutions, design documents, authored solutions or prior sessions. Developers/contributors, household co-designers and prior testers excluded from primary cohort. Returning testers may separately test regressions, never “fresh.” Swift describes weekly fresh-player Portal observation [PORTAL07]; RITE also requires new participants for fixes [R02].
- Stable quota: **2 low / 1 medium / 2 high puzzle-game experience**. Screening asks last three puzzle games, approximate hours in previous 12 months, typical hint use, mouse/trackpad comfort. Low: <5 puzzle hours/year; medium: 5–40; high: >40. Borderline placement documented before session; do not reclassify poor performers. These bins are study choices, not validated gamer types.
- Recruit people willing to try a short puzzle, not only friends who admire the project. Do not advertise “test your intelligence,” “award-worthy puzzle,” “find the aha,” or intended mechanic. Do not promise perfect controls.
- Do not exclude accessibility needs because they might lower scores. Offer needed accommodations, document input/visual/audio settings and analyze access barriers explicitly. Unsupported device failures are technical outcomes, not “bad testers.” If this round is mouse/trackpad-only, disclose that scope; run separate targeted accessibility/device rounds later.
- Fixed compensation, including early withdrawal; no bonus for solving, praising or replaying. Recruitment/contact/payment data held separately from logs. No collection of exact age, gender, medical diagnosis or other demographics without a concrete research need.

## 4. Session schedule and exact script (~55–65 min)

One facilitator, one quiet observer if available. Same room order, device class and instructions. No designer hovering, audible reactions, nodding at good choices or praise for solving. Player sees no countdown. Only facilitator addresses participant. Screen/game recording optional; separate face/audio consent.

### A. Welcome/consent (5 min; recording OFF)

> “We’re testing the game, not you. We want to see what the game communicates without a designer explaining it. There are no intelligence scores. Some parts may not work well. Honest criticism helps us.”
>
> “Participation is optional. You can take a break, skip a question, stop playing, or leave at any time, with the same compensation. We can collect a local gameplay log with game actions and times, using a participant code, not your name. Separately, may we record the game screen? May we record your voice? May we record your face? Each is optional. The owner and named research team can access these files; they will not be posted or sent to outside analysis services. Raw recordings are deleted after 30 days; coded, de-identified study data after 90 days. Keep this participant code to request deletion within 14 days. Do you have questions, and which options do you consent to?”

Record affirmative/negative choices separately; begin only permitted recording after consent. If no recording, use live notes/time markers; mark timing certainty lower. Logs without direct identifiers are pseudonymous, not guaranteed anonymous. Stop recording before payment/contact discussion.

### B. Neutral controls check (3 min)

> “Please adjust the seat, sound and display so you’re comfortable. We’ll use the game’s own instructions. I can help with a technical problem or an access need, but won’t explain puzzle solutions. You can restart or use the game’s hints whenever you want. Using a hint is useful information, not a failure on your part.”

Use an inert input-check area, **not a sandbox that previews an unintroduced fluid mechanic**. Check click/drag/focus and pause only. If none exists, skip practice rather than teach the solution. Fresh isolated game profile/progress; never clear the participant’s ordinary browser data.

### C. Entire scored sequence: silent play (up to 24 min)

> “For this first play block, play as you normally would, without trying to explain your thoughts out loud. You don’t have to stay perfectly silent; spontaneous reactions are fine. I’ll stay quiet too. We’ll discuss what happened only after this play block. Try each room until you finish, want to stop, or I call time. You may ask for a break, stop, restart or open a hint at any time. Begin when you’re ready.”

Start each room clock when its board is visible, runtime running, input available; log a ready marker. Do not start when loading begins. Keep the first **300 seconds active wall time** a facilitator-help-free interval. Restarts do not reset this room-exposure clock. A requested/opened hint or solution-related facilitator help immediately marks assisted; continue for diagnosis. No live “what are you thinking?” or repeated warmth ratings; no required aha button. Concurrent reports can alter insight solving; even retrospective strategy questions **mid-problem** can affect subsequent solving [S93]. This is not universal think-aloud harm: Fox/Ericsson/Best’s 94-study meta-analysis found undirected think-aloud accuracy effect indistinguishable from zero, whereas directed description/explanation was reactive and all verbal-report methods increased completion time [F11]. Silence here is a conservative task-specific design choice; never compare timed silent and verbal cohorts as equivalent conditions.

If participant asks “What should I do?”:
> “Please try what you would try on your own. You can use the game’s hint button, continue exploring, or stop. I won’t explain a solution during this block.”

If participant asks a technical/access question, answer narrowly, log wording/time/reason. If the answer reveals game logic, classify help as assistance, not an exception.

**Escalation, no subjective judgement required:**

- At 300 s, if uncleared, unaided observation window ends. Say once: “You can keep trying, see the first in-game hint, move on, or stop. Which would you prefer?” Log offer + choice. Declining a hint is allowed; do not press. Any later clear is secondary, not primary 300-s success.
- If hint 1 accepted, open its prewritten relationship text only. At 360 s, if still uncleared, offer tier 2 in identical wording (“the next in-game hint”). At 420 s offer tier 3. Do not invent hints. Early participant-initiated hints allowed; next offer requires ≥60 active seconds since the previous reveal and never before scheduled 360/420 boundaries. Always log max tier ever seen, not current UI counter.
- At 480 s, if uncleared: “That is the end of this room’s scheduled play time. Would you like to move on or end the session?” Stop the room; record timeout, not voluntary quit. No demand for an explanation yet.
- If they quit earlier: “We can stop here. Would you like a break, another room, or to end the session?” No persuasion. Do not ask “Are you sure?” Distress/safety overrides time rules immediately.

Pause for genuine break/technical failure; label cause. Hidden tab automatically pauses in current runtime; exclude its wall-time interval. Time spent reading hints/looking at a still-running board counts as active task time; cognitive work does not require input. If a break involves game strategy discussion, mark contamination. Treat automatic resource `stuck` separately from human impasse; allow restart and observation of recovery.

**All scored rooms precede interviews.** After each room only log result and advance by standard UI; no explanation quiz yet. One-way move-on preserves unsolved outcomes. Facilitator-unlocked later rooms are `research_unlocked`, not evidence of natural progression.

### D. Private behavioral free-choice block (5 min; before questionnaire/replay)

> “The required play block is finished. For the next five minutes, you can replay a room, try an optional new room if one is available, play freely if available, or finish now and take a break. All choices are equally useful to us and compensation is unchanged. Choose on the screen; you don’t need to explain.”

Options must actually work, be equally visible, no default selection or praise. Separate **replay**, **continue/new challenge**, **sandbox**, **stop/break**. Log selected option, first actual gameplay input, duration, early return. Choice counts as enacted only after gameplay input plus 60 active seconds (or an earlier legitimate clear). Clicking “Replay” then leaving is not replay engagement. Do not fabricate “continue” if only three rooms exist; mark unavailable. Sandbox preference may support a toy pivot; it is not a puzzle replay.

### E. Private post-play questionnaire and transfer (8–10 min)

No facilitator commentary, answers before **cued replay discussion**. Offer spoken answers for access needs; transcribe neutrally. Do not correct errors. All per-room questions distinguish initial play **before hints**, any hinted play, and the optional free-choice block; assisted understanding scored separately. Aha timing may be unavailable: keep unknown, never invent a timestamp.

**Declared measurement tradeoff:** free-choice play occurs before explanation questions to avoid priming the choice with a rule quiz. A chosen replay can itself teach the rule. Therefore the questionnaire measures **post-session understanding**, not a proven mental state at first clear. Record whether the participant attributes learning to the original attempt, a hint, optional replay, or cannot remember. Report understanding of replayed vs unreplayed rooms separately; a correct answer learned only during free-choice cannot rescue an initially accidental clear or qualify a pre-hint supported aha. For initial-time understanding, require corroborating deliberate initial behavior plus time-linked account; otherwise label unknown. Neither ordering removes all reactivity/recall bias [ES80, S93, TRUE08].

1. **Unaided explanation (per room):** “In your own words or a drawing, what made this room work? What did you do that mattered? What would make the same approach fail?” Include “I don’t know.” No solution words supplied.
2. **Prewritten near-transfer prediction (per room):** show a static, unplayed, changed configuration or specific counterfactual. “What would happen if [frozen prompt]? Mark your prediction and explain or draw why.” No further feedback. This occurs after free-choice gameplay to avoid coaching replay behavior. If a playable transfer room is used, run it silently **before any interviews**, freeze a separate time cap/answer key, label it a separate outcome.
3. **Aha presence (per room):** “Did you have a moment when a way forward suddenly became clear? Yes / No / Not sure. It is fine if you worked it out gradually.” If yes: “Describe the moment briefly and approximately where it happened. Was that before or after any hint?”
4. **Danek-inspired ratings** [D14], per reported moment, 0–100 line scales with verbal endpoints, no preselected response: pleasantness **unpleasant—pleasant**; surprise **not surprising—surprising**; suddenness **slowly—quickly**; certainty **uncertain—certain**; prior impasse **in no impasse—in an impasse**. Add global intensity **none—very strong** as bespoke secondary item. No aha = presence No, rating fields NA, not forced zeroes. This room-specific adaptation is not the original validated instrument or a “Danek composite.” Relief optional secondary; do not replace the five original dimensions silently. These are **2014 retrospective** anchors; the 2017 trial-wise suddenness item uses **in steps—all at once**, not slowly—quickly [D14, D17]. Do not mix versions without a new frozen instrument. Since room clear/fanfare already supplied outcome feedback, certainty is retrospective confidence and pleasantness may include reward response; neither is an uncontaminated pre-feedback insight measure. Restructuring is inferred separately from changed predictions/transfer, never proved by aha intensity.
5. **Experience items, 1–7** (“not at all true”, “somewhat true”, “very true”), concerning this play block. Use these four per construct, interleaved in a fixed preregistered order; `R` means score `8−response`:
   - Enjoyment: “I enjoyed playing these rooms very much”; “These rooms were fun to play”; “I thought these rooms were boring” (R); “I would describe these rooms as very interesting.” Adapted official IMI interest/enjoyment items [IMI].
   - Competence: “After playing for a while, I felt pretty competent”; “I am satisfied with my performance”; “I was pretty skilled at this activity”; “This was an activity that I couldn’t do very well” (R). Adapted IMI competence [IMI].
   - Strategy autonomy: “I could choose an approach that felt like my own”; “I had more than one meaningful way to investigate”; “I felt forced to copy a prescribed sequence” (R); “I could decide how to test my ideas.” **Bespoke game-strategy items**, not a validated IMI/PENS autonomy scale. Official IMI perceived-choice items mostly ask choice about doing the activity; do not mislabel consent to study as in-game autonomy [IMI].
   - Optional participation-pressure check: “I kept playing because I felt I had to.” Report separately; never count it as strategy autonomy.
6. **Fluid necessity:** “Which part, if any, could be replaced by a fixed animation without changing how you solved the room? Which result did you predict from moving liquid or air?” Free text; no mention that the fluid “should be the puzzle.”

**Explanation/transfer rubric (0–4, each room):** award one independent point for (a) correct objective/constraint; (b) correct operative fluid/air causal relationship; (c) intentional action linked to that relationship, not merely a list of clicks; (d) correct prediction **and causal reason** for the frozen new/counterfactual situation. Explanation pass = ≥3/4 **including b and d**, no critical misconception. A fluent but false story fails. Valid alternate mechanics pass. A nonverbal diagram/demonstration can earn equivalent points. Two raters score without seeing enjoyment/aha ratings; disagreements resolved with retained original scores and rationale. One owner alone: rescore shuffled, de-identified explanations next day and disclose single-rater limitation.

### F. Replay-cued retrospective (8–10 min)

All primary gameplay and free-choice measurements already ended. Use recorded screen **as actually seen**, not a rerender whose fluid might differ. No recording: event timeline plus participant recollection, mark weaker source.

> “We’ll watch a few short parts of your play. Please tell me what you remember noticing or expecting at that time, not what you think you should have thought. ‘I don’t remember’ is helpful. You may pause the recording. We won’t change your earlier answers.”

Show one early attempt, first coded impasse, candidate strategy change, clear/failure; ≤4 clips per participant. Choose clips by those rules, not favorite reactions. Start 10–15 seconds before event; do not label it “your aha.” Ask:
> “What do you remember noticing here?”
> “What did you expect to happen next, if you remember?”
> “Did your expectation change here, or not?”
> “Was the movement you made here deliberate, exploratory, accidental, or something else?”

Only after their account, a neutral discrepancy prompt: “Earlier you wrote [verbatim]. Here [observable event] happened. How do those fit, if you remember?” Do not press for introspective mechanisms they cannot report [ES80]. Record retrospective vs spontaneous evidence separately. Recollection is not ground truth; preserve uncertainty [ES80, A09].

### G. End interview/debrief (5 min)

> “What was most satisfying?”
> “What was most frustrating or unclear?”
> “Was there a point you wanted to stop? Which point?”
> “If you could change one thing, what would it be?”
> “Was there anything that made the controls, display or audio difficult to use?”
> “Anything else we missed?”

Then disclose study hypothesis if asked, offer optional explanation after every scored measure is complete. Confirm withdrawal/deletion contact and compensation. Do not ask “Would you buy?” as a substitute for behavior; do not argue with criticism.

## 5. Observer coding sheet

One row per episode; timestamp active wall time **and** recording/log offset. Keep direct quote/observable fact separate from interpretation. Code uncertainty `confirmed / candidate / unknown`, source `live / screen / spontaneous_voice / retrospective / telemetry`. Expressions are not objective emotion measures [A11]; no facial inference from absent recording.

| Code | Operational definition | Onset/end rule |
|---|---|---|
| `OBS_ORIENT` | Examining goal/scene before first deliberate game action | Board-ready to first meaningful action; not automatically impasse |
| `IDLE_CANDIDATE` | No meaningful action/held interaction for ≥20 active seconds | Backdate to last meaningful action/held-interaction end; ends next one. Cursor wandering does not reset. Pauses/hidden/breaks excluded |
| `IMPASSE_IDLE` | Idle candidate ≥30 s, no authored waiting condition; retrospective player says no next idea/progress, or spontaneous explicit statement | Onset at start of qualifying gap; end at new hypothesis test, hint, room end. Without confirmation retain candidate, not cognitive fact |
| `IMPASSE_REPEAT` | ≥3 materially equivalent failed tests within 90 s, no new target/control/causal hypothesis; confirmed by replay account or explicit statement | First failed repeat in run; ends first different hypothesis test/hint/end. Equivalent trials defined in frozen room dictionary |
| `WAIT_EXPECTED` | Waiting for ongoing flow, settling, hold, gate/vine motion or another preregistered necessary effect | Mark interval and evidence; exclude from confirmed impasse. Low input alone does not mean stuck |
| `BELIEF_WRONG` | Specific falsifiable causal expectation contradicted by verified rules/observed state | Quote/diagram + target + contradiction. Retrospective account marked retrospective, never backfilled as spoken in silence |
| `BELIEF_CHANGE` | Player contrasts prior expectation with a new causal model | Record old/new model and which behavior changed. A new cursor location alone insufficient |
| `AHA_VERBAL` | Spontaneous “oh!”, “I see!”, equivalent utterance linked within 10 s to a specific realization/action | Timestamp utterance; quote. No “aha” prompt, no utterance requirement for insight |
| `AHA_NONVERBAL_CANDIDATE` | Abrupt visible laugh/smile/sit-forward/gesture followed within 10 s by a changed attempt | Timestamp visible behavior only; confirm meaning retrospectively or leave candidate. Never infer absence from no face recording |
| `STRATEGY_CHANGE_CANDIDATE` | New preregistered high-level strategy after an impasse, pursued consistently | Defined formally in instrumentation; candidate only until retrospective/rule evidence |
| `INSIGHT_SUPPORTED` | Player reports sudden realization, temporal match to strategy change, correct rule + counterfactual | Time interval from markers; before/after hints explicit. Impasse not mandatory [D14] |
| `ACCIDENTAL_CLEAR` | Clear occurred; player identifies triggering input as accidental/non-goal-directed; explanation fails causal/transfer key | Do not infer randomness merely from many actions. Retain borderline as uncertain |
| `FRUSTRATION_SIGNAL` | Explicit negative/quit-related statement or observable slam, repeated sigh, head-in-hands | Record event/quote, not diagnosis. Single frown insufficient; safety intervention immediate if needed |
| `QUIT_ROOM` / `QUIT_SESSION` | Participant explicitly chooses to abandon room/session before scheduled cap | Record choice/time/reason in their words. Exclude facilitator timeout, technical failure, planned break |
| `HINT_EXPOSED` | Any solution-relevant tier, prior solution knowledge, observer/facilitator coaching becomes visible/audible | First exposure permanently marks that room assisted; UI close/restart cannot erase |
| `RESTART` | Model reset within same room exposure | Reason `player/facilitator/technical`; exposure clock continues except technical downtime |
| `CHOICE_ENACTED` | Actual replay/new-room/sandbox input, followed by ≥60 active s or legitimate earlier clear | Record category, selection latency, duration, early abandonment; keep choice and enactment separate |

Double-code all five key strategy-change/quit episodes plus two randomly selected clips if a second observer exists. Report agreement numerator/denominator and boundary differences; with tiny counts do not overinterpret κ. Disagreement about aha stays visible rather than converted to a pass.

## 6. Preregistered gates and analysis

### Primary gates — freeze before tester 1

**All rows must pass; otherwise diagnose, not average away a failure.** Room 1 onboarding exempt from impasse/aha quotas, not comprehension/control gates. The owner can replace default timing bands for a genuinely different scope, but only before exposure to test data.

| Gate | Exact default |
|---|---|
| Reachable/operable | All 5 can attempt each scheduled room on declared input/device; no progression or technical blocker. Unreached downstream room is failure in sequence gate, separately `not_exposed` in room-specific analysis |
| Unaided clear | **≥4/5 each room**, clear event before or at 300 active wall seconds from initial board-ready, no tier or solution help. Any number of player restarts permitted, clock cumulative. Clear after five minutes/assistance only secondary |
| Understanding/transfer | **≥4/5 each room** ≥3/4 rubric including causal and novel-prediction points, no critical misconception, questionnaire before cued replay discussion. Report post-session understanding separately from understanding attributable to initial solving. Primary joint gate requires unaided clear plus correct understanding not attributable only to hints/free-choice learning; unknown attribution cannot silently pass |
| Supported aha | **≥3/5 in each discovery/composition room**, presence Yes, suddenness ≥70/100, correct rule/transfer, realized before hints. Narrative/timing evidence retained; not a literature-validated cutoff |
| Time to supported aha | Discovery median in **30–180 s**; composition **45–240 s**. Onboarding exploratory band **15–90 s**, no gate. Use first supported realization; require ≥3 timed pre-hint realizations in each gated room. Timings are intervals; gate passes only if the median’s whole supported interval lies in band; crossing a boundary = inconclusive/retest |
| Productive reasoning | In each discovery/composition room **≥2/5** show a confirmed impasse followed by a new, correct strategy unaided; **≤1/5** confirmed impasse lasting >120 active s before recovery/help/room end. This targets tension in these rooms, not a universal definition of insight [D14] |
| Enjoyment/competence | Per-person mean of four scored items per construct; at least 3 answered. Median enjoyment **≥5/7**, median competence **≥4/7**; list every individual score. Missingness affecting median = inconclusive, no favorable imputation |
| Strategy autonomy | Median bespoke score **≥4/7**; ≥4/5 have enough answers. Exploratory construct, stated limitation; if low, inspect coercion/one-obvious-sequence rather than automatically add tools |
| Want more behaviorally | **≥3/5 enact replay or continue/new challenge** during free-choice; **≥2/5 specifically enact replay**. Sandbox alone does not pass. Optional content unavailability reported, never scored as disinterest. Retrospective interest rating cannot replace action |
| No quit cluster | **0 voluntary session quits for game-related frustration**; **≤1/5 quits any room for game-related frustration**; no same obstruction causes a voluntary abandonment in ≥2 players. Planned cap/break excluded; ambiguous reason conservatively flagged, not silently dropped |
| Fluid causality | **≥4/5** correctly explain and predict a causal fluid/air consequence central to a discovery/composition solution. At least one core room must require gravity-liquid behavior and one a meaningful air→liquid interaction, verified separately by mechanic ablation/replay evidence; player testimony alone cannot establish necessity |

**Important tensions:** 4/5 clear + weak explanations/aha = not pass. Easy onboarding is desirable; no impasse in onboarding is not a toy diagnosis. Low surprise but accurate deliberate analytic solving can be a valid puzzle; failing our *insight-first* target calls for choosing analytic design or changing concept, not declaring those players defective [D14].

### Analysis plan (fixed)

1. Keep all recruited rows. Only prior-exposure ineligibility, consent withdrawal or documented technical invalidation removes a row from a particular measure; retain reason/count. Voluntary quit, misunderstanding, hint use, random success and poor performance never excluded. Technical failure is reported as a reliability failure even if a replacement is recruited. Newly briefed repeat cannot replace a fresh initial attempt. Stop and repair build-wide failures rather than recruit until desired scores appear.
2. Analyze **participant × room first exposure**; aggregate attempts within that exposure. Report per room `reached/5`, unaided clear `k/5`, aided clear, timeout, quit, not_exposed, technical-invalid separately. For sequence gate denominator is five; for a conditional room outcome also show observed denominator explicitly. Never count unexposed as observed room failure in a binomial CI.
3. Binary rates: raw numerator/denominator + exact 95% interval [NIST]; no null-hypothesis tests, no p-values, no claims of superiority between rounds/subgroups. Experience-stratum rows descriptive only (n=1–2).
4. Times: all individual values, medians, min/max. Unsolved time-to-clear right-censored at actual cap/quit; first assistance is competing intervention for unaided solve, not a 300-s solve. Report `≥cap`, `<unknown interval>`, `not reached` faithfully. Do not average only successful people and call it room difficulty. With five, p95 is effectively an extreme observation: do not use it as a stable statistic.
5. Aha time uses participant-linked onset intervals, not click speed. Unknown/no realization remains unknown/not attained; do not impute clear time. For three or five known intervals, median lower bound = median of lower endpoints, upper bound = median of upper endpoints; for four use mean of middle endpoints in each bound. This bounds the known-event median, **not** an all-player population median. Require three known pre-hint events for the gate; show all unknown/no-aha players and state survivor-selection limitation. A median interval crossing a target boundary is inconclusive. Also report analytic/gradual, false-insight and hinted-aha counts.
6. Compare explanation, temporal evidence and behavior **before** seeing enjoyment ratings; keep contradicted evidence. Separate idle-only proxy, confirmed impasse, self-reported aha and supported understanding. No post-hoc “aha total” selection or threshold tuning.
7. Each failure receives `observation → rival explanations → smallest testable change → expected observable recovery`. Pick one causal design change per iteration; fixes then require fresh-player verification [R02].
8. Across rounds: display each build’s `k/n`, score vectors and change log side by side. Do not pool changing builds, changed time caps, teacher-aided downstream learning or different recruitment/device strata. Same-build independent confirmatory cohorts may be pooled only if planned beforehand; still retain cohort breakdown. Two passing rounds are replication of a local design signal, not national market validation.

## 7. Kill criteria and pivot table

**Single-round triggers are stop/iterate signals, not population truths.** Stop immediately for safety/privacy failure. For concept-level kill/pivot, require pattern in **two consecutive fresh frozen cohorts after one focused repair**, unless real-engine evidence shows the mechanic cannot meet fairness/causality requirements. Do not add rooms/art to mask failed mechanic discovery.

| Observed pattern | Classification | Action |
|---|---|---|
| ≥4/5 clear but ≥3/5 cannot explain/transfer; ≥3 describe non-goal-directed triggering input | Accidental-success/toy signal | Tighten meaningful constraint/feedback or change mechanic; retest one core room. Persistent after repair: pivot to explicit toy or kill puzzle concept |
| Discovery/composition median clear <30 s, ≤1 supported aha, no confirmed impasse, ≥3 say obvious/no reasoning | Too trivial for insight-first goal | Iterate level constraints once, not onboarding. If alternate nontrivial arrangements still trivial: change mechanic; persistent: toy pivot/kill insight-first concept |
| No observed impasse but ≥3 strong supported aha/transfer and enjoyment high | Insight without coded impasse possible [D14] | Revisit impasse target, do not claim toy. Any changed target applies to a new preregistration/round |
| ≤2/5 unaided clears; ≥3 share same false rule/access misconception | Opaque teaching/readability | Fix cue/feedback/affordance; preserve core rule; fresh-player retest |
| ≤2/5 clear even after tier 3, or ≥3 still fail transfer after understanding controls | Mechanic or inference chain too opaque | Isolate one relation, change mechanic/representation; persistent: pivot/kill |
| ≥4 know/predict correct plan but ≥3 fail execution due to tiny timing/position variations, physics inconsistency | Simulation fairness/execution barrier, not desired insight difficulty | Fix margins/determinism/feedback; run seeded perturbation harness. Do not “teach harder” or lower comprehension standard |
| Same blocker causes ≥2 voluntary room/session abandonments | Quit cluster | Stop expansion, repair that obstruction; distress can stop a cohort immediately |
| ≤1/5 supported aha in core room, accurate gradual solutions, enjoyment/replay high | Analytic puzzle rather than intended insight puzzle | Explicitly choose analytic-puzzle direction or change insight mechanic; do not fabricate aha |
| ≤1/5 supported aha, low understanding, ≤1/5 enact more puzzle play, enjoyment median <4 | Weak core experience | One focused mechanic revision; same pattern next cohort: pivot concept/kill |
| ≥3 choose sandbox, ≤1 enact puzzle replay/new challenge, ratings favor unguided fluid play | Fluid toy preference signal | Optional toy pivot; not a puzzle pass, not proof of market demand |
| ≥3 claim fluid replaceable; their plans ignore fluid state; real-engine ablation preserves solution structure | Fluid decoration | Change mechanic so observable fluid relation constrains solution. Persistent after repair: reject this concept as meeting owner goal |
| Players identify essential fluid, ablation removes meaningful solutions, but art-only removal causes confusion | Fluid mechanically essential, presentation unclear | Iterate legibility, not physics architecture |
| Gravity-liquid removal or air-coupling removal leaves every intended core challenge equivalent | Dual-engine owner requirement not met | Mechanic redesign; no amount of positive survey response rescues requirement |
| Core pass, isolated UI issue with obvious fix | Local usability | RITE fix/verify under new build ID [R02], then frozen confirmation |
| All gates pass two fresh frozen cohorts, no unresolved severe blocker | Promising bounded prototype | Expand content; larger/diverse/remote/device/long-session testing. No “critically acclaimed” claim |

Fluid necessity requires an explicit ablation study/solver check owned by implementation/design lane, not just asking players. Counterbalance ablation conditions with different fresh cohorts in a later dedicated round; n=5 split across conditions cannot establish causal effect. Do not expose a tester to the same puzzle twice and call the second condition fresh.

## 8. Ethics, privacy and retention

- Consent separated by telemetry, screen, voice, face; refusal does not change payment or welcome. No hidden recording, no biometrics, no global keyboard capture, no recording other tabs/notifications/accounts. Screen crop to game; use research profile/window.
- IDs `R01-P01` etc.; random local session/attempt IDs. No name/email/IP, full user agent, hardware fingerprint, location, raw DOM text, chat or typed personal text in JSON. Questionnaire prose reviewed/redacted before sharing. Face/voice remain personal data even when filename uses an ID.
- Keep recruiter/contact/payment table separate, access-restricted/encrypted. Owner names exact authorized viewers and deletion contact on consent form; no automatic uploads, third-party analytics, AI transcription/analysis or public clips. External sharing needs separate explicit consent.
- Defaults: withdrawal/deletion window 14 days; raw screen/voice/face ≤30 days; de-identified coded data/logs ≤90 days, then delete unless participant explicitly consented to a specific extension. Owner records deletion dates and actual completion; if backups cannot meet policy, resolve before recording. Aggregate summaries may remain only if not re-identifying. These are proposed project limits, not legal advice or jurisdictional compliance claims.
- A participant can stop immediately, skip questions, request no clip playback. Stop for distress or discomfort; never preserve a threshold at a person’s expense. Accessibility accommodation always outweighs standardized timing; document and interpret scope honestly.

## 9. Spreadsheet / analysis template

One workbook, separate tabs; local, restricted access. No names. Minimal viable sheets:

**`participants`**
`round_id, participant_id, eligible_fresh, exclusion_reason, experience_bin, recent_puzzle_examples_redacted, input_class, access_accommodation, telemetry_consent, screen_consent, voice_consent, face_consent, session_id, build_hash, protocol_hash, complete_or_withdrawn, deviation, recording_delete_due, data_delete_due`

**`rooms`** — one row per person/room first exposure
`round_id, participant_id, room_id, room_order, level_hash, reached, research_unlocked, attempt_count, ready_t_ms, first_action_ms, first_pour_ms, first_hint_ms, max_hint_ever, hint_offer_ms, help_count, pause_ms, technical_downtime_ms, clear_active_ms, clear_censored, unaided_clear_300, aided_clear, timeout, voluntary_quit, quit_reason_redacted, technical_invalid, restart_count, idle_candidate_count, idle_candidate_total_ms, confirmed_impasse_count, confirmed_impasse_longest_ms, wrong_belief_codes, strategy_changes, aha_presence, aha_hint_status, aha_time_lo_ms, aha_time_hi_ms, aha_time_source, suddenness, pleasantness, surprise, certainty, prior_impasse, aha_intensity, rule_goal_pt, rule_causal_pt, rule_action_pt, transfer_pt, critical_misconception, rule_total, rule_pass, understanding_learned_during, initial_understanding_attribution_confidence, free_choice_replayed_this_room, accidental_clear, fluid_causal_evidence, coder_id, second_coder, discrepancy, clip_offsets, log_filename, notes_redacted`

**`episodes`**
`participant_id, room_id, attempt_id, code, onset_wall_ms, end_wall_ms, onset_active_ms, end_active_ms, tick, source, certainty, observable_fact_or_quote_redacted, interpretation, rival_explanation, coder_id, replay_confirmed`

**`experience_choice`**
`participant_id, all_raw_question_items, reverse_scored_items, enjoyment_mean, competence_mean, autonomy_bespoke_mean, missing_items, options_available, selected_option, enacted_option, selected_room, first_input_ms, play_duration_active_ms, early_exit, continuation_unavailable, felt_obliged_item`

**`round_decisions`**
`round_id, build_hash, room_id, valid_n, exposed_n, unaided_k, exact_ci_lo, exact_ci_hi, explanation_k, aha_k, individual_time_vector, median_time_interval, quit_k, replay_k, continue_k, sandbox_k, gate_name, pass_fail_inconclusive, exclusion_and_deviation_counts, dominant_failure, proposed_single_change, expected_next_signal, decision_owner, decided_at`

Aggregate once all five complete or round stopped. Provide raw coded values and outliers with each median. Make uncertainty and unexposed/missing cases visible. Retain prior rounds; corrections append change notes. Never overwrite initial interpretation after viewing ratings.

## Done / not done

Deliverable: runnable human protocol + instrumentation specification + checklist + evidence ledger. No repo modifications, telemetry implementation, participant recruiting, human testing, recording or dashboards performed. Real-engine fairness/ablation validation remains a prerequisite in the owning lanes, not something these documents establish.
