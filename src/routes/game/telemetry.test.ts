import { describe, expect, it, vi } from 'vitest';
// @ts-expect-error Node declarations are excluded from the browser tsconfig.
import { readFileSync } from 'node:fs';
import { LEVELS, SANDBOX } from './levels.js';
import { createRoom } from './model.js';
import { createRuntime } from './runtime.js';
import {
	createTelemetry,
	EVENT_FIELDS,
	parseStudyLog,
	STORAGE_KEY,
	type StudyOptions,
	type Stop,
} from './telemetry.js';
import type {
	Action,
	AirLayer,
	GardenAudio,
	RoomView,
	SensorFrame,
} from './types.js';
import type { LiquidSim, LiquidOptions } from 'svelte-fluid/experimental';
const consent = { telemetry: true, screen: false, voice: false, face: false };
function fixture(options: Partial<StudyOptions> = {}, sandbox = false) {
	let time = 0;
	const level = sandbox ? SANDBOX : LEVELS[0];
	const recorder = createTelemetry(LEVELS, {
		consent,
		now: () => time,
		sessionId: 'test',
		...options,
	})!;
	let room = createRoom(level, { sandbox });
	recorder.startRoom(level, sandbox);
	recorder.startAttempt(room.view(), 'initial', 71429);
	recorder.state('running', 'user', room.view());
	const events = (name: string) =>
		recorder.export().events.filter((e) => e.name === name);
	return {
		recorder,
		events,
		level,
		get room() {
			return room;
		},
		time: (t: number) => (time = t),
		act(action: Action) {
			recorder.beforeAction(action, true, 'none');
			for (const e of room.act(action)) recorder.event(e, room.view());
			recorder.afterAction(room.view());
		},
		restart() {
			recorder.restart(room.view());
			room = createRoom(level);
			recorder.startAttempt(room.view(), 'player_restart', 71429);
		},
		pour() {
			const s = level.springs[0];
			this.act({
				type: 'pour',
				spring: s.id,
				at: { x: s.zone.x, y: s.zone.y },
			});
		},
	};
}
const clear = (view: RoomView) => ({
	type: 'clear' as const,
	dewdrops: 3,
	mastery: {
		revived: true,
		thrifty: true,
		clean: true,
		reserve: 0.5,
		reserveNeeded: 0.1,
		everSpoiled: false,
	},
});

