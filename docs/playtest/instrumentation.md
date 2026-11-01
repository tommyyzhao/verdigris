# Verdigris playtest instrumentation — implementation specification

**Specification only; not implemented.** Baseline reviewed `f858bc05137da74008cf07912086abda38b4f67e`, 2026-10-31. Event names/thresholds below are proposed study decisions. Source IDs resolve in `sources.md` (URLs, access date, verification limits). Scope: opt-in research mode, framework-agnostic runtime + UI boundary hooks, no engine rewrite, dependencies, network analytics or public-library API additions.

## 1. Existing seams and traps

Paths below absolute; line numbers at reviewed baseline.

| Seam | Current behavior | Required instrumentation |
|---|---|---|
| `src/routes/game/types.ts:227–239` | `Action`: pour/stir/pose/toggle/ink/erase/dig, positions in 48×30 LU | Whitelist tagged action data, validate finite values, annotate receipt time + pre-action tick |
| `src/routes/game/model.ts:381–407` | Stir returns no `GameEvent`; pour move within same spring produces no new pour event; pointer clamped | Capture runtime action requests + **actual view** transitions/position, not `GameEvent` alone |
| Same `model.ts:434–508` | Ink/dig may do nothing or be denied; erase may refund; no success event for every action | Record request separately from observed effect; absent denial does not prove meaningful change |
| Same `model.ts:549–580` | Wells decrement per plan tick; empty well can stop pour internally | Observe `view.pouring` each planned tick or every published transition; no phantom held pour span |
| Same `model.ts:591–595`, `:691–725` | Sensor frames async/stale rejected; game `stuck` resource-impossibility test | Keep received tick vs model/sensor tick; name `resource_stuck`, never psychological impasse |
| `src/routes/game/runtime.ts:97–114` | Non-running transition stops pour internally; publishes state | One internal dispatch/log function, every path including stopPour; carry stop cause |
| Same `runtime.ts:130–164`, `:255` | Restart reinitializes model, tick returns to 0, scale/glow reset | Attempt ID increments; close prior attempt; no session/room-exposure clock reset |
| Same `runtime.ts:173–190` | Capped frame delta, max 2 ticks/frame, scale variable | Monotonic wall/task clocks separate from sim tick; tick/60 is **not human elapsed time** |
| Same `runtime.ts:225–271` | Public actions/state/restart/dispose | Action + lifecycle hooks; emit end once on navigation/dispose, not each automatic clear |
| `src/routes/+page.svelte:111–145`, `:164`, `:185` | Tool selection/hints/free-choice UI outside model; hint count resets on close/restart | UI recorder for hint offer/open/close, tool select, navigation/replay/continue and study phase. Persist max hint exposure per room-exposure |

Do not modify `Action`/`GameEvent` just to carry telemetry. Preserve existing action order, GL lifecycle and sim cadence. Optional recorder sink in route/runtime dependency injection is sufficient; disabled path a no-op. Observation + logs + questionnaires triangulate; logs cannot establish intent/emotion [A09, TRUE08].

### Verified exact field mapping — implementation must use source names

Rechecked `src/routes/game/types.ts:245–312`. Snake-case names in this specification are **export aliases/derived fields**, not additional fields already present in `RoomView` or `GameEvent`.

