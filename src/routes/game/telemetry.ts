import type {
	Action,
	GameEvent,
	Level,
	RoomView,
	UrnView,
	Vec,
} from './types.js';

export type Phase =
	| 'controls'
	| 'scored_silent'
	| 'free_choice'
	| 'questionnaire'
	| 'retrospective'
	| 'debrief';
export type Stop =
	| 'release'
	| 'spring_switch'
	| 'supply_empty'
	| 'pause'
	| 'hidden'
	| 'blur'
	| 'restart'
	| 'clear_ui'
	| 'navigation'
	| 'error'
	| 'context_lost'
	| 'unknown';
type Source = 'ui' | 'runtime' | 'model' | 'observer';
type Pause =
	| 'user'
	| 'hidden'
	| 'facilitator_break'
	| 'technical'
	| 'context_lost';
type State = 'running' | 'paused' | 'context-lost' | 'unavailable' | 'error';
type Fields = Record<string, unknown>;
export type Entry = Fields & {
	v: 1;
	seq: number;
	name: string;
	wall_ms: number;
	exposure_active_ms: number;
	attempt_active_ms: number;
};
export const STORAGE_KEY = 'verdigris-study-buffer-v1';
const MAX_BYTES = 4_000_000;
const PHASES: Phase[] = [
	'controls',
	'scored_silent',
	'free_choice',
	'questionnaire',
	'retrospective',
	'debrief',
];
// Field allowlists are shared by capture and import validation; no arbitrary action/browser data escapes.
export const EVENT_FIELDS = {
	session_start:
		'schema_version protocol_version round_id participant_id session_id build_hash level_bundle_hash engine_settings_hash strategy_dictionary_version room_order input_class viewport_bucket browser_family consent session_format remote free_choice_cap_ms assessed_room_ids not_assessed_gates compatibility',
	phase_change: 'from to cause',
	session_end:
		'reason complete_log event_count dropped_summary_count dropped_critical_count',
	room_start:
		'first_exposure research_unlocked prior_sequence_hints level_hash sandbox',
	room_ready: 'summary_state',
	room_end:
		'reason cleared max_hint_ever assistance_ever attempt_count summary_state',
	attempt_start: 'attempt_index cause seed summary_state',
	attempt_end: 'reason cleared summary_state',
	first_input: 'action_type action_seq processed',
	first_action: 'action_type action_seq actionable',
	action:
		'type spring at from to stroke id index radius strength enabled angle processed blocked_reason effect_unknown',
	pour_start:
		'pour_id spring_id species requested_at actual_at well_before unlimited',
	pour_path: 'pour_id t0_ms t1_ms n_samples points',
	pour_stop:
		'pour_id spring_id actual_at reason duration_active_ms well_after units_consumed unlimited',
	stir_segment:
		'gesture_id t0_ms t1_ms model_tick_start model_tick_end from to path_length_lu n_inputs sum_dx sum_dy min_bounds max_bounds points effect_unknown',
	tool_select: 'tool previous_tool via',
	tool_use:
		'type id index stroke strength enabled angle at from to gesture_id t0_ms t1_ms path_length radius input_count ink_used_before ink_used_after terrain_revision_before terrain_revision_after denial_count effect_unknown',
	action_denied: 'observed_model_tick sensor_tick reason at action_seq',
	restart: 'via reason old_attempt_id new_attempt_id max_hint_ever',
	hint_offer: 'tier scheduled_at_active_ms choice facilitator',
	hint_open: 'tier hint_text_id initiator first_seen max_hint_ever',
	hint_close: 'visible_tiers',
	help_given: 'kind script_id contaminates',
	pause_start: 'pause_id reason',
	pause_end: 'pause_id reason',
	runtime_state: 'from to cause',
	time_scale: 'from to',
	urn_status:
		'observed_model_tick sensor_tick id previous status units normalized_mix in_tune hold',
	seed_status:
		'observed_model_tick sensor_tick id previous status units normalized_mix in_tune hold',
	gate_change: 'observed_model_tick sensor_tick source_type id open',
	pose_change: 'observed_model_tick sensor_tick source_type id index',
	vent_change: 'observed_model_tick sensor_tick source_type id index velocity',
	bramble_change: 'observed_model_tick sensor_tick source_type id',
	well_empty: 'observed_model_tick sensor_tick source_type id',
	spoil:
		'observed_model_tick sensor_tick target_id target_kind previous_status counts units',
	resource_stuck: 'observed_model_tick sensor_tick summary_state meaning',
	clear:
		'observed_model_tick sensor_tick dewdrops mastery max_hint_ever assistance_ever summary_state',
	state_sample: 'summary_state',
	idle_gap:
		't0_ms t1_ms duration_active_ms threshold_ms ended_by expected_wait_candidate',
	cursor_dwell:
		't0_ms t1_ms centroid_lu radius_lu target_id target_kind pointer_kind',
	choice_presented: 'options_available display_order',
	choice_selected: 'choice target_room_id',
	choice_enacted: 'choice duration early_clear',
	observer_marker: 'code certainty interval_lo interval_hi marker_source',
	connection_drop:
		'last_reliable_ms reconnected_ms pause_verified observation_missing_lo_ms observation_missing_hi_ms',
	log_limit: 'cap_events dropped_summary_count critical_capture_available',
} as const;
type Name = keyof typeof EVENT_FIELDS;
const ENVELOPE =
	'v seq name session_id room_id exposure_id attempt_id phase wall_ms exposure_active_ms attempt_active_ms model_tick source'.split(
		' '
	);
const sampled = new Set<Name>([
	'state_sample',
	'pour_path',
	'stir_segment',
	'cursor_dwell',
	'idle_gap',
]);
const allowed = Object.fromEntries(
	Object.entries(EVENT_FIELDS).map(([name, fields]) => [
		name,
		new Set(fields.split(' ')),
	])
);
const code = (v: unknown) =>
	typeof v === 'string' && /^[a-zA-Z0-9_.-]{1,80}$/.test(v) ? v : null;
const finite = (n: number) => (Number.isFinite(n) ? n : null);
const point = (v?: Vec | null) =>
	v && Number.isFinite(v.x) && Number.isFinite(v.y)
		? {
				x: Math.round(Math.max(0, Math.min(48, v.x)) * 10) / 10,
				y: Math.round(Math.max(0, Math.min(30, v.y)) * 10) / 10,
		  }
		: null;