describe('opt-in study recorder acceptance', () => {
	it.each(LEVELS.map(level => [level.id, level] as const))('round-trips every recorder API in a scripted %s session', (_id, level) => {
		let time = 0;
		const r = createTelemetry(LEVELS, { consent, now: () => time, sessionId: 'script' })!;
		const room = createRoom(level);
		const v = () => room.view();
		r.startRoom(level, false); r.startAttempt(v(), 'initial', 71429); r.state('running', 'user', v()); r.ready(v());
		const act = (a: Action) => { r.inputStart(); r.beforeAction(a, true, 'none'); for (const e of room.act(a)) r.event(e, v()); r.afterAction(v()); time += 150; r.inputEnd(); };
		for (const a of level.solution) act(a.action);
		act({ type: 'puff', at: { x: 12, y: 8 } });
		act({ type: 'stir', from: { x: 8, y: 8 }, to: { x: 14, y: 8 } });
		for (const vent of level.vents) {
			if (vent.control?.kind === 'switch') act({ type: 'toggle', id: vent.id });
			if (vent.control?.kind === 'turn') act({ type: 'pose', id: vent.id, index: (vent.control.index + 1) % vent.control.velocities.length });
		}
		r.tool('ink', 'hand', 'keyboard'); r.cursor({ x: 2, y: 2 }, 'mouse', false); time += 2200; r.cursor(null, 'mouse', false);
		r.hintOffer(1, 'accept'); r.hint(1); r.closeHint(1); r.help('technical', 'technical');
		r.restart(v()); r.startAttempt(v(), 'player_restart', 71429);
		r.scale(1, .35); r.event(clear(v()), v()); r.scale(.35, 1);
		r.marker('OBS_ORIENT', 'confirmed'); r.pause('facilitator_break', true); time += 500; r.pause('facilitator_break', false);
		r.connection(0, time, 'verified'); r.phaseChange('free_choice'); r.choices(['replay', 'break']); r.selectChoice('replay', level.id);
		act({ type: 'puff', at: { x: 10, y: 10 } }); time += 60000; r.pulse(); r.sample(v());
		r.endRoom('clear_exit'); r.finish();
		const json = r.serialize();
		expect(parseStudyLog(json)).toEqual(JSON.parse(json));
		expect(parseStudyLog(json).events.find(e => e.name === 'observer_marker')).toMatchObject({ source: 'observer', marker_source: 'live' });
		r.saved(); expect(r.unsaved).toBe(false); expect(r.filename()).toContain('script'); r.revoke(true);
	});
	it.each(['breath', 'hidden-draft'])('records %s vent controls as meaningful semantic actions', id => {
		const level = LEVELS.find(l => l.id === id)!;
		const room = createRoom(level);
		const r = createTelemetry(LEVELS, { consent, sessionId: 'vent' })!;
		r.startRoom(level, false); r.startAttempt(room.view()); r.state('running'); r.ready(room.view());
		const vent = level.vents.find(v => v.control)!;
		const a: Action = vent.control!.kind === 'switch' ? { type: 'toggle', id: vent.id } : { type: 'pose', id: vent.id, index: (room.view().ventControls[vent.id] + 1) % (vent.control!.kind === 'turn' ? vent.control!.velocities.length : 1) };
		r.beforeAction(a, true, 'none');
		for (const e of room.act(a)) r.event(e, room.view());
		r.afterAction(room.view());
		expect(r.export().events.find(e => e.name === 'first_action')).toMatchObject({ action_type: a.type });
		expect(r.export().events.find(e => e.name === 'vent_change')).toMatchObject({ id: vent.id, index: room.view().ventControls[vent.id] });
		expect(() => r.serialize()).not.toThrow();
	});
	it('free-choice duration uses one active clock across room transitions and pauses', () => {
		const f = fixture(); f.recorder.phaseChange('free_choice'); f.time(50000); f.recorder.selectChoice('continue'); f.pour();
		f.time(60000); f.recorder.endRoom();
		f.time(100000); f.recorder.startRoom(LEVELS[1], false);
		const next = createRoom(LEVELS[1]).view(); f.recorder.startAttempt(next); f.recorder.state('running'); f.recorder.ready(next);
		f.time(120000); f.recorder.pause('facilitator_break', true);
		f.time(150000); f.recorder.pause('facilitator_break', false);
		f.time(179999); f.recorder.sample(next); expect(f.events('choice_enacted')).toHaveLength(0);
		f.time(180000); f.recorder.sample(next); expect(f.events('choice_enacted')[0]).toMatchObject({ duration: 60000 });
	});

	it('requires affirmative consent before clocks, IDs, storage or events', () => {
		const now = vi.fn(),
			setItem = vi.fn(),
			removeItem = vi.fn();
		expect(
			createTelemetry(LEVELS, {
				consent: { ...consent, telemetry: false },
				now,
				storage: { setItem, removeItem },
			})
		).toBeUndefined();
		expect(now).not.toHaveBeenCalled();
		expect(setItem).not.toHaveBeenCalled();
		expect(removeItem).not.toHaveBeenCalled();
	});
	it('pairs one accepted pour, clamped same-spring path, release and consumption', () => {
		const f = fixture();
		f.pour();
		f.time(150);
		const s = f.level.springs[0];
		f.act({ type: 'pour', spring: s.id, at: { x: 90, y: -5 } });
		for (let i = 0; i < 10; i++) f.room.planTick();
		f.recorder.sample(f.room.view());
		f.time(1000);
		f.act({ type: 'pour', spring: null });
		expect(f.events('pour_start')).toHaveLength(1);
		expect(f.events('pour_stop')).toHaveLength(1);
		expect(f.events('pour_stop')[0]).toMatchObject({
			reason: 'release',
			duration_active_ms: 1000,
		});
		expect(f.events('pour_stop')[0].units_consumed).toBeGreaterThanOrEqual(0);
		const path = f.events('pour_path')[0];
		expect(path.n_samples).toBe(1);
		expect(path.points).toEqual([
			{ dt_ms: 150, x: s.zone.x + s.zone.w - 0.5, y: s.zone.y + 0.5 },
		]);
		expect(f.events('action')).toHaveLength(2); // same-spring move is summarized, never another boundary
	});
	it.each([
		'supply_empty',
		'pause',
		'hidden',
		'blur',
		'restart',
		'navigation',
		'error',
		'context_lost',
		'clear_ui',
	] as Stop[])(
		'retains %s once, even before a delayed semantic event',
		(reason) => {
			const f = fixture();
			f.pour();
			f.time(800);
			const stopped = { ...f.room.view(), pouring: null };
			if (reason === 'supply_empty') {
				stopped.springs = { [f.level.springs[0].id]: 0 };
				f.recorder.sample(stopped);
			} else if (reason === 'restart') f.restart();
			else if (reason === 'navigation') f.recorder.endRoom();
			else if (reason === 'blur') {
				f.recorder.inputEnd('blur');
				f.act({ type: 'pour', spring: null });
			} else f.recorder.observe(stopped, reason);
			f.recorder.observe(stopped, reason);
			f.recorder.endRoom();
			expect(f.events('pour_stop')).toHaveLength(1);
			expect(f.events('pour_stop')[0].reason).toBe(reason);
		}
	);
	it('closes old spring before opening another; denied input has no accepted pour or first action', () => {
		const f = fixture();
		f.act({ type: 'pour', spring: 'missing', at: { x: 0, y: 0 } });
		expect(f.events('first_input')).toHaveLength(1);
		expect(f.events('first_action')).toHaveLength(0);
		expect(f.events('pour_start')).toHaveLength(0);
		f.pour();
		const next = {
			...f.room.view(),
			springs: { ...f.room.view().springs, second: 10 },
			pouring: { spring: 'second', at: { x: 3, y: 3 } },
		};
		f.recorder.observe(next);
		const events = f.recorder.export().events;
		const stop = events.findIndex((e) => e.name === 'pour_stop');
		expect(events[stop].reason).toBe('spring_switch');
		expect(events[stop + 1].name).toBe('pour_start');
	});
	it('restart closes the attempt, resets tick, preserves exposure time and hint history; 310s fails 300s', () => {
		const f = fixture();
		f.time(150000);
		f.recorder.hint(2);
		f.recorder.closeHint(2);
		f.room.planTick();
		f.restart();
		f.time(310000);
		f.recorder.event(
			clear(f.room.view()),
			{ ...f.room.view(), cleared: true },
			1
		);
		expect(f.events('attempt_end')).toHaveLength(1);
		expect(f.events('attempt_end')[0].reason).toBe('restart');
		expect(f.events('attempt_start')[1]).toMatchObject({
			model_tick: 0,
			attempt_index: 2,
			exposure_active_ms: 150000,
			attempt_active_ms: 0,
			seed: 71429,
		});
		const c = f.events('clear')[0];
		expect(c).toMatchObject({
			wall_ms: 310000,
			exposure_active_ms: 310000,
			attempt_active_ms: 160000,
			max_hint_ever: 2,
			assistance_ever: true,
			observed_model_tick: 0,
			sensor_tick: 1,
		});
		expect(c.exposure_active_ms <= 300000 && c.max_hint_ever === 0).toBe(false);
	});
	it('declined hint offer does not contaminate; first clear frozen per attempt', () => {
		const f = fixture();
		f.recorder.hintOffer(2, 'decline');
		const v = { ...f.room.view(), cleared: true };
		f.recorder.event(clear(v), v);
		f.recorder.hint(2);
		f.recorder.event(clear(v), v);
		expect(f.events('clear')).toHaveLength(1);
		expect(f.events('clear')[0]).toMatchObject({
			max_hint_ever: 0,
			assistance_ever: false,
		});
	});
	it('separates monotonic wall, active and sim clocks; nested pauses do not double-subtract or invent idle', () => {
		const f = fixture();
		f.time(1000);
		f.recorder.pause('hidden', true);
		f.time(2000);
		f.recorder.pause('facilitator_break', true);
		f.time(61000);
		f.recorder.pause('hidden', false);
		f.time(62000);
		f.recorder.pause('facilitator_break', false);
		f.recorder.scale(1, 0);
		f.time(63000);
		f.recorder.sample(f.room.view());
		const last = f.events('state_sample').at(-1)!;
		expect(last).toMatchObject({
			wall_ms: 63000,
			exposure_active_ms: 2000,
			model_tick: 0,
		});
		expect(f.events('idle_gap')).toHaveLength(0);
		f.time(62000);
		f.recorder.scale(0, 0.35);
		expect(f.events('time_scale').at(-1)!.wall_ms).toBe(63000);
	});
	it('25s held input is not idle; pre-first input/settling yields candidates only, pause splits gaps', () => {
		const f = fixture();
		f.pour();
		f.time(25000);
		f.recorder.sample(f.room.view());
		f.act({ type: 'pour', spring: null });
		expect(f.events('idle_gap')).toHaveLength(0);
		f.time(50000);
		f.recorder.pause('hidden', true);
		f.time(110000);
		f.recorder.pause('hidden', false);
		f.time(111000);
		f.recorder.endRoom();
		expect(f.events('idle_gap')).toHaveLength(1);
		expect(f.events('idle_gap')[0]).toMatchObject({
			duration_active_ms: 25000,
			threshold_ms: 20000,
			expected_wait_candidate: true,
		});
		expect(
			f.recorder.export().events.some((e) => e.name.includes('impasse'))
		).toBe(false);
		const g = fixture();
		g.time(25000);
		g.pour();
		expect(g.events('idle_gap')).toHaveLength(1);
	});
	it('stir summary uses every curved segment, stable gesture and cancel flush', () => {
		const f = fixture();
		f.recorder.inputStart();
		f.act({ type: 'stir', from: { x: 1, y: 1 }, to: { x: 4, y: 1 } });
		f.time(100);
		f.act({ type: 'stir', from: { x: 4, y: 1 }, to: { x: 4, y: 5 } });
		f.recorder.inputEnd('unknown');
		expect(f.events('stir_segment')).toHaveLength(1);
		expect(f.events('stir_segment')[0]).toMatchObject({
			n_inputs: 2,
			path_length_lu: 7,
			sum_dx: 3,
			sum_dy: 4,
			min_bounds: { x: 1, y: 1 },
			max_bounds: { x: 4, y: 5 },
			effect_unknown: true,
		});
	});
	it('records request versus observed ink/dig effects without assuming success', () => {
		const f = fixture();
		f.recorder.inputStart();
		f.act({ type: 'ink', stroke: 1, from: { x: 0, y: 0 }, to: { x: 0, y: 1 } });
		f.recorder.inputEnd();
		const u = f.events('tool_use')[0];
		expect(u).toHaveProperty('ink_used_before');
		expect(u).toHaveProperty('terrain_revision_after');
		expect(u).toHaveProperty('denial_count');
		expect(u).not.toHaveProperty('succeeded');
	});
	it('deduplicates status frames, records spoil reentry and resource_stuck distinct from observer impasse', () => {
		const f = fixture();
		const id = f.room.view().urns[0].id;
		for (const status of [
			'spoiled',
			'spoiled',
			'filling',
			'ready',
			'spoiled',
		] as const) {
			const v = {
				...f.room.view(),
				urns: f.room.view().urns.map((u) => ({ ...u, status })),
			};
			f.recorder.event({ type: 'urn', id, status }, v, 2);
		}
		f.recorder.event({ type: 'stuck' }, f.room.view());
		f.recorder.marker('IMPASSE_IDLE', 'candidate');
		expect(f.events('spoil')).toHaveLength(2);
		expect(f.events('spoil')[1].previous_status).toBe('ready');
		expect(f.events('urn_status')[0]).toHaveProperty('normalized_mix');
		expect(f.events('resource_stuck')[0].meaning).toBe(
			'insufficient_recoverable_resources'
		);
		expect(f.events('observer_marker')[0].code).toBe('IMPASSE_IDLE');
	});
	it('round trips null/unlimited with finite clocks, safe fields and complete paired lifecycle', () => {
		const setItem = vi.fn(),
			removeItem = vi.fn();
		const f = fixture({ storage: { setItem, removeItem } }, true);
		f.pour();
		f.time(500);
		f.recorder.finish();
		f.recorder.finish('navigation');
		f.recorder.endRoom();
		const log = parseStudyLog(f.recorder.serialize());
		expect(log.complete_log).toBe(true);
		expect(f.events('session_end')).toHaveLength(1);
		expect(f.events('attempt_end')).toHaveLength(1);
		expect(f.events('room_end')).toHaveLength(1);
		const state = f.events('room_ready')[0].summary_state as {
			wells: object[];
		};
		expect(state.wells[0]).toMatchObject({ units: null, unlimited: true });
		expect(setItem).toHaveBeenCalledWith(STORAGE_KEY, expect.any(String));
		expect(log.events.map((e) => e.seq)).toEqual(
			log.events.map((_, i) => i + 1)
		);
		expect(
			log.events.every((e) =>
				Object.keys(e).every((key) =>
					[
						'v',
						'seq',
						'name',
						'session_id',
						'room_id',
						'exposure_id',
						'attempt_id',
						'phase',
						'wall_ms',
						'exposure_active_ms',
						'attempt_active_ms',
						'model_tick',
						'source',
						...EVENT_FIELDS[e.name as keyof typeof EVENT_FIELDS].split(' '),
					].includes(key)
				)
			)
		).toBe(true);
	});
	it('rejects malformed, oversized, unknown events/fields, duplicate IDs and nonfinite numbers', () => {
		const f = fixture();
		const log = f.recorder.export();
		for (const value of [
			'{',
			' '.repeat(16_000_001),
			JSON.stringify({ ...log, secret: 'no' }),
			JSON.stringify({
				...log,
				events: [{ ...log.events[0], name: 'impasse' }],
			}),
			JSON.stringify({
				...log,
				events: [{ ...log.events[0], stack: 'private' }],
			}),
			JSON.stringify({ ...log, events: [log.events[0], log.events[0]] }),
			JSON.stringify(log).replace('"wall_ms":0', '"wall_ms":1e999'),
		])
			expect(() => parseStudyLog(value)).toThrow();
	});
	it('retains lifecycle/clear/hints after summary cap, warns, stops honestly at critical reserve', () => {
		const onLimit = vi.fn();
		const f = fixture({ capEvents: 2, criticalReserve: 30, onLimit });
		for (let i = 1; i <= 100; i++) {
			f.time(i * 500);
			f.recorder.sample(f.room.view());
		}
		f.recorder.hint(2);
		f.restart();
		f.recorder.event(clear(f.room.view()), f.room.view());
		f.recorder.finish();
		expect(f.events('state_sample')).toHaveLength(2);
		expect(f.events('log_limit')).toHaveLength(1);
		expect(f.events('hint_open')).toHaveLength(1);
		expect(f.events('clear')).toHaveLength(1);
		expect(f.events('attempt_end')).toHaveLength(2);
		expect(f.events('session_end')).toHaveLength(1);
		expect(f.recorder.export().complete_log).toBe(false);
		expect(onLimit).toHaveBeenCalled();
		const g = fixture({ capEvents: 1, criticalReserve: 8 });
		for (let i = 0; i < 50; i++) g.recorder.hint(1);
		g.recorder.finish();
		expect(g.recorder.export().events.length).toBeLessThanOrEqual(9);
		expect(g.events('log_limit').at(-1)?.critical_capture_available).toBe(
			false
		);
		expect(g.recorder.export().dropped_critical_count).toBeGreaterThan(0);
	});
	it('keeps high-frequency gestures and repeated denials bounded after sampling cap', () => {
		const f = fixture({ capEvents: 1 });
		f.recorder.inputStart();
		for (let i = 0; i < 100; i++) {
			f.time(i * 100);
			f.act({
				type: 'ink',
				stroke: 1,
				from: { x: 1, y: 1 },
				to: { x: 2, y: 1 },
			});
		}
		f.recorder.inputEnd();
		expect(f.events('action')).toHaveLength(1);
		expect(f.events('action_denied')).toHaveLength(1);
		expect(f.events('tool_use')).toHaveLength(1);
		expect(f.events('log_limit')).toHaveLength(1);
	});
	it('future tagged actions retain allowlisted metadata, no raw errors/text', () => {
		const f = fixture();
		f.act({
			type: 'vent-toggle',
			id: 'vent-1',
			enabled: true,
			strength: 3,
			secret: '/Users/private',
		} as unknown as Action);
		f.recorder.state('error', 'error');
		const json = f.recorder.serialize();
		expect(json).not.toContain('/Users/private');
		expect(f.events('action')[0]).toMatchObject({
			type: 'vent-toggle',
			id: 'vent-1',
			enabled: true,
			strength: 3,
		});
	});
	it('withdrawal stops capture immediately; offers retained export or deletes only study storage', () => {
		const removeItem = vi.fn();
		const f = fixture({ storage: { setItem: vi.fn(), removeItem } });
		f.recorder.revoke(true);
		const n = f.recorder.export().events.length;
		f.pour();
		f.recorder.hint(3);
		expect(f.recorder.export().events).toHaveLength(n);
		f.recorder.revoke(false);
		expect(f.recorder.export().events).toEqual([]);
		expect(removeItem).toHaveBeenCalledExactlyOnceWith(STORAGE_KEY);
	});
	it('selection alone not enacted; gameplay plus 60 active seconds or earlier true clear is enacted, sandbox separate', () => {
		const f = fixture();
		f.recorder.phaseChange('free_choice');
		f.recorder.choices(['replay', 'continue', 'sandbox', 'stop', 'break']);
		f.recorder.selectChoice('replay', f.level.id);
		f.time(61000);
		f.recorder.sample(f.room.view());
		expect(f.events('choice_enacted')).toHaveLength(0);
		f.pour();
		f.time(120999);
		f.recorder.sample(f.room.view());
		expect(f.events('choice_enacted')).toHaveLength(0);
		f.time(121000);
		f.recorder.sample(f.room.view());
		expect(f.events('choice_enacted')[0]).toMatchObject({
			choice: 'replay',
			duration: 60000,
			early_clear: false,
		});
		const g = fixture();
		g.recorder.phaseChange('free_choice');
		g.recorder.selectChoice('sandbox');
		g.pour();
		g.time(100);
		g.recorder.event(clear(g.room.view()), g.room.view());
		expect(g.events('choice_enacted')[0]).toMatchObject({
			choice: 'sandbox',
			early_clear: true,
		});
	});
	it('cursor dwell board-only, no held input; passive movement never resets idle', () => {
		const f = fixture();
		f.recorder.cursor({ x: 2, y: 2 }, 'mouse', false);
		f.time(25000);
		f.recorder.cursor({ x: 2.5, y: 2.5 }, 'mouse', false);
		f.recorder.cursor(null, 'mouse', false);
		f.pour();
		expect(f.events('cursor_dwell')).toHaveLength(1);
		expect(f.events('idle_gap')).toHaveLength(1);
	});
});

