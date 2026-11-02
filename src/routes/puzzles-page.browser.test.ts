import { afterEach, describe, expect, it, vi } from 'vitest';
import { mount, tick, unmount } from 'svelte';
import { commands, page, userEvent } from 'vitest/browser';
import Page from './+page.svelte';
import { FakeLiquid } from './game/fake-liquid.js';
import { createAirLayer } from './game/air.js';
import { LEVELS as REAL_LEVELS } from './game/levels.js';
import Map from './game/Map.svelte';
import { saveProgress } from './game/progress.js';
import { createRoom } from './game/model.js';
import { parseStudyLog, STORAGE_KEY } from './game/telemetry.js';
import type {
	Action,
	AirLayer,
	GameEvent,
	Level,
	Progress,
	RoomModel,
	RoomView,
} from './game/types.js';

const beforeTwoSprings = Object.fromEntries(REAL_LEVELS.slice(0, REAL_LEVELS.findIndex(l => l.id === 'two-springs')).map(l => [l.id, 3]));

vi.mock('./game/progress.js', async (importOriginal) => ({
	...(await importOriginal<typeof import('./game/progress.js')>()),
	loadProgress: () => ({ version: 2, cleared: {}, finale: false }),
	saveProgress: vi.fn(),
	recordClear: (p: Progress, id: string, drops: number) => ({
		...p,
		cleared: { ...p.cleared, [id]: Math.max(p.cleared[id] ?? 0, drops) },
	}),
	unlocked: (p: Progress) => Object.keys(p.cleared).length,
}));