| Spec/log field or event | Exact source mapping |
|---|---|
| `model_tick` | `RoomView.tick`; `sensor_tick` only available from `SensorFrame.tick` at runtime `pollSensors`/`room.observe`, not carried in `GameEvent` |
| `wells:[{id,units}]` | `Object.entries(RoomView.springs)`; values already game units. `well_before/after`, consumed amount derived from these snapshots, not `Spring.well` (starting capacity) |
| `spring_id`, actual pour position | `RoomView.pouring?.spring`, `.at`; `GameEvent {type:'pour',spring}` contains **no position or stop reason** |
| `urns`, `seed_views` | `RoomView.urns`, `RoomView.seedViews`; each `UrnView` has `id, counts, units, status, hold, fill, inTune` |
| `normalized_mix` | Derived `counts[i]/sum(counts)` from `UrnView.counts`; empty total maps to null/empty flag, never division by zero. No source `normalized_mix` field |
| `in_tune`, `ever_spoiled`, `ink_used`, `ink_left`, `terrain_revision` | `inTune`, `everSpoiled`, `inkUsed`, `inkLeft`, `terrainRevision`; `wasted`, `cleared` unchanged |
| `spoil`, `urn_status` | `GameEvent {type:'urn',id,status}` with `status:'spoiled'` for spoil; `previous_status` cached by recorder, counts/units from fresh view. Seed source `{type:'seed',id,status:'growing'|'grown'|'spoiled'}`; no native event named `spoil` |
| `resource_stuck` | `GameEvent {type:'stuck'}` or transition of `RoomView.stuck`; no native `resource_stuck` event, no cognitive state |
| `gate_change`, `pose_change`, `bramble_change`, `well_empty` | Source `type:'gate'` (`id,open`), `'pose'` (`id,index`), `'bramble'` (`id`), `'well-empty'` (`id`); source spellings retained in `source_type` |
| `clear` | Source `{type:'clear',dewdrops,mastery}`. `MasteryResult` exact fields `revived,thrifty,clean,reserve,reserveNeeded,everSpoiled,inkUsed?,inkBudget?` |
| `action_denied` | Source `{type:'denied',reason,at?}`; exact reason union `ink-empty | wet | not-diggable | supply-empty | busy` |
| `tool_use`, `stir_segment`, requested pour position | Source `Action` union: `pour {spring,at?}`, `stir {from,to}`, `pose {id,index}`, `toggle {id}`, `ink {stroke,from,to}`, `erase {stroke}`, `dig {at,radius}`. A stir has no model outcome event |
| IDs, hints, selection, pause reason, recorder phase | UI/runtime observer context, **not** fields in `RoomView/GameEvent`; new opt-in research boundary hooks required |
| `summary_state`, previous status, assistance/max hint, `pour_id` | Recorder-owned derived data; not pretend-source fields |

**Order caution:** runtime currently forwards events before `publish()` refreshes the route’s cached `view`. A recorder inside the runtime may call `room.view()` after `act/observe` for fresh context; a UI-only `onEvent` wrapper must not silently pair a fresh event with its stale cached view. Initial states and every reset need separate snapshots; do not infer transitions from absent events.

## 2. Identity, clock, units

**Hierarchy:** research session → room exposure → attempt. Replaying later creates a new exposure marked `free_choice`; restarting during original task only creates another attempt. Same room ID across these never implies same task. Room 1 can be first exposure; Room 2 after a hint in Room 1 remains locally unaided but is marked `prior_sequence_hints=true` for teaching-context analysis.

Session metadata (one JSON header, allowlist only):

```
schema_version: 1
protocol_version, round_id, participant_id: study codes, not names
session_id: local random UUID; never durable cross-session tracking
build_hash, level_bundle_hash, engine_settings_hash, strategy_dictionary_version
room_order: [room IDs]
input_class: mouse | trackpad | touch | keyboard | mixed | unknown
viewport_bucket: compact | medium | large
browser_family: optional coarse family, not full user agent
consent: {telemetry: boolean, screen: boolean, voice: boolean, face: boolean}
```

Every event envelope:

```
v: 1
seq: monotonically increasing integer
name: enumerated string
session_id
room_id, exposure_id, attempt_id: nullable outside room
phase: controls | scored_silent | free_choice | questionnaire | retrospective | debrief
wall_ms: performance.now() − session monotonic origin
exposure_active_ms: cumulative wall time while task board available, running and visible
attempt_active_ms: same, reset on attempt start
model_tick: current room.view().tick, nullable outside runtime
source: ui | runtime | model | observer
... allowlisted event-specific fields
```