export function hashData(value: unknown): string {
	const text = JSON.stringify(value);
	let hash = 2166136261;
	for (let i = 0; i < text.length; i++)
		hash = Math.imul(hash ^ text.charCodeAt(i), 16777619);
	return (hash >>> 0).toString(16).padStart(8, '0');
}
const targetSummary = (u: UrnView) => {
	const total = u.counts.reduce((a, b) => a + b, 0);
	return {
		id: u.id,
		status: u.status,
		units: finite(u.units),
		in_tune: u.inTune,
		hold: finite(u.hold),
		normalized_mix: total > 0 ? u.counts.map((n) => n / total) : null,
	};
};
function summary(view: RoomView) {
	return {
		wells: Object.entries(view.springs).map(([id, units]) => ({
			id,
			units: finite(units),
			...(units === Infinity ? { unlimited: true } : {}),
		})),
		urns: view.urns.map(targetSummary),
		seed_views: view.seedViews.map(targetSummary),
		ink_used: finite(view.inkUsed),
		ink_left: finite(view.inkLeft),
		wasted: finite(view.wasted),
		ever_spoiled: view.everSpoiled,
		resource_stuck: view.stuck,
		cleared: view.cleared,
		terrain_revision: view.terrainRevision,
	};
}
function actionData(action: Action): Fields {
	// Future tagged actions (puff/vent controls) retain only these generic safe fields.
	const a = action as unknown as Fields;
	const data: Fields = { type: code(a.type) ?? 'unknown' };
	for (const key of ['spring', 'id'])
		if (a[key] === null || code(a[key])) data[key] = a[key];
	for (const key of ['stroke', 'index', 'radius', 'strength', 'angle'])
		if (typeof a[key] === 'number' && Number.isFinite(a[key]))
			data[key] = a[key];
	if (typeof a.enabled === 'boolean') data.enabled = a.enabled;
	for (const key of ['at', 'from', 'to'])
		if (key in a) data[key] = point(a[key] as Vec);
	return data;
}
export interface StudyOptions {
	consent: {
		telemetry: boolean;
		screen: boolean;
		voice: boolean;
		face: boolean;
	};
	now?: () => number;
	storage?: Pick<Storage, 'setItem' | 'removeItem'>;
	sessionId?: string;
	capEvents?: number;
	criticalReserve?: number;
	onLimit?: () => void;
	metadata?: Partial<{
		protocol_version: string;
		round_id: string;
		participant_id: string;
		build_hash: string;
		engine_settings_hash: string;
		strategy_dictionary_version: string;
		input_class:
			| 'mouse'
			| 'trackpad'
			| 'touch'
			| 'keyboard'
			| 'mixed'
			| 'unknown';
		viewport_bucket: 'compact' | 'medium' | 'large';
		browser_family: 'chrome' | 'safari' | 'firefox' | 'other';
		session_format: 'lean' | 'full';
		remote: boolean;
		free_choice_cap_ms: number;
		assessed_room_ids: string[];
		not_assessed_gates: string[];
		compatibility:
			| 'PASS'
			| 'unavailable'
			| 'context_lost'
			| 'error'
			| 'not_checked';
	}>;
}
export function createTelemetry(
	levels: readonly Level[],
	options: StudyOptions
): Telemetry | undefined {
	if (!options.consent.telemetry) return undefined;
	return new Telemetry(levels, options);
}
export class Telemetry {
	private events: Entry[] = [];
	private readonly now: () => number;
	private readonly origin: number;
	private lastWall = 0;
	private readonly cap: number;
	private readonly reserve: number;
	private summaryCount = 0;
	private criticalCount = 0;
	private dropped = 0;
	private droppedCritical = 0;
	private exhausted = false;
	limited = false;
	ended = false;
	unsaved = true;
	private complete = true;
	private seq = 0;
	readonly header: Fields;
	private phase: Phase = 'scored_silent';
	private room?: Level;
	private view?: RoomView;
	private exposure: string | null = null;
	private attempt: string | null = null;
	private exposureIndex = 0;
	private attemptIndex = 0;
	private seen = new Set<string>();
	private maxHint = 0;
	private assistance = false;
	private priorHints = false;
	private running = false;
	private readyOnce = false;
	private active = false;
	private since = 0;
	private exposureMs = 0;
	private sessionMs = 0;
	private attemptMs = 0;
	private pauses = new Map<Pause, string>();
	private runtime: State | null = null;
	private firstInput = false;
	private firstAction = false;
	private cleared = false;
	private idleActive = 0;
	private idleWall = 0;
	private held = false;
	private lastSample = -Infinity;
	private statuses = new Map<string, string>();
	private currentAction?: {
		data: Fields;
		seq: number;
		before?: RoomView;
		processed: boolean;
		denied: number;
		semantic: boolean;
		release: Stop;
	};
	private pour?: {
		id: string;
		spring: string;
		at: Vec | null;
		before: number;
		active: number;
		lastPoint: number;
		chunk: number;
		points: { dt_ms: number; x: number; y: number }[];
	};
	private gestureId = 0;
	private stroke?: {
		type: string;
		id: string;
		t0: number;
		tick: number;
		from: Vec;
		to: Vec;
		length: number;
		count: number;
		dx: number;
		dy: number;
		min: Vec;
		max: Vec;
		points: { dt_ms: number; x: number; y: number }[];
		sampledAt: number;
		before: RoomView;
		after: RoomView;
		denied: number;
		data: Fields;
	};
	private gesture?: string;
	private gestureAction?: { type: unknown; seq: number };
	private denials = new Set<string>();
	private releaseCause: Stop = 'release';
	private dwell?: {
		anchor: Vec;
		sum: Vec;
		n: number;
		radius: number;
		t0: number;
		target: string | null;
		kind: string;
		pointer: string;
	};
	private choice?: { choice: string; first?: number; enacted: boolean };
	constructor(private levels: readonly Level[], private options: StudyOptions) {
		this.now = options.now ?? (() => performance.now());
		this.origin = this.now();
		this.cap = Math.max(1, Math.min(20000, options.capEvents ?? 20000));
		this.reserve = Math.max(8, Math.min(2000, options.criticalReserve ?? 2000));
		const m = options.metadata ?? {};
		this.header = {
			schema_version: 1,
			protocol_version: code(m.protocol_version) ?? '1',
			round_id: code(m.round_id),
			participant_id: code(m.participant_id),
			session_id: code(options.sessionId) ?? crypto.randomUUID(),
			build_hash: code(m.build_hash),
			level_bundle_hash: hashData(levels),
			engine_settings_hash: code(m.engine_settings_hash),
			strategy_dictionary_version: code(m.strategy_dictionary_version),
			room_order: levels.map((l) => l.id),
			input_class: ['mouse', 'trackpad', 'touch', 'keyboard', 'mixed'].includes(
				m.input_class ?? ''
			)
				? m.input_class
				: 'unknown',
			viewport_bucket: ['compact', 'medium', 'large'].includes(
				m.viewport_bucket ?? ''
			)
				? m.viewport_bucket
				: 'medium',
			browser_family: ['chrome', 'safari', 'firefox', 'other'].includes(
				m.browser_family ?? ''
			)
				? m.browser_family
				: null,
			consent: {
				telemetry: true,
				screen: options.consent.screen === true,
				voice: options.consent.voice === true,
				face: options.consent.face === true,
			},
			session_format: m.session_format === 'full' ? 'full' : 'lean',
			remote: m.remote === true,
			free_choice_cap_ms: Number.isFinite(m.free_choice_cap_ms)
				? Math.max(0, m.free_choice_cap_ms!)
				: null,
			assessed_room_ids:
				m.assessed_room_ids?.filter((id) => levels.some((l) => l.id === id)) ??
				[],
			not_assessed_gates: m.not_assessed_gates?.map(code).filter(Boolean) ?? [],
			compatibility: ['PASS', 'unavailable', 'context_lost', 'error'].includes(
				m.compatibility ?? ''
			)
				? m.compatibility
				: 'not_checked',
		};
		this.emit('session_start', 'ui', this.header);
	}
	private wall() {
		return (this.lastWall = Math.max(
			this.lastWall,
			this.now() - this.origin,
			0
		));
	}
	private exposureTime() {
		return this.exposureMs + (this.active ? this.wall() - this.since : 0);
	}
	private attemptTime() {
		return this.attemptMs + (this.active ? this.wall() - this.since : 0);
	}
	private emit(
		name: Name,
		source: Source,
		fields: Fields = {},
		critical = !sampled.has(name)
	) {
		if (this.ended) return 0;
		if (this.exhausted) {
			if (critical) this.droppedCritical++;
			else this.dropped++;
			return 0;
		}
		if (!critical && this.summaryCount >= this.cap) {
			this.dropped++;
			if (!this.limited) {
				this.limited = true;
				this.complete = false;
				this.emit('log_limit', 'runtime', {
					cap_events: this.cap,
					dropped_summary_count: this.dropped,
					critical_capture_available: true,
				});
				this.options.onLimit?.();
			}
			return 0;
		}
		// Reserve the last critical slot for an honest terminal warning; never evict semantic history.
		if (
			critical &&
			this.criticalCount >= this.reserve - 1 &&
			name !== 'log_limit'
		) {
			this.droppedCritical++;
			this.complete = false;
			this.limited = true;
			this.emit('log_limit', 'runtime', {
				cap_events: this.cap,
				dropped_summary_count: this.dropped,
				critical_capture_available: false,
			});
			this.exhausted = true;
			this.options.onLimit?.();
			return 0;
		}
		const selected: Fields = {};
		for (const [key, value] of Object.entries(fields))
			if (allowed[name].has(key)) selected[key] = value;
		const seq = ++this.seq;
		this.events.push({
			v: 1,
			seq,
			name,
			session_id: this.header.session_id,
			room_id: this.room?.id ?? null,
			exposure_id: this.exposure,
			attempt_id: this.attempt,
			phase: this.phase,
			wall_ms: this.wall(),
			exposure_active_ms: this.exposureTime(),
			attempt_active_ms: this.attemptTime(),
			model_tick: this.view?.tick ?? null,
			source,
			...selected,
		});
		if (critical) this.criticalCount++;
		else this.summaryCount++;
		this.unsaved = true;
		return seq;
	}
	private idle(end: string) {
		const duration = this.exposureTime() - this.idleActive;
		if (this.active && !this.held && !this.pour && duration >= 20000)
			this.emit('idle_gap', 'runtime', {
				t0_ms: this.idleWall,
				t1_ms: this.wall(),
				duration_active_ms: duration,
				threshold_ms: 20000,
				ended_by: end,
				expected_wait_candidate: true,
			});
		this.resetIdle();
	}
	private resetIdle() {
		this.idleActive = this.exposureTime();
		this.idleWall = this.wall();
	}
	private syncActive() {
		const next =
			!!this.room &&
			this.readyOnce &&
			this.running &&
			this.pauses.size === 0 &&
			['controls', 'scored_silent', 'free_choice'].includes(this.phase);
		if (next === this.active) return;
		if (!next) {
			this.idle('pause');
			this.flushGesture();
			this.flushDwell();
			this.exposureMs = this.exposureTime();
			this.attemptMs = this.attemptTime();
		}
		this.active = next;
		this.since = this.wall();
		this.resetIdle();
	}
	startRoom(level: Level, sandbox: boolean, researchUnlocked = false) {
		if (this.ended) return;
		this.endRoom('map');
		this.room = level;
		this.view = undefined;
		this.exposure = `e${++this.exposureIndex}`;
		this.attempt = null;
		this.attemptIndex = 0;
		this.exposureMs = this.attemptMs = 0;
		this.maxHint = 0;
		this.assistance = false;
		this.readyOnce = false;
		this.running = false;
		this.runtime = null;
		this.pauses.clear();
		this.emit('room_start', 'ui', {
			first_exposure: !this.seen.has(level.id),
			research_unlocked: researchUnlocked,
			prior_sequence_hints: this.priorHints,
			level_hash: hashData(level),
			sandbox,
		});
		this.seen.add(level.id);
	}
	startAttempt(
		next: RoomView,
		cause: 'initial' | 'player_restart' | 'technical_restart' = 'initial',
		seed: number | null = null
	) {
		if (this.ended || !this.room) return;
		this.endAttempt('technical');
		this.exposureMs = this.exposureTime();
		this.since = this.wall();
		this.attemptMs = 0;
		this.view = next;
		this.attempt = `${this.exposure}-a${++this.attemptIndex}`;
		this.firstInput = this.firstAction = this.cleared = false;
		this.statuses.clear();
		for (const [kind, items] of [
			['urn', next.urns],
			['seed', next.seedViews],
		] as const)
			for (const u of items) this.statuses.set(`${kind}:${u.id}`, u.status);
		this.emit('attempt_start', 'runtime', {
			attempt_index: this.attemptIndex,
			cause,
			seed,
			summary_state: summary(next),
		});
		this.resetIdle();
	}
	ready(next: RoomView) {
		if (this.ended || !this.room) return;
		this.view = next;
		if (this.readyOnce) return;
		this.readyOnce = true;
		this.syncActive();
		this.emit('room_ready', 'runtime', { summary_state: summary(next) });
	}
	state(
		next: State,
		cause: 'user' | 'hidden' | 'technical' | 'context_lost' | 'error' = 'user',
		nextView?: RoomView
	) {
		if (this.ended) return;
		if (nextView) this.view = nextView;
		if (this.runtime !== next)
			this.emit('runtime_state', 'runtime', {
				from: this.runtime,
				to: next,
				cause,
			});
		this.runtime = next;
		this.running = next === 'running';
		this.pause(
			cause === 'hidden'
				? 'hidden'
				: cause === 'context_lost'
				? 'context_lost'
				: cause === 'technical' || cause === 'error'
				? 'technical'
				: 'user',
			next !== 'running'
		);
		if (next === 'running') {
			for (const reason of ['user', 'technical', 'context_lost'] as const)
				this.pause(reason, false);
			if (this.view) this.ready(this.view);
		}
		this.syncActive();
	}
	pause(reason: Pause, paused: boolean) {
		if (this.ended || !this.room || this.pauses.has(reason) === paused) return;
		if (paused) {
			this.idle(reason);
			this.stop(
				reason === 'hidden'
					? 'hidden'
					: reason === 'context_lost'
					? 'context_lost'
					: 'pause'
			);
			this.flushGesture();
			this.held = false;
			this.gestureAction = undefined;
			const id = `pause-${this.seq + 1}`;
			this.pauses.set(reason, id);
			this.syncActive();
			this.emit('pause_start', 'runtime', { pause_id: id, reason });
		} else {
			const id = this.pauses.get(reason)!;
			this.pauses.delete(reason);
			this.syncActive();
			this.emit('pause_end', 'runtime', { pause_id: id, reason });
		}
	}
	phaseChange(to: Phase) {
		if (this.ended || to === this.phase || !PHASES.includes(to)) return;
		this.idle('phase');
		this.stop('pause');
		this.flushGesture();
		this.flushDwell();
		this.checkChoice();
		const from = this.phase;
		this.phase = to;
		this.emit('phase_change', 'ui', { from, to, cause: 'facilitator' });
		this.syncActive();
	}
	inputStart() {
		if (!this.ended) {
			this.releaseCause = 'release';
			this.gestureAction = undefined;
			this.denials.clear();
			this.idle('input');
			this.held = true;
			this.flushDwell();
			this.gesture = `g${++this.gestureId}`;
		}
	}
	inputEnd(reason: Stop = 'release') {
		if (this.ended || (!this.held && !this.pour && !this.stroke)) return;
		this.releaseCause = reason;
		this.stop(reason);
		this.flushGesture();
		this.held = false;
		this.gesture = undefined;
		this.gestureAction = undefined;
		this.resetIdle();
	}
	beforeAction(
		action: Action,
		processed: boolean,
		blocked: 'paused' | 'hidden' | 'not_ready' | 'disposed' | 'none'
	) {
		if (this.ended) return;
		const data = actionData(action);
		const move = data.type === 'pour' && data.spring === this.pour?.spring;
		const continuous = ['stir', 'ink', 'dig'].includes(data.type as string);
		const seq = move
			? 0
			: continuous &&
			  this.gestureAction &&
			  this.gestureAction.type === data.type
			? this.gestureAction.seq
			: this.emit('action', 'runtime', {
					...data,
					processed,
					blocked_reason: blocked,
					effect_unknown: !['pour', 'pose', 'toggle', 'erase'].includes(
						data.type as string
					),
			  });
		if (
			!continuous ||
			!this.gestureAction ||
			this.gestureAction.type !== data.type
		)
			this.denials.clear();
		if (continuous) this.gestureAction = { type: data.type, seq };
		this.currentAction = {
			data,
			seq,
			before: this.view,
			processed,
			denied: 0,
			semantic: false,
			release: this.releaseCause,
		};
		this.releaseCause = 'release';
		if (!this.firstInput && !(data.type === 'pour' && data.spring === null)) {
			this.firstInput = true;
			this.emit('first_input', 'runtime', {
				action_type: data.type,
				action_seq: seq || this.seq,
				processed,
			});
		}
		if (!processed) this.currentAction = undefined;
	}
	afterAction(next: RoomView) {
		if (this.ended) return;
		const pending = this.currentAction;
		this.currentAction = undefined;
		this.observe(next, pending?.release ?? 'release', pending?.data);
		if (!pending) return;
		const { data, before } = pending;
		let meaningful = pending.denied === 0;
		if (data.type === 'pour')
			meaningful &&= !!next.pouring && data.spring !== null;
		else if (data.type === 'ink' || data.type === 'erase')
			meaningful =
				before?.inkUsed !== next.inkUsed ||
				before?.terrainRevision !== next.terrainRevision;
		else if (data.type === 'dig')
			meaningful = before?.terrainRevision !== next.terrainRevision;
		else if (data.type === 'pose')
			meaningful &&=
				before?.planks[data.id as string] !== next.planks[data.id as string] ||
				before?.ventControls[data.id as string] !== next.ventControls[data.id as string];
		else if (data.type === 'toggle') meaningful &&= pending.semantic;
		if (data.type === 'stir' && data.from && data.to) {
			const f = data.from as Vec,
				t = data.to as Vec;
			meaningful &&= f.x !== t.x || f.y !== t.y;
		}
		if (meaningful) {
			this.idle('action');
			if (!this.firstAction) {
				this.firstAction = true;
				this.emit('first_action', 'runtime', {
					action_type: data.type,
					action_seq: pending.seq || this.seq,
					actionable: true,
				});
			}
			if (
				this.choice &&
				this.phase === 'free_choice' &&
				this.choice.first === undefined
			)
				this.choice.first = this.sessionMs + this.exposureTime();
		}
		if (['stir', 'ink', 'dig'].includes(data.type as string) && before)
			this.addStroke(data, before, next, pending.denied);
		else if (data.type !== 'pour')
			this.emit('tool_use', 'runtime', {
				...data,
				effect_unknown: !['pose', 'toggle', 'erase'].includes(
					data.type as string
				),
			});
	}
	observe(next: RoomView, reason: Stop = 'unknown', requested?: Fields) {
		if (this.ended) return;
		this.view = next;
		const current = next.pouring;
		if (this.pour && (!current || current.spring !== this.pour.spring))
			this.stop(
				current
					? 'spring_switch'
					: reason === 'unknown' && next.springs[this.pour.spring] <= 0
					? 'supply_empty'
					: reason
			);
		if (current && !this.pour) {
			this.idle('pour');
			this.flushDwell();
			this.pour = {
				id: `p${this.seq + 1}`,
				spring: current.spring,
				at: point(current.at),
				before: next.springs[current.spring] ?? 0,
				active: this.exposureTime(),
				lastPoint: -Infinity,
				chunk: this.wall(),
				points: [],
			};
			this.emit('pour_start', 'runtime', {
				pour_id: this.pour.id,
				spring_id: current.spring,
				species:
					this.room?.springs.find((s) => s.id === current.spring)?.species ??
					null,
				requested_at: requested?.type === 'pour' ? requested.at ?? null : null,
				actual_at: this.pour.at,
				well_before: finite(this.pour.before),
				...(this.pour.before === Infinity ? { unlimited: true } : {}),
			});
		} else if (current && this.pour) {
			const p = this.pour,
				at = point(current.at),
				now = this.wall();
			if (now - p.chunk >= 1000) this.flushPath();
			if (
				at &&
				(at.x !== p.at?.x || at.y !== p.at?.y) &&
				now - p.lastPoint >= 100 &&
				!this.limited
			) {
				p.points.push({ dt_ms: now - p.chunk, ...at });
				p.lastPoint = now;
			}
			p.at = at;
		}
	}
	private flushPath() {
		const p = this.pour;
		if (!p) return;
		if (p.points.length)
			this.emit('pour_path', 'runtime', {
				pour_id: p.id,
				t0_ms: p.chunk,
				t1_ms: this.wall(),
				n_samples: p.points.length,
				points: p.points,
			});
		p.points = [];
		p.chunk = this.wall();
	}
	private stop(reason: Stop) {
		const p = this.pour;
		if (!p) return;
		this.flushPath();
		const after = this.view?.springs[p.spring] ?? p.before;
		this.emit('pour_stop', 'runtime', {
			pour_id: p.id,
			spring_id: p.spring,
			actual_at: p.at,
			reason,
			duration_active_ms: this.exposureTime() - p.active,
			well_after: finite(after),
			units_consumed:
				Number.isFinite(after) && Number.isFinite(p.before)
					? Math.max(0, p.before - after)
					: null,
			...(p.before === Infinity ? { unlimited: true } : {}),
		});
		this.pour = undefined;
		this.resetIdle();
	}
	private addStroke(
		data: Fields,
		before: RoomView,
		after: RoomView,
		denied: number
	) {
		const from = (data.from ??
				(data.type === 'dig' ? this.stroke?.to : null) ??
				data.at) as Vec | null,
			to = (data.to ?? data.at) as Vec | null;
		if (!from || !to) return;
		if (
			this.stroke &&
			(this.stroke.type !== data.type || this.wall() - this.stroke.t0 >= 250)
		)
			this.flushGesture();
		if (!this.stroke)
			this.stroke = {
				type: data.type as string,
				id: this.gesture ?? `g${++this.gestureId}`,
				t0: this.wall(),
				tick: before.tick,
				from,
				to: from,
				length: 0,
				count: 0,
				dx: 0,
				dy: 0,
				min: { ...from },
				max: { ...from },
				points: [],
				sampledAt: -Infinity,
				before,
				after,
				denied: 0,
				data,
			};
		const s = this.stroke;
		s.to = to;
		s.length += Math.hypot(to.x - from.x, to.y - from.y);
		s.count++;
		s.dx += to.x - from.x;
		s.dy += to.y - from.y;
		s.after = after;
		s.denied += denied;
		for (const p of [from, to]) {
			s.min.x = Math.min(s.min.x, p.x);
			s.min.y = Math.min(s.min.y, p.y);
			s.max.x = Math.max(s.max.x, p.x);
			s.max.y = Math.max(s.max.y, p.y);
		}
		if (this.wall() - s.sampledAt >= 100 && !this.limited) {
			s.points.push({ dt_ms: this.wall() - s.t0, ...to });
			s.sampledAt = this.wall();
		}
	}
	private flushGesture() {
		const s = this.stroke;
		if (!s) return;
		const base = {
			gesture_id: s.id,
			t0_ms: s.t0,
			t1_ms: this.wall(),
			from: s.from,
			to: s.to,
			effect_unknown: true,
		};
		if (s.type === 'stir')
			this.emit('stir_segment', 'runtime', {
				...base,
				model_tick_start: s.tick,
				model_tick_end: s.after.tick,
				path_length_lu: s.length,
				n_inputs: s.count,
				sum_dx: s.dx,
				sum_dy: s.dy,
				min_bounds: s.min,
				max_bounds: s.max,
				points: s.points,
			});
		else
			this.emit(
				'tool_use',
				'runtime',
				{
					...s.data,
					...base,
					path_length: s.length,
					input_count: s.count,
					ink_used_before: s.before.inkUsed,
					ink_used_after: s.after.inkUsed,
					terrain_revision_before: s.before.terrainRevision,
					terrain_revision_after: s.after.terrainRevision,
					denial_count: s.denied,
				},
				false
			);
		this.stroke = undefined;
	}
	event(event: GameEvent, next: RoomView, sensorTick?: number) {
		if (this.ended) return;
		this.view = next;
		if (this.currentAction && ['gate', 'pose', 'vent'].includes(event.type))
			this.currentAction.semantic = true;
		const base = {
			observed_model_tick: next.tick,
			sensor_tick: sensorTick ?? null,
		};
		switch (event.type) {
			case 'denied':
				if (this.currentAction) this.currentAction.denied++;
				if (!this.denials.has(event.reason)) {
					this.denials.add(event.reason);
					this.emit('action_denied', 'model', {
						...base,
						reason: event.reason,
						at: point(event.at),
						action_seq: this.currentAction?.seq || null,
					});
				}
				break;
			case 'stuck':
				this.emit('resource_stuck', 'model', {
					...base,
					meaning: 'insufficient_recoverable_resources',
					summary_state: summary(next),
				});
				break;
			case 'clear': {
				if (this.cleared) break;
				this.cleared = true;
				this.observe(next, 'clear_ui');
				this.stop('clear_ui');
				this.flushGesture();
				this.idle('clear');
				const m = event.mastery;
				this.emit('clear', 'model', {
					...base,
					dewdrops: event.dewdrops,
					mastery: {
						revived: m.revived,
						thrifty: m.thrifty,
						clean: m.clean,
						reserve: m.reserve,
						reserveNeeded: m.reserveNeeded,
						everSpoiled: m.everSpoiled,
						...(m.inkUsed !== undefined ? { inkUsed: m.inkUsed } : {}),
						...(m.inkBudget !== undefined ? { inkBudget: m.inkBudget } : {}),
					},
					max_hint_ever: this.maxHint,
					assistance_ever: this.assistance,
					summary_state: summary(next),
				});
				this.checkChoice(true);
				break;
			}
			case 'urn':
			case 'seed': {
				const key = `${event.type}:${event.id}`,
					previous = this.statuses.get(key) ?? null;
				if (previous === event.status) break;
				this.statuses.set(key, event.status);
				const u = (event.type === 'urn' ? next.urns : next.seedViews).find(
					(u) => u.id === event.id
				);
				this.emit(
					event.type === 'urn' ? 'urn_status' : 'seed_status',
					'model',
					{
						...base,
						...(u
							? targetSummary(u)
							: {
									id: event.id,
									units: null,
									normalized_mix: null,
									in_tune: false,
									hold: 0,
							  }),
						previous,
						status: event.status,
					}
				);
				if (event.status === 'spoiled')
					this.emit('spoil', 'model', {
						...base,
						target_id: event.id,
						target_kind: event.type,
						previous_status: previous,
						counts: u ? [...u.counts] : null,
						units: u?.units ?? null,
					});
				break;
			}
			case 'gate':
				this.emit('gate_change', 'model', {
					...base,
					source_type: event.type,
					id: event.id,
					open: event.open,
				});
				break;
			case 'vent':
				this.emit('vent_change', 'model', {
					...base, source_type: event.type, id: event.id, index: event.index,
					velocity: { ...event.velocity },
				});
				break;
			case 'pose':
				this.emit('pose_change', 'model', {
					...base,
					source_type: event.type,
					id: event.id,
					index: event.index,
				});
				break;
			case 'bramble':
			case 'well-empty':
				this.emit(
					event.type === 'bramble' ? 'bramble_change' : 'well_empty',
					'model',
					{ ...base, source_type: event.type, id: event.id }
				);
				break;
		}
	}
	pulse() {
		if (this.view && this.active) this.sample(this.view);
	}
	sample(next: RoomView) {
		if (this.ended || this.exhausted) return;
		this.observe(next);
		if (this.stroke && this.wall() - this.stroke.t0 >= 250) this.flushGesture();
		if (this.pour && this.wall() - this.pour.chunk >= 1000) this.flushPath();
		this.checkChoice();
		if (this.active && this.wall() - this.lastSample >= 500) {
			this.lastSample = this.wall();
			if (!this.limited)
				this.emit('state_sample', 'runtime', { summary_state: summary(next) });
			else this.dropped++;
		}
	}
	tool(tool: string, previous: string, via: 'pointer' | 'keyboard' | 'touch') {
		if (!this.ended && ['hand', 'ink', 'dig', 'erase'].includes(tool))
			this.emit('tool_select', 'ui', {
				tool: tool === 'hand' ? 'pour' : tool,
				previous_tool: previous === 'hand' ? 'pour' : previous,
				via,
			});
	}
	cursor(at: Vec | null, pointerKind: string, down: boolean) {
		if (this.ended || !this.active || down || this.held || this.pour || !at) {
			this.flushDwell();
			return;
		}
		const p = point(at);
		if (!p) return;
		if (
			this.dwell &&
			(this.wall() - this.dwell.t0 > 60000 ||
				Math.hypot(p.x - this.dwell.anchor.x, p.y - this.dwell.anchor.y) > 1)
		)
			this.flushDwell();
		if (!this.dwell) {
			const inside = (b: { x: number; y: number; w: number; h: number }) =>
				p.x >= b.x && p.x <= b.x + b.w && p.y >= b.y && p.y <= b.y + b.h;
			// Frozen priority: urn, seed, spring, gate, plank; overlaps never guessed from DOM.
			const target =
				this.room?.urns.find((u) => inside(u.box)) ??
				this.room?.seeds.find((u) => inside(u.box)) ??
				this.room?.springs.find((s) => inside(s.zone)) ??
				this.room?.gates.find((g) => inside(g.box));
			const kind = target
				? this.room?.urns.includes(target as Level['urns'][number])
					? 'urn'
					: this.room?.seeds.includes(target as Level['seeds'][number])
					? 'seed'
					: this.room?.springs.includes(target as Level['springs'][number])
					? 'spring'
					: 'gate'
				: 'none';
			this.dwell = {
				anchor: p,
				sum: { ...p },
				n: 1,
				radius: 0,
				t0: this.wall(),
				target: target?.id ?? null,
				kind,
				pointer: ['mouse', 'touch', 'pen'].includes(pointerKind)
					? pointerKind
					: 'unknown',
			};
		} else {
			this.dwell.n++;
			this.dwell.sum.x += p.x;
			this.dwell.sum.y += p.y;
			this.dwell.radius = Math.max(
				this.dwell.radius,
				Math.hypot(p.x - this.dwell.anchor.x, p.y - this.dwell.anchor.y)
			);
		}
	}
	private flushDwell() {
		const d = this.dwell;
		if (!d) return;
		if (this.wall() - d.t0 >= 2000)
			this.emit('cursor_dwell', 'ui', {
				t0_ms: d.t0,
				t1_ms: this.wall(),
				centroid_lu: point({ x: d.sum.x / d.n, y: d.sum.y / d.n }),
				radius_lu: d.radius,
				target_id: d.target,
				target_kind: d.kind,
				pointer_kind: d.pointer,
			});
		this.dwell = undefined;
	}
	hintOffer(
		tier: number,
		choice: 'pending' | 'accept' | 'decline' | 'skip' | 'stop',
		facilitator = true
	) {
		if (Number.isInteger(tier) && tier >= 1 && tier <= 3)
			this.emit('hint_offer', 'ui', {
				tier,
				scheduled_at_active_ms: [300000, 360000, 420000][tier - 1],
				choice,
				facilitator,
			});
	}
	hint(tier: number, initiator: 'player' | 'facilitator' = 'player') {
		if (this.ended || !Number.isInteger(tier) || tier < 1 || tier > 3) return;
		const first = tier > this.maxHint;
		this.maxHint = Math.max(this.maxHint, tier);
		this.assistance = this.priorHints = true;
		this.emit('hint_open', 'ui', {
			tier,
			hint_text_id: `${this.room?.id}-${tier}`,
			initiator,
			first_seen: first,
			max_hint_ever: this.maxHint,
		});
	}
	closeHint(tier: number) {
		this.emit('hint_close', 'ui', {
			visible_tiers: Array.from(
				{ length: Math.min(3, Math.max(0, tier)) },
				(_, i) => i + 1
			),
		});
	}
	help(kind: 'technical' | 'accessibility' | 'solution', scriptId: string) {
		if (!code(scriptId)) return;
		const contaminates = kind === 'solution';
		if (contaminates) this.assistance = this.priorHints = true;
		this.emit('help_given', 'observer', {
			kind,
			script_id: scriptId,
			contaminates,
		});
	}
	restart(next: RoomView, technical = false) {
		if (this.ended || !this.room) return;
		this.view = next;
		this.idle('restart');
		this.stop('restart');
		this.flushGesture();
		this.held = false;
		this.gestureAction = undefined;
		const old = this.attempt;
		this.endAttempt(technical ? 'technical' : 'restart');
		this.emit('restart', 'ui', {
			via: technical ? 'runtime' : 'player',
			reason: technical ? 'technical' : 'player',
			old_attempt_id: old,
			new_attempt_id: `${this.exposure}-a${this.attemptIndex + 1}`,
			max_hint_ever: this.maxHint,
		});
	}
	endAttempt(reason: 'restart' | 'room_exit' | 'technical' | 'session_stop') {
		if (!this.attempt || !this.view) return;
		this.emit('attempt_end', 'runtime', {
			reason,
			cleared: this.view.cleared,
			summary_state: summary(this.view),
		});
		this.attempt = null;
	}
	endRoom(
		reason:
			| 'clear_exit'
			| 'timeout'
			| 'voluntary_quit'
			| 'map'
			| 'next'
			| 'technical'
			| 'session_stop' = 'map'
	) {
		if (!this.room || this.ended) return;
		this.idle('room_end');
		this.stop(reason === 'technical' ? 'error' : 'navigation');
		this.flushGesture();
		this.flushDwell();
		this.checkChoice();
		this.running = false;
		this.syncActive();
		for (const reason of [...this.pauses.keys()]) this.pause(reason, false);
		this.endAttempt(
			reason === 'session_stop'
				? 'session_stop'
				: reason === 'technical'
				? 'technical'
				: 'room_exit'
		);
		if (this.view)
			this.emit('room_end', 'ui', {
				reason,
				cleared: this.view.cleared,
				max_hint_ever: this.maxHint,
				assistance_ever: this.assistance,
				attempt_count: this.attemptIndex,
				summary_state: summary(this.view),
			});
		this.sessionMs += this.exposureTime();
		this.room = undefined;
		this.view = undefined;
		this.exposure = this.attempt = null;
		this.active = false;
		this.running = false;
		this.held = false;
		this.gestureAction = undefined;
		this.pauses.clear();
		this.exposureMs = this.attemptMs = 0;
	}
	scale(from: number, to: number) {
		this.emit('time_scale', 'runtime', { from, to });
	}
	choices(options: string[]) {
		const safe = options.filter((c) =>
			['replay', 'continue', 'sandbox', 'stop', 'break'].includes(c)
		);
		this.emit('choice_presented', 'ui', {
			options_available: safe,
			display_order: safe,
		});
	}
	selectChoice(choice: string, roomId?: string) {
		if (!['replay', 'continue', 'sandbox', 'stop', 'break'].includes(choice))
			return;
		this.checkChoice();
		this.choice = { choice, enacted: false };
		this.emit('choice_selected', 'ui', {
			choice,
			target_room_id: code(roomId),
		});
	}
	private checkChoice(earlyClear = false) {
		const c = this.choice;
		if (
			this.phase !== 'free_choice' ||
			!c ||
			c.enacted ||
			c.first === undefined
		)
			return;
		const duration = this.sessionMs + this.exposureTime() - c.first;
		if (duration >= 60000 || earlyClear) {
			c.enacted = true;
			this.emit('choice_enacted', 'runtime', {
				choice: c.choice,
				duration,
				early_clear: earlyClear,
			});
		}
	}
	marker(marker: string, certainty: 'confirmed' | 'candidate' | 'unknown') {
		if (
			[
				'OBS_ORIENT',
				'IDLE_CANDIDATE',
				'IMPASSE_IDLE',
				'IMPASSE_REPEAT',
				'WAIT_EXPECTED',
				'BELIEF_WRONG',
				'BELIEF_CHANGE',
				'AHA_VERBAL',
				'AHA_NONVERBAL_CANDIDATE',
				'STRATEGY_CHANGE_CANDIDATE',
				'INSIGHT_SUPPORTED',
				'ACCIDENTAL_CLEAR',
				'FRUSTRATION_SIGNAL',
				'QUIT_ROOM',
				'QUIT_SESSION',
				'HINT_EXPOSED',
				'RESTART',
				'CHOICE_ENACTED',
			].includes(marker)
		)
			this.emit('observer_marker', 'observer', {
				code: marker,
				certainty,
				interval_lo: this.wall(),
				interval_hi: this.wall(),
				marker_source: 'live',
			});
	}
	connection(
		lastReliable: number,
		reconnected: number,
		verified: 'verified' | 'unknown'
	) {
		if (
			[lastReliable, reconnected].every(Number.isFinite) &&
			lastReliable >= 0 &&
			reconnected >= lastReliable
		)
			this.emit('connection_drop', 'observer', {
				last_reliable_ms: lastReliable,
				reconnected_ms: reconnected,
				pause_verified: verified,
				observation_missing_lo_ms: lastReliable,
				observation_missing_hi_ms: reconnected,
			});
	}
	finish(
		reason:
			| 'completed'
			| 'participant_stop'
			| 'technical'
			| 'withdrawn'
			| 'navigation' = 'completed',
		complete = true
	) {
		if (this.ended) return;
		this.endRoom('session_stop');
		this.complete &&= complete;
		this.emit('session_end', 'ui', {
			reason,
			complete_log: this.complete,
			event_count: this.events.length + 1,
			dropped_summary_count: this.dropped,
			dropped_critical_count: this.droppedCritical,
		});
		this.ended = true;
	}
	revoke(retain: boolean) {
		this.finish('withdrawn');
		if (!retain) {
			this.events = [];
			try {
				this.options.storage?.removeItem(STORAGE_KEY);
			} catch {
				/* Storage may be disabled. */
			}
			this.unsaved = false;
		}
	}
	export() {
		this.flushPath();
		this.flushGesture();
		this.flushDwell();
		return {
			header: { ...this.header },
			events: [...this.events],
			dropped_summary_count: this.dropped,
			dropped_critical_count: this.droppedCritical,
			complete_log: this.ended && this.complete && !this.exhausted,
		};
	}
	serialize() {
		const json = JSON.stringify(this.export(), null, 2);
		parseStudyLog(json);
		try {
			if (json.length <= MAX_BYTES)
				this.options.storage?.setItem(STORAGE_KEY, json);
			else this.options.storage?.removeItem(STORAGE_KEY);
		} catch {
			/* Explicit export still works when local storage is unavailable/full. */
		}
		return json;
	}
	saved() {
		this.unsaved = false;
	}
	filename() {
		return `fluider-${this.header.round_id ?? 'R00'}-${
			this.header.participant_id ?? 'P00'
		}-${String(this.header.session_id).slice(0, 8)}.json`;
	}
}