const terrain = Array.from({ length: 30 }, (_, y) =>
	Array.from({ length: 48 }, (_, x) =>
		y >= 28 ||
		x === 0 ||
		x === 47 ||
		(y === 25 && x >= 29 && x <= 37) ||
		((x === 29 || x === 37) && y >= 18 && y <= 25)
			? '#'
			: ' '
	).join('')
);
const base: Level = {
	id: 'first-rain',
	name: 'First Rain',
	act: 1,
	terrain,
	springs: [
		{
			id: 'dew',
			species: 0,
			zone: { x: 8, y: 3, w: 14, h: 3 },
			well: 36,
			rate: 6,
			style: 'cloud',
		},
	],
	vents: [],
	planks: [],
	gates: [
		{
			id: 'flush',
			style: 'plug',
			box: { x: 33, y: 25, w: 1, h: 1 },
			retract: 'down',
			open: false,
			driver: { kind: 'player' },
		},
	],
	urns: [
		{
			id: 'vessel',
			box: { x: 30, y: 18, w: 7, h: 7 },
			recipe: { amount: 24, mix: [1, 0, 0] },
			plug: 'flush',
			powers: ['lantern'],
		},
	],
	seeds: [],
	brambles: [],
	wheels: [],
	drains: [],
	machines: [
		{ id: 'lantern', kind: 'lanterns', box: { x: 39, y: 19, w: 5, h: 7 } },
	],
	ink: 0,
	dig: false,
	pools: [],
	mastery: { reserve: 0.1 },
	hints: [
		'Position the rain.',
		'The gutter starts on the right.',
		'Press the bright end.',
	],
	solution: [],
};
const levels = [
	base,
	{ ...base, id: 'breath', name: 'Breath', cues: ['puff'] as const },
	{ ...base, id: 'two-springs', name: 'Two Springs' },
];
const wait = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));
function fixtureRoom(level: Level): RoomModel {
	let v: RoomView = {
		tick: 0,
		springs: Object.fromEntries(level.springs.map((s) => [s.id, s.well])),
		pouring: null,
		vents: {},
		ventControls: {},
		gauges: {},
		planks: {},
		gates: {},
		urns: level.urns.map((u) => ({
			id: u.id,
			counts: [0, 0, 0],
			units: 0,
			status: 'filling',
			hold: 0,
			fill: 0,
			inTune: false,
		})),
		seedViews: [],
		stuck: false,
		seeds: {},
		brambles: {},
		wheels: {},
		machines: {},
		inkLeft: level.ink,
		inkUsed: 0,
		wasted: 0,
		everSpoiled: false,
		cleared: false,
		activity: 0,
		terrain: new Uint8Array(192 * 120),
		terrainRevision: 0,
	};
	for (let y = 0; y < 120; y++)
		for (let x = 0; x < 192; x++)
			v.terrain[y * 192 + x] =
				level.terrain[Math.floor(y / 4)][Math.floor(x / 4)] === '#' ? 1 : 0;
	const mastery = () => ({
		revived: v.cleared,
		thrifty: fixtureThrifty,
		clean: true,
		reserve: fixtureThrifty ? 0.27 : 0.05,
		reserveNeeded: level.mastery.reserve,
		everSpoiled: false,
	});
	return {
		level,
		scene: () => ({
			width: 192,
			height: 120,
			terrain: v.terrain,
			fills: fillFixture
				? [
						{
							species: 0,
							markers: 64 * 28,
							rect: { x: 121, y: 79, w: 26, h: 20 },
						},
				  ]
				: [],
			sensors: [],
			drains: [],
		}),
		act(action) {
			actions.push(action);
			if (action.type === 'pour') {
				if (!action.spring) v = { ...v, pouring: null };
				else {
					const s = level.springs.find((s) => s.id === action.spring)!;
					const p = action.at!;
					v = {
						...v,
						pouring: {
							spring: s.id,
							at: {
								x: Math.max(s.zone.x, Math.min(s.zone.x + s.zone.w, p.x)),
								y: Math.max(s.zone.y, Math.min(s.zone.y + s.zone.h, p.y)),
							},
						},
					};
				}
				return [{ type: 'pour', spring: action.spring }];
			}
			if (action.type === 'puff') return [{ type: 'puff', at: action.at }];
			return [];
		},
		planTick() {
			v = { ...v, ...fixtureView, tick: v.tick + 1 };
			if (!v.pouring) return { tick: v.tick, edits: [], emit: [] };
			const s = level.springs.find((s) => s.id === v.pouring!.spring)!;
			v = {
				...v,
				springs: {
					...v.springs,
					[s.id]: Math.max(0, v.springs[s.id] - s.rate / 60),
				},
			};
			return {
				tick: v.tick,
				edits: [],
				emit: [
					{
						species: s.species,
						count: 7,
						rect: {
							x: v.pouring!.at.x * 4,
							y: v.pouring!.at.y * 4,
							w: 0.6,
							h: 0.6,
						},
						velocity: { x: 0, y: 20 },
					},
				],
			};
		},
		observe() {
			if (fixtureStatus)
				v = {
					...v,
					urns: v.urns.map((u) => ({
						...u,
						status: fixtureStatus!,
						counts: fixtureStatus === 'spoiled' ? [1408, 384, 0] : [1792, 0, 0],
						units: 28,
						fill: 28 / 24,
						inTune: fixtureStatus !== 'spoiled',
						hold: fixtureStatus === 'ready' ? 0.55 : 0,
					})),
				};
			if (clearNow && !v.cleared) {
				v = {
					...v,
					cleared: true,
					pouring: null,
					urns: v.urns.map((u) => ({ ...u, status: 'complete', hold: 1 })),
					machines: Object.fromEntries(level.machines.map((m) => [m.id, true])),
				};
				return [
					{
						type: 'clear',
						dewdrops: fixtureThrifty ? 3 : 2,
						mastery: mastery(),
					},
				];
			}
			return [];
		},
		view: () => v,
		dewdrops: () => (v.cleared ? 3 : 0),
		mastery,
	};
}
const fakeAir = (): AirLayer => ({
	stir: vi.fn(),
	puff: vi.fn(),
	syncTerrain() {},
	step() {},
	ready: () => true,
	wind: () => undefined,
	resize() {},
	render() {},
	dispose() {},
});
let app: ReturnType<typeof mount> | undefined;
let target: HTMLDivElement;
let actions: Action[] = [];
let latest: RoomView;
let clearNow = false;
let fixtureThrifty = true;
let fixtureStatus: 'filling' | 'ready' | 'spoiled' | undefined;
let fillFixture = false;
let fixtureView: Partial<RoomView> = {};
async function setup(
	options: {
		realAir?: boolean;
		realRoom?: boolean;
		realLevels?: boolean;
		progress?: Progress;
		roomFactory?: typeof createRoom;
		consent?: 'accept' | 'decline';
		beforeConsent?: () => void;
	} = {}
) {
	await (
		commands as unknown as {
			setViewport(size: { width: number; height: number }): Promise<void>;
		}
	).setViewport({ width: 1320, height: 940 });
	await page.viewport(1280, 900);
	target = document.createElement('div');
	document.body.append(target);
	app = mount(Page, {
		target,
		props: {
			levels: options.realRoom || options.realLevels ? REAL_LEVELS : levels,
			fixtureProgress: options.progress ?? {
				version: 2,
				cleared: {},
				finale: false,
			},
			simFactory: options.realRoom ? undefined : (opts) => new FakeLiquid(opts),
			airFactory: options.realAir ? createAirLayer : fakeAir,
			roomFactory:
				options.roomFactory ?? (options.realRoom ? createRoom : fixtureRoom),
			onRoomView: (v) => (latest = v),
		},
	});
	await tick();
	expect(document.title).toBe('Fluider');
	await expect.element(page.getByRole('heading', { name: 'Fluider.' })).toBeVisible();
	if (options.consent) {
		expect(localStorage.getItem(STORAGE_KEY)).toBeNull();
		expect(document.querySelector('[aria-label="Study recording"]')).toBeNull();
		options.beforeConsent?.();
		await page.getByRole('button', { name: options.consent === 'accept' ? 'Accept telemetry and start study' : 'Decline recording' }).click();
	}
	await page
		.getByRole('button', {
			name: options.progress ? /Continue the garden/ : /Enter the greenhouse/,
		})
		.click();
	await vi.waitFor(() =>
		expect(document.querySelector('.board')).not.toBeNull()
	);
	await wait(80);
}
function pointer() {
	const board = document.querySelector('.board') as HTMLDivElement;
	vi.spyOn(board, 'setPointerCapture').mockImplementation(() => {});
	vi.spyOn(board, 'hasPointerCapture').mockReturnValue(false);
	const r = board.getBoundingClientRect();
	return (type: string, x: number, y: number, id = 1) =>
		board.dispatchEvent(
			new PointerEvent(type, {
				bubbles: true,
				pointerId: id,
				button: 0,
				clientX: r.x + (x / 48) * r.width,
				clientY: r.y + (y / 30) * r.height,
			})
		);
}
async function shot(name: string, path = `/tmp/verdigris-v3/v3-verbs/ui/${name}.png`) {
	const browser = commands as unknown as {
		captureCanvasScreenshot(rect: {
			x: number;
			y: number;
			width: number;
			height: number;
		}): Promise<string>;
		writeBenchBase64(path: string, data: string): Promise<void>;
	};
	await browser.writeBenchBase64(
		path,
		await browser.captureCanvasScreenshot({
			x: 0,
			y: 0,
			width: innerWidth,
			height: innerHeight,
		})
	);
}
afterEach(async () => {
	if (app) await unmount(app);
	app = undefined;
	target?.remove();
	actions = [];
	clearNow = false;
	fixtureThrifty = true;
	localStorage.removeItem('verdigris-onboarding-v2');
	fixtureStatus = undefined;
	fillFixture = false;
	fixtureView = {};
	localStorage.removeItem('verdigris-sound-v2');
	localStorage.removeItem(STORAGE_KEY);
	vi.restoreAllMocks();
});