- Session header also records `session_format: lean | full`, `remote: boolean`, `free_choice_cap_ms`, `assessed_room_ids`, `not_assessed_gates` (lean includes strategy autonomy), and compatibility PASS/error category, not GPU identifying strings. Observer-only `connection_drop` markers store last reliable/reconnected time, pause verified/unknown and observation-missing interval; do not infer local pause from call state.
- `wall_ms` never resets across restart. No absolute calendar timestamp needed in log; study admin keeps date separately. Round/pre-registration metadata can use date; no device timezone/fingerprint.
- Exposure task time includes observation, active pouring, autonomous settling and in-game hint reading; excludes explicit pause, hidden tab, technical outage, external research break, questionnaire, replay discussion. Tool menus that leave task active count. Time-scale 0 is tagged; it is not automatically a human break.
- Pause and state events delimit intervals. Record active clock at both ends; elapsed task time is not inferred from number of actions. Downstream `research_unlocked` creates visible scope flag.
- Position `x,y` LU, origin top-left, x right/y down. Finite/clamped to board; for pour store requested point and actual clamped emitter separately. Round stored research coordinates to 0.1 LU; not suited to exact deterministic replay. Do not normalize to screenshot pixels. Null when cursor outside board; never collect global screen position.
- For model outcomes, add `observed_model_tick`, `sensor_tick` when available. Log receipt wall time truthfully; **do not backdate a clear’s wall time to sensor tick**. Async sensor latency matters for physics, tiny compared with multi-minute UX intervals, but preserve it for auditing.

## 3. Event contract

Required fields below in addition to common envelope. Pair starts/ends with stable IDs; reasons enumerated, free text confined to separately consented/redacted observer sheet.