/** Data-only import boundary. Bounded size/depth, finite values, known fields, ordered IDs. */
export function parseStudyLog(json: string) {
	if (json.length > 16_000_000) throw new Error('study_log_too_large');
	const log = JSON.parse(json);
	const object = (v: unknown): v is Fields =>
		!!v && typeof v === 'object' && !Array.isArray(v);
	const exact = (value: Fields, keys: string[]) => {
		if (Object.keys(value).some((k) => !keys.includes(k)))
			throw new Error('study_log_unknown_field');
	};
	const visit = (v: unknown, depth = 0): void => {
		if (
			depth > 12 ||
			(typeof v === 'number' && !Number.isFinite(v)) ||
			(typeof v === 'string' && v.length > 200) ||
			(Array.isArray(v) && v.length > 22000)
		)
			throw new Error('study_log_invalid_value');
		if (v && typeof v === 'object')
			for (const child of Object.values(v)) visit(child, depth + 1);
	};
	if (
		!object(log) ||
		!object(log.header) ||
		!Array.isArray(log.events) ||
		log.events.length > 22000
	)
		throw new Error('study_log_invalid');
	exact(log, [
		'header',
		'events',
		'dropped_summary_count',
		'dropped_critical_count',
		'complete_log',
	]);
	exact(log.header, EVENT_FIELDS.session_start.split(' '));
	if (
		log.header.schema_version !== 1 ||
		!object(log.header.consent) ||
		log.header.consent.telemetry !== true
	)
		throw new Error('study_log_no_consent');
	visit(log);
	exact(log.header.consent, ['telemetry', 'screen', 'voice', 'face']);
	if (
		Object.values(log.header.consent).some((v) => typeof v !== 'boolean') ||
		typeof log.header.session_id !== 'string' ||
		!code(log.header.session_id) ||
		typeof log.complete_log !== 'boolean' ||
		!Number.isInteger(log.dropped_summary_count) ||
		!Number.isInteger(log.dropped_critical_count)
	)
		throw new Error('study_log_invalid_header');
	const shape = (v: unknown, keys: string[]) => {
		if (!object(v)) throw new Error('study_log_invalid_shape');
		exact(v, keys);
		return v;
	};
	const coordinate = (v: unknown) => {
		if (v === null) return;
		const p = shape(v, ['x', 'y']);
		if (
			typeof p.x !== 'number' ||
			typeof p.y !== 'number' ||
			p.x < 0 ||
			p.x > 48 ||
			p.y < 0 ||
			p.y > 30
		)
			throw new Error('study_log_invalid_point');
	};
	const state = (v: unknown) => {
		const s = shape(v, [
			'wells',
			'urns',
			'seed_views',
			'ink_used',
			'ink_left',
			'wasted',
			'ever_spoiled',
			'resource_stuck',
			'cleared',
			'terrain_revision',
		]);
		if (
			!Array.isArray(s.wells) ||
			!Array.isArray(s.urns) ||
			!Array.isArray(s.seed_views)
		)
			throw new Error('study_log_invalid_state');
		for (const w of s.wells) {
			const well = shape(w, ['id', 'units', 'unlimited']);
			if (
				well.unlimited === true
					? well.units !== null
					: typeof well.units !== 'number'
			)
				throw new Error('study_log_invalid_well');
		}
		for (const u of [...s.urns, ...s.seed_views]) {
			const target = shape(u, [
				'id',
				'status',
				'units',
				'in_tune',
				'hold',
				'normalized_mix',
			]);
			if (
				target.normalized_mix !== null &&
				(!Array.isArray(target.normalized_mix) ||
					target.normalized_mix.length !== 3)
			)
				throw new Error('study_log_invalid_mix');
		}
	};
	const required: Partial<Record<Name, string>> = {
		session_end:
			'reason complete_log event_count dropped_summary_count dropped_critical_count',
		room_start: EVENT_FIELDS.room_start,
		room_ready: 'summary_state',
		room_end: EVENT_FIELDS.room_end,
		attempt_start: EVENT_FIELDS.attempt_start,
		attempt_end: EVENT_FIELDS.attempt_end,
		first_input: EVENT_FIELDS.first_input,
		first_action: EVENT_FIELDS.first_action,
		action: 'type processed blocked_reason',
		pour_start: 'pour_id spring_id species requested_at actual_at well_before',
		pour_path: EVENT_FIELDS.pour_path,
		pour_stop:
			'pour_id spring_id actual_at reason duration_active_ms well_after units_consumed',
		stir_segment: EVENT_FIELDS.stir_segment,
		hint_open: EVENT_FIELDS.hint_open,
		hint_close: EVENT_FIELDS.hint_close,
		clear: EVENT_FIELDS.clear,
		resource_stuck: EVENT_FIELDS.resource_stuck,
		state_sample: 'summary_state',
		idle_gap: EVENT_FIELDS.idle_gap,
		log_limit: EVENT_FIELDS.log_limit,
	};
	let seq = 0,
		wall = 0;
	for (const e of log.events) {
		if (
			!object(e) ||
			typeof e.name !== 'string' ||
			!Object.hasOwn(EVENT_FIELDS, e.name)
		)
			throw new Error('study_log_unknown_event');
		exact(e, [...ENVELOPE, ...EVENT_FIELDS[e.name as Name].split(' ')]);
		if (
			(required[e.name as Name] ?? '')
				.split(' ')
				.filter(Boolean)
				.some((k) => !(k in e))
		)
			throw new Error('study_log_missing_field');
		if ('summary_state' in e) state(e.summary_state);
		for (const key of [
			'at',
			'actual_at',
			'requested_at',
			...(['action', 'tool_use', 'stir_segment'].includes(e.name) ? ['from', 'to'] : []),
			'min_bounds',
			'max_bounds',
			'centroid_lu',
		])
			if (key in e && typeof e[key] !== 'string') coordinate(e[key]);
		if (e.name === 'time_scale' && (typeof e.from !== 'number' || typeof e.to !== 'number' || e.from < 0 || e.to < 0))
			throw new Error('study_log_invalid_scale');
		if ('velocity' in e) {
			const v = shape(e.velocity, ['x', 'y']);
			if (typeof v.x !== 'number' || typeof v.y !== 'number') throw new Error('study_log_invalid_velocity');
		}
		if ('points' in e) {
			if (!Array.isArray(e.points) || e.points.length > 12)
				throw new Error('study_log_invalid_path');
			for (const value of e.points) {
				const p = shape(value, ['dt_ms', 'x', 'y']);
				coordinate({ x: p.x, y: p.y });
				if (typeof p.dt_ms !== 'number' || p.dt_ms < 0)
					throw new Error('study_log_invalid_path');
			}
		}
		if ('mastery' in e)
			shape(e.mastery, [
				'revived',
				'thrifty',
				'clean',
				'reserve',
				'reserveNeeded',
				'everSpoiled',
				'inkUsed',
				'inkBudget',
			]);
		if (
			e.name === 'pour_stop' &&
			![
				'release',
				'spring_switch',
				'supply_empty',
				'pause',
				'hidden',
				'blur',
				'restart',
				'clear_ui',
				'navigation',
				'error',
				'context_lost',
				'unknown',
			].includes(e.reason as string)
		)
			throw new Error('study_log_invalid_reason');
		if (
			e.name === 'action' &&
			!['paused', 'hidden', 'not_ready', 'disposed', 'none'].includes(
				e.blocked_reason as string
			)
		)
			throw new Error('study_log_invalid_reason');
		if (
			ENVELOPE.some((k) => !(k in e)) ||
			e.v !== 1 ||
			!Number.isInteger(e.seq) ||
			Number(e.seq) <= seq ||
			typeof e.wall_ms !== 'number' ||
			e.wall_ms < wall ||
			typeof e.exposure_active_ms !== 'number' ||
			e.exposure_active_ms < 0 ||
			typeof e.attempt_active_ms !== 'number' ||
			e.attempt_active_ms < 0 ||
			!PHASES.includes(e.phase as Phase) ||
			!['ui', 'runtime', 'model', 'observer'].includes(e.source as string) ||
			e.session_id !== log.header.session_id
		)
			throw new Error('study_log_invalid_envelope');
		seq = Number(e.seq);
		wall = e.wall_ms;
	}
	return log as {
		header: Fields;
		events: Entry[];
		dropped_summary_count: number;
		dropped_critical_count: number;
		complete_log: boolean;
	};
}