describe('Verdigris study recording', () => {
	it('research break keeps resume controls reachable and resumes active clocks', async () => {
		const original = location.href; history.replaceState(history.state, '', '?study=1');
		try {
			await setup({ consent: 'accept' });
			await page.getByText('Facilitator controls', { exact: true }).click();
			const write = vi.spyOn(navigator.clipboard, 'writeText').mockResolvedValue();
			await page.getByRole('button', { name: 'Start research break', exact: true }).click();
			expect(document.querySelector('dialog[open]')).toBeNull();
			await page.getByRole('button', { name: 'Copy log', exact: true }).click();
			const before = parseStudyLog(write.mock.calls.at(-1)![0]).events.at(-1)!.exposure_active_ms;
			await wait(100); await page.getByRole('button', { name: 'End research break', exact: true }).click();
			await wait(100); await page.getByRole('button', { name: 'Copy log', exact: true }).click();
			const log = parseStudyLog(write.mock.calls.at(-1)![0]);
			expect(log.events.find(e => e.name === 'pause_end' && e.reason === 'facilitator_break')).toBeDefined();
			const p = pointer(); p('pointerdown', 12, 4); p('pointerup', 12, 4);
			await page.getByRole('button', { name: 'Copy log', exact: true }).click();
			expect(parseStudyLog(write.mock.calls.at(-1)![0]).events.at(-1)!.exposure_active_ms).toBeGreaterThan(before);
		} finally { history.replaceState(history.state, '', original); }
	});
	it('consent succeeds with a denied localStorage getter and exports from memory', async () => {
		const original = location.href; history.replaceState(history.state, '', '?study=1');
		try {
			let denied: ReturnType<typeof vi.spyOn> | undefined;
			await setup({ consent: 'accept', beforeConsent: () => { denied = vi.spyOn(window, 'localStorage', 'get').mockImplementation(() => { throw new DOMException('Denied', 'SecurityError'); }); } });
			denied?.mockRestore();
			expect(document.querySelector('[aria-label="Study recording"]')?.textContent).toContain('enabled');
			const write = vi.spyOn(navigator.clipboard, 'writeText').mockResolvedValue();
			await page.getByRole('button', { name: 'Copy log', exact: true }).click();
			expect(parseStudyLog(write.mock.calls.at(-1)![0]).header.consent).toMatchObject({ telemetry: true });
		} finally { vi.restoreAllMocks(); history.replaceState(history.state, '', original); }
	});
	it('BFCache restore honestly shows the pagehide-ended session as stopped', async () => {
		const original = location.href; history.replaceState(history.state, '', '?study=1');
		try {
			await setup({ consent: 'accept' });
			window.dispatchEvent(new PageTransitionEvent('pagehide', { persisted: true }));
			window.dispatchEvent(new PageTransitionEvent('pageshow', { persisted: true })); await tick();
			expect(document.querySelector('[aria-label="Study recording"]')?.textContent).toContain('Study recording stopped');
			expect(document.body.textContent).toContain('Restored page is not recording');
			const write = vi.spyOn(navigator.clipboard, 'writeText').mockResolvedValue();
			await page.getByRole('button', { name: 'Copy log', exact: true }).click();
			const log = parseStudyLog(write.mock.calls.at(-1)![0]);
			expect(log.events.filter(e => e.name === 'session_end')).toHaveLength(1);
			expect(log.complete_log).toBe(false);
		} finally { history.replaceState(history.state, '', original); }
	});

	it('requires explicit consent, exports pour, hint and restart against the spec schema', async () => {
		const original = location.href;
		history.replaceState(history.state, '', '?study=1');
		try {
			await setup({ consent: 'accept' });
			const p = pointer();
			const spring = levels[0].springs[0];
			p('pointerdown', spring.zone.x + spring.zone.w / 2, spring.zone.y + spring.zone.h / 2);
			p('pointerup', spring.zone.x + spring.zone.w / 2, spring.zone.y + spring.zone.h / 2);
			await page.getByRole('button', { name: 'Open next hint' }).click();
			await userEvent.keyboard('rr');
			const write = vi.spyOn(navigator.clipboard, 'writeText').mockResolvedValue();
			await page.getByRole('button', { name: 'Copy log' }).click();
			const log = parseStudyLog(write.mock.calls[0][0]);
			expect(log.header.schema_version).toBe(1);
			expect(log.header.consent).toEqual({ telemetry: true, screen: false, voice: false, face: false });
			expect(log.header.build_hash).toMatch(/^[a-f0-9]{40}$/);
			expect(log.events.find(e => e.name === 'pour_stop')).toMatchObject({ reason: 'release', spring_id: spring.id });
			expect(log.events.filter(e => e.name === 'attempt_end')).toHaveLength(1);
			expect(log.events.filter(e => e.name === 'attempt_start')).toHaveLength(2);
			expect(log.events.find(e => e.name === 'hint_open')).toMatchObject({ tier: 1, max_hint_ever: 1 });
			expect(log.events.find(e => e.name === 'restart')).toMatchObject({ max_hint_ever: 1, reason: 'player' });
			await page.getByRole('button', { name: 'Finish study', exact: true }).click();
			await page.getByRole('button', { name: 'Copy log' }).click();
			const ended = parseStudyLog(write.mock.calls.at(-1)![0]);
			expect(ended.complete_log).toBe(true);
			expect(ended.events.filter(e => e.name === 'session_end')).toHaveLength(1);
			expect(log.events.map((e: { name: string }) => e.name)).toEqual(expect.arrayContaining(['pour_start', 'pour_stop', 'hint_open', 'restart', 'attempt_end']));
		} finally { history.replaceState(history.state, '', original); }
	});
	it('decline captures no study data and leaves gameplay available', async () => {
		const original = location.href; history.replaceState(history.state, '', '?study=1');
		try { await setup({ consent: 'decline' }); const p = pointer(); p('pointerdown', 10, 4); p('pointerup', 10, 4); expect(document.querySelector('[aria-label="Study recording"]')).toBeNull(); expect(localStorage.getItem(STORAGE_KEY)).toBeNull(); } finally { history.replaceState(history.state, '', original); }
	});
});