| Name | Fields / emission rule |
|---|---|
| `session_start` | Header metadata; after telemetry consent and explicit start |
| `phase_change` | `from, to, cause`; flush summaries before switch |
| `session_end` | `reason: completed | participant_stop | technical | withdrawn | navigation`, `complete_log: boolean`, event/drop counts. User confirms save separately |
| `room_start` | `first_exposure: boolean, research_unlocked: boolean, prior_sequence_hints: boolean, level_hash, sandbox: boolean`; when room selected |
| `room_ready` | Input-ready runtime actually running/visible; initial `summary_state`; human timing origin |
| `room_end` | `reason: clear_exit | timeout | voluntary_quit | map | next | technical | session_stop`, `cleared, max_hint_ever, assistance_ever, attempt_count, summary_state`; one per exposure |
| `attempt_start` | `attempt_index, cause: initial | player_restart | technical_restart`, `seed: 71429` at baseline (read from options, not hard-code a false value), `summary_state` |
| `attempt_end` | `reason: restart | room_exit | technical | session_stop`, `cleared, summary_state`; clear alone does not terminate playful post-clear effects, but scoring freezes |
| `first_action` | `action_type, action_seq, actionable: boolean`; first processed puzzle action. Also retain `first_input` for a click denied/not processed. Navigation/tool-selection is not puzzle action |
| `action` | Sanitized union fields from `Action`; `processed: boolean, blocked_reason: paused | hidden | not_ready | disposed | none`; once per discrete pose/toggle/erase/pour boundary. High-frequency moves summarized below; never double-send actions to sim |
| `pour_start` | `pour_id, spring_id, species, requested_at, actual_at, well_before`; actual `view.pouring` null→non-null or spring change. Denied pointerdown has no accepted start |
| `pour_path` | `pour_id, t0_ms, t1_ms, n_samples, points:[{dt_ms,x,y}]`, max 10 Hz/0.1 LU; only actual changed emitter, max 1-second chunk. Raw pointermove not required |
| `pour_stop` | `pour_id, spring_id, actual_at, reason: release | spring_switch | supply_empty | pause | hidden | blur | restart | clear_ui | navigation | error | context_lost | unknown`, `duration_active_ms, well_after, units_consumed`; close every span exactly once. Spring switch closes old before opening new |
| `stir_segment` | `gesture_id, t0_ms, t1_ms, model_tick_start/end, from, to, path_length_lu, n_inputs, sum_dx, sum_dy, min/max_bounds, points`; flush after 250 ms or gesture end, sample path ≤10 Hz. `effect_unknown: true` unless measured separately. Path length is sum of input segment lengths, not endpoint distance |
| `tool_select` | `tool: pour | stir | ink | erase | dig | pose | toggle` (actual UI tools only), `previous_tool, via: pointer | keyboard | touch` |
| `tool_use` | Discrete pose/toggle/erase exact IDs/index/stroke; ink/dig summaries `gesture_id, t0/t1, from/to/at, path_length, radius, input_count, ink_used_before/after, terrain_revision_before/after, denial_count`. No “succeeded” label based merely on lack of error |
| `action_denied` | Whitelisted `GameEvent.denied`: `reason, at`, `action_seq` if caused by current action; repeated in same gesture may be counted/summarized, first denial retained |
| `restart` | `via, reason: player | facilitator | technical`, old/new attempt IDs, `max_hint_ever`; before initialize. Same exposure clock persists |
| `hint_offer` | `tier, scheduled_at_active_ms, choice: pending | accept | decline | skip | stop`; facilitator flag; offer alone does not mark exposed |
| `hint_open` | `tier, hint_text_id/hash, initiator: player | facilitator, first_seen: boolean, max_hint_ever`; once content visible, exposure survives close/reset |
| `hint_close` | `visible_tiers`; no decrement of max exposure |
| `help_given` | `kind: technical | accessibility | solution`, `script_id, contaminates: boolean`; detailed wording in private observer sheet, not JSON |
| `pause_start` / `pause_end` | `pause_id, reason: user | hidden | facilitator_break | technical | context_lost`, nested causes handled by set, never double-subtract overlapping pauses |
| `runtime_state` | `from,to: running | paused | context-lost | unavailable | error`, `cause` enum; no raw stack/message with potential personal paths |
| `time_scale` | `from,to`; includes payoff slow motion and explicit scale changes; sim time is not task time |
| `urn_status` | `id, previous, status, units, normalized_mix, in_tune, hold`; emit only transitions; initial state in ready snapshot |
| `seed_status` / `gate_change` / `pose_change` / `bramble_change` / `well_empty` | Existing semantic events, whitelisted IDs/state; useful causal milestones |
| `spoil` | `target_id, target_kind: urn | seed, previous_status, counts, units`; once per entry into spoiled, not every sensor frame. `everSpoiled` retained |
| `resource_stuck` | Once per model `stuck` event; `summary_state, meaning: insufficient_recoverable_resources`; not a human stuck code |
| `clear` | Existing `GameEvent.clear` fields `dewdrops, mastery`, `max_hint_ever, assistance_ever, summary_state`; first clear per attempt only. Exposure primary outcome freezes on first qualifying clear |
| `state_sample` | ≤2 Hz while running plus at key events, compact `summary_state` only; no frame-by-frame GL readbacks |
| `idle_gap` | `t0/t1_ms, duration_active_ms, threshold_ms:20000, ended_by, expected_wait_candidate`; retrospective emitted when ended, flush at pause/room/session end; never name `impasse` automatically |
| `cursor_dwell` | Board-only `t0/t1, centroid_lu, radius_lu, target_id/target_kind or none, pointer_kind`; ≥2 seconds within 1 LU of anchor, no button down, no active stroke/pour. Target priority frozen; not gaze/attention |
| `choice_presented` | `options_available, display_order`; equal salience/no forced default |
| `choice_selected` | `choice: replay | continue | sandbox | stop | break`, `target_room_id` if relevant |
| `choice_enacted` | First gameplay input + active duration ≥60 s or earlier clear, `choice, duration, early_clear`; retain both selected and enacted |
| `observer_marker` | `code` from protocol, `certainty, interval_lo/hi, source`; no raw audio/video. Observer marker is not model fact |
| `log_limit` | `cap_events, dropped_summary_count, critical_capture_available`; show recorder warning; never silently truncate |