function runtimeFixture(enabled: boolean) {
	let time = 0,
		callback: FrameRequestCallback = () => {},
		viewCalls = 0;
	const storage = { setItem: vi.fn(), removeItem: vi.fn() },
		now = vi.fn(() => time);
	const telemetry = createTelemetry(LEVELS, {
		consent: { ...consent, telemetry: enabled },
		now,
		storage,
		sessionId: 'runtime',
	});
	telemetry?.startRoom(LEVELS[0], false);
	const models: ReturnType<typeof createRoom>[] = [];
	const air: AirLayer = {
		stir: vi.fn(),
		puff: vi.fn(),
		syncTerrain() {},
		ready: () => true,
		step() {},
		wind: () => undefined,
		resize() {},
		render() {},
		dispose() {},
	};
	let simOptions!: LiquidOptions;
	const steps: unknown[] = [],
		forwarded: unknown[] = [],
		actions: unknown[] = [];
	const sim = {
		load() {},
		step(input) {
			steps.push(input);
		},
		pollSensors: () => [],
		render() {},
		resize() {},
		dispose() {},
		emitted: [0, 0, 0],
		capacityLeft: 65536,
		compact() {},
	} as LiquidSim;
	const runtime = createRuntime({
		canvas: {
			width: 192,
			height: 120,
			clientWidth: 192,
			clientHeight: 120,
		} as HTMLCanvasElement,
		airCanvas: new EventTarget() as HTMLCanvasElement,
		level: LEVELS[0],
		makeSim: (o) => {
			simOptions = o;
			return sim;
		},
		makeAir: () => air,
		makeRoom: (level) => {
			const model = createRoom(level);
			models.push(model);
			return {
				...model,
				view() {
					viewCalls++;
					return model.view();
				},
				act(a) {
					actions.push(a);
					return model.act(a);
				},
			};
		},
		audio: { ui() {}, update() {} } as unknown as GardenAudio,
		onView() {},
		onEvent: (e) => forwarded.push(e),
		telemetry,
		visibility: Object.assign(new EventTarget(), { hidden: false }),
		clock: {
			request: (fn) => {
				callback = fn;
				return 1;
			},
			cancel() {},
		},
	});
	return {
		runtime,
		telemetry,
		storage,
		now,
		models,
		air,
		steps,
		forwarded,
		actions,
		get viewCalls() {
			return viewCalls;
		},
		get simOptions() {
			return simOptions;
		},
		frame(t: number) {
			time = t;
			callback(t);
		},
	};
}
describe('runtime telemetry boundary', () => {
	it('disabled is a no-op, no per-tick telemetry allocations/evaluations, identical actions and outcomes', () => {
		const off = runtimeFixture(false),
			on = runtimeFixture(true);
		const stir: Action = {
			type: 'stir',
			from: { x: 1, y: 1 },
			to: { x: 4, y: 2 },
		};
		for (const f of [off, on]) {
			f.runtime.act(stir);
			f.frame(0);
			f.frame(17);
			f.frame(34);
			f.runtime.dispose();
		}
		expect(off.telemetry).toBeUndefined();
		expect(off.now).not.toHaveBeenCalled();
		expect(off.storage.setItem).not.toHaveBeenCalled();
		expect(off.storage.removeItem).not.toHaveBeenCalled();
		expect(off.actions).toEqual(on.actions);
		expect(off.steps).toEqual(on.steps);
		expect(off.forwarded).toEqual(on.forwarded);
		expect(off.models[0].view()).toEqual(on.models[0].view());
		expect(off.air.stir).toHaveBeenCalledTimes(1);
		expect(on.air.stir).toHaveBeenCalledTimes(1);
		// The optional call short-circuits argument evaluation; no wrapper or per-tick object is built off-path.
		let allocations = 0;
		off.telemetry?.sample((allocations++, off.models[0].view()));
		expect(allocations).toBe(0);
		const source = readFileSync(
			new URL('./runtime.ts', import.meta.url),
			'utf8'
		);
		expect(source).toContain('options.telemetry?.sample(view)');
		expect(source).not.toContain('JSON.stringify');
	});
	it('restart closes attempt, dispose closes exposure once, runtime error exports enum only', () => {
		const f = runtimeFixture(true);
		const s = LEVELS[0].springs[0];
		f.runtime.act({
			type: 'pour',
			spring: s.id,
			at: { x: s.zone.x + 1, y: s.zone.y + 1 },
		});
		f.runtime.restart();
		f.simOptions.onError?.(new Error('/Users/private/secret'));
		f.runtime.dispose();
		f.runtime.dispose();
		f.telemetry!.finish('navigation', false);
		const log = f.telemetry!.serialize();
		expect(log).not.toContain('/Users/private');
		const events = f.telemetry!.export().events;
		expect(
			events.filter((e) => e.name === 'attempt_end').map((e) => e.reason)
		).toEqual(['restart', 'room_exit']);
		expect(events.filter((e) => e.name === 'room_end')).toHaveLength(1);
		expect(events.find((e) => e.name === 'pour_stop')?.reason).toBe('restart');
	});
});