describe('Verdigris contextual gestures', () => {
	it('retains hint depth per room across close, restart and return; Back opens map', async () => {
		await setup();
		await page.getByRole('button', { name: 'Open next hint' }).click();
		await page.getByRole('button', { name: 'A little more light' }).click();
		expect(document.querySelectorAll('.hints p')).toHaveLength(2);
		await page.getByRole('button', { name: 'Close hints' }).click();
		await page.getByRole('button', { name: 'Open next hint' }).click();
		expect(document.querySelectorAll('.hints p')).toHaveLength(2);
		await userEvent.keyboard('rr');
		expect(document.querySelectorAll('.hints p')).toHaveLength(2);
		history.back();
		await vi.waitFor(() =>
			expect(document.querySelector('[data-screen="map"]')).not.toBeNull()
		);
		await page.getByRole('button', { name: /First Rain,/ }).click();
		expect(document.querySelectorAll('.hints p')).toHaveLength(2);
	});
	it('persists mute and volume in pause controls', async () => {
		localStorage.setItem('verdigris-sound-v2', '{"muted":true,"volume":0.25}');
		await setup();
		await page.getByRole('button', { name: 'Pause garden' }).click();
		expect(
			document
				.querySelector('.sound-controls button')
				?.getAttribute('aria-pressed')
		).toBe('true');
		const volume = document.querySelector(
			'.sound-controls input'
		) as HTMLInputElement;
		expect(volume.value).toBe('0.25');
		volume.value = '0.4';
		volume.dispatchEvent(new Event('input', { bubbles: true }));
		await page.getByRole('button', { name: 'Sound is sleeping' }).click();
		expect(JSON.parse(localStorage.getItem('verdigris-sound-v2')!)).toEqual({
			muted: false,
			volume: 0.4,
		});
	});
	it('mixed recipe uses one amount line and green glow; live region ignores fill', async () => {
		await setup({
			realLevels: true,
			progress: {
				version: 2,
				cleared: beforeTwoSprings,
				finale: false,
			},
		});
		const filling = {
			id: 'green-urn',
			counts: [640, 256, 0] as const,
			units: 14,
			fill: 1,
			status: 'filling' as const,
			hold: 0,
			inTune: false,
		};
		fixtureView = { urns: [filling] };
		await vi.waitFor(() =>
			expect(
				document.querySelector('[data-plaque="green-urn"] .amount-label')
					?.textContent
			).toBe('14 · more sap')
		);
		expect(
			document.querySelector('.ratio-tick, [data-reserve-marker]')
		).toBeNull();
		expect(document.querySelectorAll('[data-room-supply]')).toHaveLength(1);
		const summary = document.querySelector('.objective-summary')!.textContent;
		fixtureView = { urns: [{ ...filling, units: 14.2, fill: 1.01 }] };
		await wait(100);
		expect(document.querySelector('.objective-summary')!.textContent).toBe(
			summary
		);
		fixtureView = {
			urns: [{ ...filling, counts: [448, 448, 0], inTune: true }],
		};
		await vi.waitFor(() =>
			expect(
				document.querySelector('[data-plaque="green-urn"].green')
			).not.toBeNull()
		);
		expect(document.body.textContent).toContain('green ✓');
		await shot('green-in-tune');
	});
	it('drains flash, readiness prompts release, reduced motion retains wheel glow', async () => {
		await setup({ realLevels: true });
		fixtureView = { wasted: 1, wheels: { 'rain-wheel': 2 } };
		fixtureStatus = 'ready';
		await vi.waitFor(() =>
			expect(document.querySelector('.draining')).not.toBeNull()
		);
		expect(document.querySelector('.amount-label')?.textContent).toBe('24+ ✓');
		expect(document.querySelector('.release-label')?.textContent).toBe(
			'release'
		);
		await (
			commands as unknown as {
				emulateControlMedia(media: { reducedMotion: string }): Promise<void>;
			}
		).emulateControlMedia({ reducedMotion: 'reduce' });
		expect(
			getComputedStyle(document.querySelector('.waterwheel')!).filter
		).not.toBe('none');
		await shot('ready-wheel-reduced-motion');
		await (
			commands as unknown as {
				emulateControlMedia(media: { reducedMotion: string }): Promise<void>;
			}
		).emulateControlMedia({ reducedMotion: 'no-preference' });
	});
	it('Breath introduces mist and a keyboard-focusable vent, never requires sweeps', async () => {
		await setup({ realLevels: true, progress: { version: 2, cleared: { 'first-rain': 3 }, finale: false } });
		expect(document.querySelector('[data-vent="glass-draft"]')).not.toBeNull();
		expect(document.querySelector('[data-onboarding="puff"]')?.textContent).toContain('tap the air to see it move');
		const control = document.querySelector('[data-control="glass-draft"]') as HTMLButtonElement;
		expect(control.getAttribute('aria-label')).toContain('off');
		expect(control.getBoundingClientRect().width).toBeGreaterThanOrEqual(44);
		await shot('breath-vent-off');
		const send = pointer(); send('pointerdown', 18, 7); send('pointerup', 18, 7);
		expect(actions.some(a => a.type === 'puff')).toBe(true);
		expect(actions.some(a => a.type === 'stir')).toBe(false);
	});
	it('never stirs during a spring gesture, including after leaving the zone', async () => {
		await setup();
		const send = pointer();
		send('pointerdown', 12, 4);
		send('pointermove', 20, 9);
		send('pointerup', 20, 9);
		expect(
			actions.some((action) => action.type === 'pour' && action.spring !== null)
		).toBe(true);
		expect(actions.some((action) => action.type === 'stir')).toBe(false);
	});
	it('stale spring views cannot repeat denial feedback during sixty held moves', async () => {
		const emitted: GameEvent[] = [];
		await setup({
			roomFactory: (level) => {
				const room = createRoom({
					...level,
					springs: level.springs.map((spring) => ({ ...spring, well: 0 })),
				});
				return {
					...room,
					view: () => ({ ...room.view(), springs: { dew: 1 } }),
					act(action) {
						const events = room.act(action);
						emitted.push(...events);
						return events;
					},
				};
			},
		});
		const send = pointer();
		send('pointerdown', 12, 4);
		for (let i = 0; i < 60; i++) {
			send('pointermove', 12 + i / 60, 4);
			if (i === 30) await wait(650);
		}
		await tick();
		expect(emitted.filter((event) => event.type === 'denied')).toHaveLength(1);
		expect(document.querySelectorAll('.denied-puff')).toHaveLength(1);
		expect(
			(document.querySelector('.denied-puff') as SVGElement).style
				.getPropertyValue('--puff')
				.trim()
		).toBe('1');
		send('pointerup', 13, 4);
		await wait(650);
		send('pointerdown', 12, 4);
		send('pointerup', 12, 4);
		expect(emitted.filter((event) => event.type === 'denied')).toHaveLength(2);
	});
	it('clear card explains all drops, focuses Next, Enter starts the next room', async () => {
		await setup();
		expect(document.querySelector('[data-room-supply]')?.textContent).toContain(
			'Thrifty needs 10% room-total'
		);
		clearNow = true;
		await vi.waitFor(
			() => expect(document.querySelector('.clear-card')).not.toBeNull(),
			{ timeout: 4000 }
		);
		await wait(1000);
		expect(document.querySelectorAll('.score-mark')).toHaveLength(3);
		for (const label of ['Revived', 'Thrifty', 'Clean'])
			expect(
				document.querySelector(`[data-mark="${label}"]`)?.textContent
			).toContain(label);
		expect(document.body.textContent).toContain('Saved 27% (needs 10%)');
		expect(document.body.textContent).toContain('Nothing spoiled');
		expect(document.body.textContent).toContain('New best');
		expect(document.querySelectorAll('.score-mark.earned')).toHaveLength(3);
		expect(
			document.querySelector(
				'.hints, .tools, .gesture-note, .room-footer, .stuck-card'
			)
		).toBeNull();
		expect(document.activeElement?.textContent).toBe('Next room →');
		await shot('clear-3-of-3');
		clearNow = false;
		await userEvent.keyboard('{Enter}');
		await vi.waitFor(() =>
			expect(document.querySelector('.room-heading h1')?.textContent).toBe(
				'Breath'
			)
		);
		expect(document.querySelector('[data-onboarding="puff"]')).not.toBeNull();
		await shot('breath-puff-cue');
		const send = pointer();
		send('pointerdown', 24, 12);
		send('pointerup', 24, 12);
		await vi.waitFor(() =>
			expect(document.querySelector('[data-onboarding="puff"]')).toBeNull()
		);
	});
	it('Replay restarts in one press; Greenhouse highlights the next playable room', async () => {
		await setup();
		fixtureThrifty = false;
		clearNow = true;
		await vi.waitFor(
			() => expect(document.querySelector('.clear-card')).not.toBeNull(),
			{ timeout: 4000 }
		);
		await wait(1000);
		expect(document.querySelectorAll('.score-mark.earned')).toHaveLength(2);
		expect(document.body.textContent).toContain('Saved 5% (needs 10%)');
		await shot('clear-2-of-3');
		clearNow = false;
		await page.getByRole('button', { name: 'Replay', exact: true }).click();
		expect(document.querySelector('.clear-card')).toBeNull();
		expect(document.querySelector('.room-heading h1')?.textContent).toBe(
			'First Rain'
		);
		clearNow = true;
		await page.getByRole('button', { name: 'Greenhouse', exact: true }).click();
		expect(document.querySelector('.room-pane.next')?.textContent).toContain(
			'Breath'
		);
		await shot('map-next-room');
	});
	it('contextual pour cue dismisses on successful pour, persists; hand-only rooms have no dock', async () => {
		await setup();
		expect(document.querySelector('.tools, .gesture-note')).toBeNull();
		expect(document.querySelector('[data-onboarding="pour"]')).not.toBeNull();
		await shot('first-rain-cue');
		const send = pointer();
		send('pointerdown', 20, 4);
		send('pointerup', 20, 4);
		await vi.waitFor(() =>
			expect(document.querySelector('[data-onboarding="pour"]')).toBeNull()
		);
		expect(localStorage.getItem('verdigris-onboarding-v2')).toContain(
			'"pour":true'
		);
		await shot('room-decluttered');
		await page.getByRole('button', { name: 'Pause garden' }).click();
		await page.getByText('Controls & goals', { exact: true }).click();
		expect(document.querySelector('dialog')?.textContent).not.toContain(
			'2 wax'
		);
		expect(document.querySelector('dialog')?.textContent).not.toContain(
			'3 trowel'
		);
		await shot('pause');
	});
	it('portrait remains readable without horizontal overflow', async () => {
		await setup({ realLevels: true });
		await (
			commands as unknown as {
				setViewport(size: { width: number; height: number }): Promise<void>;
			}
		).setViewport({ width: 430, height: 884 });
		await page.viewport(390, 844);
		await wait(100);
		expect(document.documentElement.scrollWidth).toBeLessThanOrEqual(390);
		for (const el of document.querySelectorAll(
			'.room-actions button, .spring-hit, .mechanism, .round'
		)) {
			const r = el.getBoundingClientRect();
			expect(r.width).toBeGreaterThanOrEqual(44);
			expect(r.height).toBeGreaterThanOrEqual(44);
		}
		for (const el of document.querySelectorAll(
			'.room-actions button, .portrait-goals, .room-supply'
		))
			expect(parseFloat(getComputedStyle(el).fontSize)).toBeGreaterThanOrEqual(
				11
			);
		expect(
			document.querySelector('.room-actions')!.getBoundingClientRect().bottom
		).toBeGreaterThan(790);
		await shot('portrait-390x844');
		clearNow = true;
		await vi.waitFor(
			() => expect(document.querySelector('.clear-card')).not.toBeNull(),
			{ timeout: 4000 }
		);
		await wait(800);
		const card = document.querySelector('.clear-card')!.getBoundingClientRect();
		expect(card.left).toBeGreaterThanOrEqual(0);
		expect(card.right).toBeLessThanOrEqual(390);
		await shot('portrait-clear');
	});
	it('final geometry evidence: First Rain and Breath cues, legible well and goals', async () => {
		await setup({ realLevels: true });
		expect(document.querySelector('[data-room-supply]')?.textContent).toContain(
			'Thrifty needs 18% room-total'
		);
		await shot('first-rain-real-cue');
		const send = pointer();
		send('pointerdown', 20.5, 4.5);
		send('pointerup', 20.5, 4.5);
		await wait(100);
		await shot('room-real-decluttered');
		clearNow = true;
		await page
			.getByRole('button', { name: 'Next room →', exact: true })
			.click();
		clearNow = false;
		expect(document.querySelector('[data-room-supply]')?.textContent).toContain(
			'Thrifty needs 20% room-total'
		);
		await shot('breath-real-stir-cue');
		for (let i = 1; i < REAL_LEVELS.findIndex(l => l.id === 'two-springs'); i++) {
			clearNow = true;
			await page.getByRole('button', { name: 'Next room →', exact: true }).click();
			clearNow = false;
			await wait(80);
		}
		await shot('two-springs-real-goals');
		expect(
			document.querySelectorAll('[data-plaque] .amount-label')
		).toHaveLength(2);
		expect(document.querySelector('[data-onboarding="wax"]')).toBeNull();
	});
	it('captures real vent states, puff transport and reservoir gauge', async () => {
		await setup({ realLevels: true, realRoom: true, realAir: true, progress: { version: 2, cleared: { 'first-rain': 3 }, finale: false } });
		await shot('vent-off');
		await page.getByRole('button', { name: /Vent glass draft/ }).click();
		await vi.waitFor(() => expect(document.querySelector('[data-vent="glass-draft"]')?.getAttribute('data-heading')).toContain('0 degrees'));
		await shot('vent-on');
		const send = pointer(); send('pointerdown', 13, 8); send('pointerup', 13, 8);
		await wait(600);
		await shot('breath-puff');
		await unmount(app!); target.remove();
		await setup({ realLevels: true, realRoom: true, realAir: true, progress: { version: 2, cleared: beforeTwoSprings, finale: false } });
		await page.getByRole('button', { name: /Vent spring draft/ }).click();
		await wait(2100);
		const pour = pointer(); pour('pointerdown', 11, 4); await wait(2600); pour('pointerup', 11, 4); await wait(2500);
		expect(latest.gauges['green-level'].units).toBeGreaterThan(1);
		expect(document.querySelector('[data-gauge="green-level"]')).not.toBeNull();
		await shot('two-springs-gauge');
	});
	it('spring press pours, clamps the emitter, ignores second fingers, release stops', async () => {
		await setup();
		const send = pointer();
		send('pointerdown', 20.5, 4.5);
		await vi.waitFor(() => expect(latest.pouring?.spring).toBe('dew'));
		send('pointermove', 40, 15, 2);
		expect(actions.filter((a) => a.type === 'stir')).toHaveLength(0);
		send('pointermove', 40, 15);
		await vi.waitFor(() => expect(latest.pouring?.at).toEqual({ x: 22, y: 6 }));
		expect(
			document.querySelector('[data-emitter]')?.getAttribute('transform')
		).toBe('translate(22 6)');
		expect(actions.some((a) => a.type === 'stir')).toBe(false);
		send('pointerup', 40, 15);
		await wait(30);
		expect(latest.pouring).toBeNull();
	});
	it('air gesture crossing a spring never starts a pour; cancellation, pause, blur, restart stop it', async () => {
		await setup();
		const send = pointer();
		send('pointerdown', 24, 12);
		send('pointermove', 20, 4);
		send('pointerup', 20, 4);
		expect(actions.some((a) => a.type === 'pour' && a.spring)).toBe(false);
		for (const end of ['pointercancel', 'lostpointercapture']) {
			send('pointerdown', 20, 4);
			send(end, 20, 4);
			await wait(30);
			expect(latest.pouring).toBeNull();
		}
		send('pointerdown', 20, 4);
		window.dispatchEvent(new Event('blur'));
		await wait(30);
		expect(latest.pouring).toBeNull();
		send('pointerdown', 20, 4);
		await page.getByRole('button', { name: 'Pause garden' }).click();
		await vi.waitFor(() => expect(latest.pouring).toBeNull());
		await page
			.getByRole('button', { name: 'Return to the garden', exact: true })
			.click();
		send('pointerdown', 20, 4);
		await userEvent.keyboard('rr');
		await wait(50);
		expect(latest.pouring).toBeNull();
	});
	it('focused spring aims at the usable end; Enter down/up pours; held arrows stir', async () => {
		await setup();
		const spring = document.querySelector('[data-spring]') as HTMLButtonElement;
		spring.focus();
		spring.dispatchEvent(
			new KeyboardEvent('keydown', { key: 'Enter', bubbles: true })
		);
		await wait(50);
		expect(latest.pouring?.at.x).toBeCloseTo(20.6);
		spring.dispatchEvent(
			new KeyboardEvent('keydown', { key: 'ArrowRight', bubbles: true })
		);
		expect(actions.some((a) => a.type === 'stir')).toBe(false);
		window.dispatchEvent(
			new KeyboardEvent('keyup', { key: 'Enter', bubbles: true })
		);
		await wait(30);
		expect(latest.pouring).toBeNull();
	});
	it('recipe plaque retains glyphs, gauge and stripe; no upper amount band or overfill spoil', async () => {
		await setup();
		expect(document.querySelectorAll('[data-recipe-species]')).toHaveLength(1);
		expect(document.querySelector('.mixture-gauge')).not.toBeNull();
		expect(document.querySelector('.target-stripe')).not.toBeNull();
		const plaqueBox = document
			.querySelector('[data-plaque]')!
			.getBoundingClientRect();
		const stripeBox = document
			.querySelector('.target-stripe')!
			.getBoundingClientRect();
		expect(stripeBox.left).toBeLessThan(plaqueBox.left);
		expect(stripeBox.right).toBeGreaterThan(plaqueBox.right);
		expect(
			document.querySelector('[data-overfilled], .recipe-band')
		).toBeNull();
	});
	it('all campaign rooms have reachable map entries, grouped by act with locked prerequisites', async () => {
		await setup({ realLevels: true });
		await page.getByRole('button', { name: 'Return to greenhouse map' }).click();
		expect(document.querySelectorAll('button.room-pane')).toHaveLength(REAL_LEVELS.length);
		expect(document.querySelectorAll('.wing')).toHaveLength(new Set(REAL_LEVELS.map(l => l.act)).size);
		for (const [i, level] of REAL_LEVELS.entries()) {
			const pane = document.querySelectorAll<HTMLButtonElement>('button.room-pane')[i];
			expect(pane.textContent).toContain(level.name);
			expect(pane.disabled).toBe(i > 0);
			if (i) expect(pane.textContent).toContain(`Clear ${REAL_LEVELS[i - 1].name} to wake`);
			expect(pane.getBoundingClientRect().height).toBeGreaterThanOrEqual(44);
		}
		await shot('map-six-rooms', '/tmp/verdigris-v3/fixes/map-six-rooms.png');
		await unmount(app!); app = undefined;
		const onselect = vi.fn();
		app = mount(Map, { target: target!, props: { levels: REAL_LEVELS, progress: { version: 2, cleared: {}, finale: false }, available: REAL_LEVELS.length, onselect, onback: () => {} } });
		await tick();
		for (const [i, level] of REAL_LEVELS.entries()) {
			await page.getByRole('button', { name: `${level.name}, enter room`, exact: true }).click();
			expect(onselect).toHaveBeenLastCalledWith(i);
		}
	});
	it('refresh during final payoff preserves the clear and still opens the first dawn', async () => {
		await setup({ realLevels: true, progress: { version: 2, cleared: Object.fromEntries(REAL_LEVELS.slice(0, -1).map(l => [l.id, 3])), finale: false } });
		vi.mocked(saveProgress).mockClear(); clearNow = true;
		await vi.waitFor(() => expect(document.querySelector('[data-screen="payoff"]')).not.toBeNull());
		const saved = JSON.parse(JSON.stringify(vi.mocked(saveProgress).mock.calls.at(-1)![0])) as Progress;
		expect(saved.cleared['bring-it-back']).toBe(3); expect(saved.finale).toBe(false);
		await unmount(app!); app = undefined; clearNow = false;
		app = mount(Page, { target: target!, props: { levels: REAL_LEVELS, fixtureProgress: saved } }); await tick();
		await page.getByRole('button', { name: /Continue the garden/ }).click();
		expect(document.querySelector('[data-screen="interlude"]')).not.toBeNull();
		expect(vi.mocked(saveProgress).mock.calls.at(-1)![0].finale).toBe(true);
	});
	it('Bring It Back is the final campaign room and triggers the dawn', async () => {
		expect(REAL_LEVELS.at(-1)?.id).toBe('bring-it-back');
		await setup({
			realLevels: true,
			progress: {
				version: 2,
				cleared: Object.fromEntries(
					REAL_LEVELS.slice(0, -1).map((level) => [level.id, 3])
				),
				finale: false,
			},
		});
		expect(document.body.textContent).toContain('Bring It Back');
		expect(document.querySelector('[data-room-supply]')?.textContent).toContain('Water saved: 100%');
		expect(document.querySelector('[data-gauge="source-head"]')).not.toBeNull();
		expect(document.querySelectorAll('[data-control]')).toHaveLength(2);
		expect(document.querySelectorAll('[data-drain]')).toHaveLength(2);
		fixtureView = { wasted: 8 };
		await vi.waitFor(() => expect(document.querySelector('[data-room-supply]')?.textContent).toContain('Water saved: 80%'));
		await shot('bring-it-back-board');
		clearNow = true;
		await vi.waitFor(() =>
			expect(document.querySelector('[data-screen="payoff"]')).not.toBeNull()
		);
		await page.getByRole('button', { name: 'Wake the first wing →' }).click();
		expect(document.querySelector('[data-screen="interlude"]')).not.toBeNull();
	});
	for (const exit of ['Replay', 'Greenhouse'])
		it(`last clear cannot bypass the first dawn through ${exit}`, async () => {
			await setup({
				progress: {
					version: 2,
					cleared: beforeTwoSprings,
					finale: false,
				},
			});
			clearNow = true;
			await page.getByRole('button', { name: exit, exact: true }).click();
			expect(
				document.querySelector('[data-screen="interlude"]')
			).not.toBeNull();
		});
	it('last room clear opens a player-paced first-wing interlude, then map and sandbox entry', async () => {
		await setup({
			progress: {
				version: 2,
				cleared: beforeTwoSprings,
				finale: false,
			},
		});
		expect(document.querySelector('a[href="https://delos.sloprefinery.ai/"]')).toBeNull();
		fixtureStatus = 'ready';
		await wait(120);
		await shot('ready');
		clearNow = true;
		await vi.waitFor(() =>
			expect(document.querySelector('[data-screen="payoff"]')).not.toBeNull()
		);
		await wait(500);
		await shot('clear');
		await page.getByRole('button', { name: 'Wake the first wing →' }).click();
		expect(document.querySelector('[data-screen="interlude"]')).not.toBeNull();
		expect(document.body.textContent).toContain('The first wing remembers.');
		const nextGame = page.getByRole('link', { name: 'Play the next game', exact: true });
		const link = nextGame.element() as HTMLAnchorElement;
		expect(link.href).toBe('https://delos.sloprefinery.ai/');
		expect(link.classList.contains('primary')).toBe(true);
		await vi.waitFor(() => expect(document.activeElement).toBe(link));
		const explore = page.getByRole('button', { name: 'Stay and explore the greenhouse', exact: true });
		expect(explore.element().classList.contains('primary')).toBe(false);
		await wait(7000);
		expect(document.querySelector('[data-screen="interlude"]')).not.toBeNull();
		for (const [width, height] of [[1280, 900], [1280, 720], [375, 667]]) {
			await page.viewport(width, height);
			const rect = link.getBoundingClientRect();
			expect(rect.top).toBeGreaterThanOrEqual(0);
			expect(rect.bottom).toBeLessThanOrEqual(innerHeight);
			expect(rect.left).toBeGreaterThanOrEqual(0);
			expect(rect.right).toBeLessThanOrEqual(innerWidth);
			expect(rect.height).toBeGreaterThanOrEqual(80);
			expect(rect.height).toBeGreaterThan(explore.element().getBoundingClientRect().height);
			expect(Number.parseFloat(getComputedStyle(link).fontSize)).toBeGreaterThan(Number.parseFloat(getComputedStyle(explore.element()).fontSize));
			await shot(`next-game-${width}x${height}`);
		}
		await page.viewport(1280, 900);
		await userEvent.keyboard('{Tab}');
		expect(document.activeElement).toBe(explore.element());
		await explore.click();
		expect(document.querySelector('[data-screen="map"]')).not.toBeNull();
		expect(document.body.textContent).toContain('Wander the garden');
		expect((page.getByRole('link', { name: 'Play the next game', exact: true }).element() as HTMLAnchorElement).href).toBe('https://delos.sloprefinery.ai/');
	});
	it('presentation evidence: physical rim overflow never gets an overfill-spoil glyph', async () => {
		fillFixture = true;
		await setup();
		const send = pointer();
		send('pointerdown', 20.5, 4.5);
		await wait(120);
		await shot('first-press');
		send('pointerup', 20.5, 4.5);
		fixtureStatus = 'filling';
		await wait(300);
		await shot('overflow-spill');
		fixtureStatus = 'spoiled';
		await wait(100);
		await shot('spoil');
		expect(
			document.querySelector('[data-forbidden-species="1"]')
		).not.toBeNull();
		expect(document.querySelector('[data-overfilled]')).toBeNull();
	});
	it('real-air evidence: touchable source, subtle swirling mist, clamped pouring cursor', async () => {
		await setup({ realAir: true, realRoom: true });
		const send = pointer();
		send('pointermove', 20.5, 4.5);
		await wait(150);
		await shot('spring-hover');
		send('pointerdown', 12, 12);
		for (let i = 0; i < 36; i++) {
			const t = i / 35;
			send('pointermove', 12 + t * 16, 12 + Math.sin(t * Math.PI * 2) * 3);
			await wait(18);
		}
		send('pointerup', 28, 12);
		await wait(250);
		await shot('stir-mist');
		send('pointerdown', 20.5, 4.5);
		await wait(700);
		await shot('pouring');
		send('pointerup', 20.5, 4.5);
		expect(document.querySelector('dialog[open]')).toBeNull();
	});
});