`summary_state`: `{wells: [{id,units}], urns/seed_views:[{id,status,units,in_tune,hold,normalized_mix}], ink_used, ink_left, wasted, ever_spoiled, resource_stuck, cleared, terrain_revision}`. IDs are authored IDs; coordinates numeric; Infinity encoded explicitly as `unlimited:true, units:null` in sandbox, never implicit JSON null. No terrain arrays, particles, textures, full framebuffers, audio data or arbitrary DOM snapshots.

### Minimal capture architecture

1. UI owns recorder/session/phase, hints, choices and navigation. Runtime gets optional structured sink and read-only session/attempt context; pure model unchanged.
2. Route **all existing `onEvent` calls** through one dispatch wrapper. Preserve order: capture model outcome then forward exactly once. Include act-generated, observe-generated and internal `stopPour` paths. Track previous/present actual `view.pouring` to detect empty-well/internal stops even before delayed sensor events arrive.
3. At runtime `act`, timestamp request before invoking model/air. Save sanitized requested metadata. Capture meaningful action processing without additional room mutations. Compare after-view only for relevant effects; stir goes to air, not model event list. Do not infer a clear from animation/UI state.
4. Chunk move/stir/ink/dig summaries with stable gesture IDs; flush on pointerup/cancel, focus loss, pause, hidden tab, restart, clear, dispose, phase end. Cursor dwell needs board pointer handlers; runtime cannot see passive cursor motion.
5. Keep ≤2 Hz compact state samples from already available `RoomView`; no synchronous GPU readback, network calls or per-frame `JSON.stringify`. Critical semantic events never sampled away.
6. Store in memory for one bounded session; JSON stringify/Blob only on explicit manual download or the prior-consented Finish-study gesture. One small route-local recorder module plus one test file is enough; no telemetry service, database, analytics SDK or engine dependency.

**No deterministic replay claim:** rounded/thinned paths and asynchronous GPU state cannot exactly reproduce the player’s view. This log supports a timeline; use separately consented screen recording for cued retrospection. Existing `replayActions`/authored solution harness can replay **full** actions on a test clock, but summaries cannot be fed back as though equivalent. An optional exact action recorder would be a separate measured need with its own size/consent plan, not required now.

## 4. Derived metrics — deterministic definitions

All calculations keyed by exposure, report attempts separately. Keep metric algorithm/version in analysis output.

| Metric | Definition |
|---|---|
| `time_to_first_input` | First board input minus `room_ready`, active task ms; denied input included, distinguish from meaningful action |
| `time_to_first_action` | First processed meaningful puzzle action minus ready; holding a valid pour counts at start, rejected actions/tool selection do not |
| `time_to_first_pour` | First **accepted actual `pour_start`** minus ready; no pour = censored/NA with end reason, not zero |
| `time_to_clear` | First clear receipt minus initial ready in exposure active ms; cumulative restarts; pair with before-first-hint status. If never clear, right-censored at last active time + reason |
| `unaided_clear_300` | First clear at ≤300,000 exposure active ms, `max_hint_ever=0`, no solution assistance/prior exposure. Normal frozen onboarding allowed |
| `restarts_per_room` | Count player/facilitator resets within scored exposure; technical resets separate. Free-choice replay is not restart in primary exposure |
| `pour_efficiency` | Units retained in targets at clear / units consumed from wells, only if comparable targets/initial pools; secondary, not insight measure. State all accounting caveats |
| `idle_candidates` | Maximal gaps ≥20 s without meaningful action or held input while task active. Starting point is last meaningful action/held-input end, including pre-first-action gap from ready. Passive cursor movement never resets. Pauses split gaps, never create idle |
| `idle_impasse` | Candidate gap ≥30 s + no preregistered physical waiting state + explicit retrospective/spontaneous confirmation of no next idea. Without confirmation report only idle candidate. Fluid can settle while player thinks; activity scalar alone cannot exclude/confirm impasse |
| `repeat_impasse` | ≥3 equivalent failed high-level tests in 90 s, no new causal hypothesis/target category, observer confirmation; not derivable from raw click counts alone |
| `hint_dependence` | First-exposure max hint tier ever + first-hint active time + assisted clear rate. UI hint counter reset/close never erases history |
| `quit_cluster` | ≥2/5 voluntarily abandon at same frozen `obstruction_id`; participant/observer reason evidence required; timeout/technical failure separate |
| `replay/continue enactment` | Protocol definition: choose option then actual input + ≥60 active s or earlier clear; sandbox separate |
| `cursor_dwell` | ≥2,000 ms within 1-LU anchor radius, no held interaction; aggregate per authored target. Duration is pointer residence, **not eye fixation** |

### “Aha proxy” = strategy-transition candidate, not detected insight

Pre-register a room-specific dictionary of **semantic actions**, e.g. `(pour, spring, receiving_route_zone)`, `(stir, direction_bin, region)`, `(pose, id, detent)`, `(toggle, id, state)`, `(ink, routing_region)`. Default direction bins eight octants; zones authored by level, not mined after outcomes. Gesture-level actions, not 60 Hz segments, form this sequence. Never infer player intent from unseen targets.

Candidate at first action `t` meeting all:

1. Preceded within 15 active seconds by the end of a ≥30-s idle-impasse **candidate** or a coded repeat-impasse episode.
2. Next 30 active seconds contain a novel two-action semantic sequence not used in the preceding 90 active seconds; if fewer than 90 seconds of history, use all available and flag short history. Single-action core insights can be defined in room dictionary **before** tests; do not force this default on a one-pour room.
3. The new sequence is pursued: repeats once, or followed by a predeclared causal milestone (new target ready, correct stream captured, previously unreachable route activated). Clear alone is not proof of understanding.
4. Tag assistance status; `post_hint` transitions never count as unaided aha.

This yields `strategy_transition_candidate` with `t_lo/t_hi, trigger, sequence, milestone, assistance`. It **misses** insight without visible impasse, novel action, or successful execution, and **overflags** random exploration/newly noticed controls. It is a clip-finding aid only [A09, TRUE08, D14]. Primary `INSIGHT_SUPPORTED` additionally needs participant’s sudden-realization report plus correct rule/counterfactual, linked to timing; no algorithmic label substitutes. Aha may be false [D17].

**Impasse waiting exclusion:** predeclare physically expected settling/hold/gate/vine intervals by room. A held pour/stir is activity, not idle. Finite flow after release may still be expected waiting. Current `RoomView.activity` measures mean liquid speed/ambience, not task progress; do not set a magic threshold on it to diagnose thought. Current `stuck` means insufficient resources; it may occur during active experimentation and may never occur during a 3-minute cognitive stall.

## 5. Local storage, privacy, download

- Research mode explicit opt-in before first capture. Default off. No request beacon, remote endpoint, analytics cookie, fingerprint or durable player identifier. In-memory study IDs only; no automatic reading of personal browser/storage content. Existing game progression storage remains separate from study log.
- Local end-of-session filename: `verdigris-R01-P01-<session-short-id>.json`, using sanitized known code, no name. Remote mode: with prior explicit download consent, the user’s **Finish study** click triggers one local auto-download and closes capture; no additional confirmation click required. Show completion/blocked status and manual **Download log** fallback. Without auto-download consent, manual save only or no export. Never initiate a surprise download or attempt to defeat browser blocking. Offer checkpoint download between rooms as explicit action if desired.
- Warn on refresh/navigation that unsaved research data will be lost; do not block withdrawal. `pagehide` may mark incomplete in-memory but cannot guarantee download; report incomplete rather than fabricate a session end.
- Proposed cap: 20,000 noncritical summary/sample events per session; at cap stop cursor/path/state sampling, retain critical lifecycle/outcome/hint/choice events, emit `log_limit` and visible warning. Reserve 2,000 critical slots; if exhausted pause research recording and offer explicit save, do not block gameplay. Mark affected metrics incomplete. A 60-min session at state 2 Hz plus summarized gestures should be measured in a pilot, not asserted to fit.
- No raw free text/keystrokes, document titles, query strings, IP, exact device model, canvas fingerprint, GL renderer strings or error stack in JSON. No external upload by recorder. Download is a user-controlled local file; later handoff to owner is a separate informed action.
- Consent file is separate; log holds only consent booleans/study code. Screen/voice/face require distinct affirmative consent and separate files. Apply protocol retention (raw recordings 30 d, coded logs 90 d, withdrawal window 14 d); owner verifies actual deletion.
- Validate exported structure and finite numbers, unknown event names/fields rejected, duplicate sequence IDs rejected. Import viewer treats JSON as data only; no HTML insertion, code execution or dynamic URLs.

## 6. Minimal viewer idea — defer implementation

**No dashboard/heatmap necessary for five testers.** First version: local JSON file picker, event table sorted by wall/task time, filter by participant/room/attempt/name, jump links to manually entered screen-recording offsets, searchable code labels. Add one row per tester with a time-ordered timeline only if table navigation proves inadequate; no chart code is part of this deliverable.

If a visual timeline is later implemented, load the `dataviz` skill first; use labels/shapes, keyboard access and non-color-only status. Show pause/hint/restart/clear/impasse candidates, not an “emotion curve.” Keep each person visible; aggregate distributions/heatmaps can hide the very outliers being studied [A09]. Microsoft TRUE prioritizes contextual event streams [TRUE08]; Bungie heatmaps are a location-inspection precedent, not a reason to call mouse residence attention [BUNGIE]. At n=5, per-tester overlay/table is usually more interpretable than a pooled heatmap. Do not chart until needed.

## 7. Implementation acceptance checks (one small test file, no new framework)

Use project’s existing test infrastructure or an assert-based injected-clock script. No new dependencies. Required reproducible scenarios:

1. Start→ready→pour→same-spring move→release: one start/stop, clamped path present, consumed units nonnegative; no extra sim actions.
2. Pour→empty well / pause / hidden / blur / restart / dispose: one stop per active span; cause retained; no dangling span, including auto-stop before delayed sensor event.
3. Restart: tick resets, attempt ID changes, exposure clock/max hint survive. Clear at cumulative 310 s after restart must fail 300-s unaided gate.
4. Hint 2→close→restart: max hint remains 2. Hint offer declined alone leaves assistance false.
5. Hidden 60 s: wall increases 60 s, task clock unchanged; no fake 60-s idle. Overlapping hidden+break counted once. Slow sim/time-scale change never substitutes tick clock for wall.
6. Continuous 25-s held pour not idle; 25-s no-input yields candidate only; expected settling/uncertain human state never auto-labels cognitive impasse.
7. Stir input reaches air exactly once even though model yields no stir event. Summary path length uses all segments; curve not collapsed to endpoint distance. Flush cancel/end.
8. Spoil→drain→refill→spoil yields two entries, not one per frame. Resource stuck and observer impasse have distinct names.
9. Save/parse round trip preserves null/unlimited semantics; timestamps/sequence IDs monotonic; all spans paired or explicitly incomplete. Malformed/oversized imports fail safely.
10. Recorder off: no events/file/network/storage calls; outcomes/action counts identical to recorder on under fake sim/air/clock. Cap triggers warning and honest missingness; semantic events protected.
11. Consent absent/refused: no capture. Runtime exception logs enum only, no message/stack/path. Revoke: stop capture immediately; offer delete vs retain previously consented data without pressure.
12. Free-choice replay selection without actual play does not emit enacted; 60-s play or earlier true clear does; sandbox stays separate.

Project instructions: if implementation later changes code, run `bun run test && bun run check`; `bun run prepack` before any authorized commit. This research task changes no code, so those suites were not run.
