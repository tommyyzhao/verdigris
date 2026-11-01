import { describe, expect, it } from 'vitest';
import { commands } from 'vitest/browser';
import { LiquidEngine } from 'svelte-fluid/experimental';
import { LEVELS, sweep } from './levels.js';
import { createRoom } from './model.js';
import { createAirLayer } from './air.js';
import { replayActions } from './runtime.js';
import { READBACK_LAG, type SensorFrame } from './types.js';
import type { Level, RoomView } from './types.js';

const output = commands as unknown as {
	writeBenchJson(path: string, json: string): Promise<void>;
	writeBenchBase64(path: string, base64: string): Promise<void>;
};
const OUT = '/tmp/verdigris-v3/v3-verbs/solutions';
const yieldGpu = () => new Promise<void>((resolve) => setTimeout(resolve, 0));
type Mode =
	| 'solution'
	| 'perturbed'
	| 'idle'
	| 'fixed-pour'
	| 'no-stir'
	| 'random-stir'
	| 'dump'
	| 'overflow';
interface ReplayOptions {
	seed?: number;
	position?: number;
	spring?: string;
	timeline?: Level['solution'];
	cap?: number;
}
const seeded = (seed: number) => () => {
	seed = (1664525 * seed + 1013904223) >>> 0;
	return seed / 4294967296;
};
function perturb(level: Level, seed: number): Level['solution'] {
	const rand = seeded(seed);
	const point = (p: { x: number; y: number }) => ({
		x: p.x + rand() - 0.5,
		y: p.y + rand() - 0.5,
	});
	return level.solution
		.map(({ tick, action }) => ({
			tick: Math.max(0, tick + Math.floor(rand() * 13) - 6),
			action:
				action.type === 'stir'
					? { ...action, from: point(action.from), to: point(action.to) }
					: action.type === 'pour' && action.at
					? { ...action, at: point(action.at) }
					: action,
		}))
		.sort((a, b) => a.tick - b.tick);
}
interface Result {
	id: string;
	mode: Mode;
	options: ReplayOptions;
	overflow?: {
		tick: number;
		greenUnits: number;
		sapDew: number;
		sapSap: number;
		lipCounts: readonly number[];
	};
	cleared: boolean;
	tick: number;
	observed: number;
	maxSensorLag: number;
	unthrottledLagBaseline: readonly [number, number];
	dewdrops: number;
	stuck: boolean;
	wasted: number;
	urns: RoomView['urns'];
	seeds: unknown;
	brambles: unknown;
	springs: unknown;
	maxUrns: Record<string, number>;
	mastery: {
		reserve: number;
		reserveRequired: number;
		reserveMargin: number;
		inkUsed: number;
		inkMaximum: number | null;
		inkMargin: number | null;
		everSpoiled: boolean;
	};
}
const results: Result[] = [];

async function run(
	level: Level,
	mode: Mode,
	options: ReplayOptions = {}
): Promise<Result> {
	const canvas = document.createElement('canvas');
	canvas.width = 1280;
	canvas.height = 800;
	canvas.getContext('webgl2', {
		alpha: true,
		premultipliedAlpha: true,
		antialias: false,
		depth: false,
		stencil: false,
		preserveDrawingBuffer: true,
	});
	const sim = new LiquidEngine({
		canvas,
		seed: options.seed ?? 1,
		palette: ['#6ec6ff', '#f2b134', '#e8608a'],
	});
	const airCanvas = document.createElement('canvas');
	airCanvas.width = 960;
	airCanvas.height = 600;
	const air = createAirLayer(airCanvas, level);
	const room = createRoom(level);
	const last = level.solution.at(-1)?.tick ?? 0;
	const cap = options.cap ?? Math.max(1800, last + 900);
	const maxUrns: Record<string, number> = {};
	let observed = 0;
	let maxSensorLag = 0;
	let mid = false;
	let everStuck = false;
	let spill: Result['overflow'];
	const lipCounts = [0, 0, 0];
	let spillShot = false,
		spoilShot = false;
	async function shot(tag: string) {
		sim.render({ time: room.view().tick / 60 });
		const liquid = document.createElement('canvas');
		liquid.width = 1280;
		liquid.height = 800;
		const ctx = liquid.getContext('2d')!;
		ctx.fillStyle = '#122b2b';
		ctx.fillRect(0, 0, 1280, 800);
		const terrain = room.view().terrain;
		for (let y = 0; y < 120; y++)
			for (let x = 0; x < 192; x++) {
				const kind = terrain[y * 192 + x];
				if (!kind) continue;
				ctx.fillStyle = [
					'transparent',
					'#657677',
					'#71563c',
					'#d9cda4',
					'#ba8e54',
					'#6e995d',
					'#967346',
				][kind];
				ctx.fillRect(
					(x * 1280) / 192,
					(y * 800) / 120,
					1280 / 192 + 0.1,
					800 / 120 + 0.1
				);
			}
		ctx.drawImage(canvas, 0, 0);
		ctx.font = '16px sans-serif';
		for (const u of level.urns) {
			ctx.strokeStyle = '#ffffff88';
			ctx.strokeRect(
				(u.box.x * 1280) / 48,
				(u.box.y * 800) / 30,
				(u.box.w * 1280) / 48,
				(u.box.h * 800) / 30
			);
			ctx.fillStyle = 'white';
			ctx.fillText(
				`${u.id}: ${room
					.view()
					.urns.find((v) => v.id === u.id)!
					.units.toFixed(1)}`,
				(u.box.x * 1280) / 48,
				(u.box.y * 800) / 30 - 6
			);
		}
		await output.writeBenchBase64(
			`${OUT}/${level.id}-${tag}.png`,
			liquid.toDataURL('image/png').split(',')[1]
		);
	}
	const frames = new Map<number, SensorFrame>();
	function observe(target = -1) {
		for (const frame of sim.pollSensors()) {
			observed = frame.tick;
			frames.set(frame.tick, frame);
		}
		for (const [tick, frame] of frames) {
			if (tick !== target) continue;
			frames.delete(tick);
			for (let species = 0; species < 3; species++)
				lipCounts[species] = Math.max(
					lipCounts[species],
					frame.sensors['spill-lip']?.counts[species] ?? 0
				);
			maxSensorLag = Math.max(maxSensorLag, room.view().tick - frame.tick);
			room.observe(frame);
			everStuck ||= room.view().stuck;
			for (const u of room.view().urns)
				maxUrns[u.id] = Math.max(maxUrns[u.id] ?? 0, u.units);
		}
	}
	try {
		const scene = room.scene();
		if (mode === 'overflow')
			scene.sensors = [
				...scene.sensors,
				{ id: 'spill-lip', rect: { x: 104, y: 68, w: 5, h: 4 } },
			];
		sim.load(scene);
		air.syncTerrain(room.view().terrain, room.view().terrainRevision);
		const rand = seeded(options.seed ?? 71429);
		const timeline =
			options.timeline ??
			(mode === 'no-stir'
				? level.solution.filter((e) => e.action.type !== 'stir')
				: mode === 'perturbed'
				? perturb(level, options.seed ?? 1)
				: level.solution);
		for (let tick = 0; tick < cap; tick++) {
			const target = tick + 1 - READBACK_LAG;
			for (let tries = 0; ; tries++) {
				observe();
				if (air.ready(tick + 1) && (target <= 0 || frames.has(target))) break;
				if (tries >= 1000)
					throw new Error(`Fixed-lag fence did not complete at ${target}`);
				await yieldGpu();
			}
			observe(target);
			if (room.view().cleared) break;
			if (['solution', 'perturbed', 'no-stir', 'overflow'].includes(mode))
				replayActions(room, air, timeline, tick);
			if (mode === 'fixed-pour' || mode === 'random-stir' || mode === 'dump') {
				const spring = level.springs.find(
					(s) =>
						(!options.spring || s.id === options.spring) &&
						room.view().springs[s.id] > 0
				);
				if (spring)
					room.act({
						type: 'pour',
						spring: spring.id,
						at: {
							x: spring.zone.x + spring.zone.w * (options.position ?? 0.9),
							y: spring.zone.y + spring.zone.h / 2,
						},
					});
				if (mode === 'random-stir' && tick % 6 === 0)
					air.stir(
						{ x: rand() * 48, y: rand() * 20 },
						{ x: rand() * 48, y: rand() * 20 }
					);
			}
			if (mode === 'overflow') {
				const v = room.view();
				const sap = v.urns.find((u) => u.id === 'sap-urn')!;
				if (!spill && sap.counts[0] > 8)
					spill = {
						tick,
						greenUnits: v.urns[0].units,
						sapDew: sap.counts[0],
						sapSap: sap.counts[1],
						lipCounts: [...lipCounts],
					};
				if (spill && !spillShot) {
					await shot('overflow-spill');
					spillShot = true;
				}
				if (sap.status === 'spoiled' && !spoilShot) {
					await shot('spoil');
					spoilShot = true;
					break;
				}
			}
			const planned = room.planTick();
			air.syncTerrain(room.view().terrain, room.view().terrainRevision);
			air.step(planned.tick, room.view().vents);
			sim.step({ ...planned, wind: air.wind(planned.tick) });
			observe();
			if (tick % 2 === 1) {
				await yieldGpu();
				observe();
				// Bound GPU queue depth rather than changing the simulated clock to wall time.
				for (
					let wait = 0;
					observed < room.view().tick - 1 && wait < 1000;
					wait++
				) {
					await yieldGpu();
					observe();
				}
				if (observed < room.view().tick - 1)
					throw new Error('GPU sensor fence did not complete');
			}
			if (mode === 'solution' && !mid && tick >= last / 2) {
				await shot('mid');
				mid = true;
			}
			if (room.view().cleared) break;
		}
		for (let wait = 0; observed < room.view().tick && wait < 1000; wait++) {
			await yieldGpu();
			observe();
		}
		expect(observed, 'final sensor fence').toBe(room.view().tick);
		expect(maxSensorLag, 'bounded GPU queue').toBeLessThanOrEqual(10);
		if (
			mode === 'solution' ||
			mode === 'no-stir' ||
			(mode === 'fixed-pour' && options.position === 0.1)
		)
			await shot(room.view().cleared ? 'clear' : 'failed');
		const v = room.view();
		const reserve = room.mastery().reserve;
		const inkMaximum = level.ink > 0 ? level.mastery.ink ?? level.ink : null;
		return {
			id: level.id,
			mode,
			options,
			overflow: spill,
			cleared: v.cleared,
			tick: v.tick,
			observed,
			maxSensorLag,
			unthrottledLagBaseline: [20, 23],
			dewdrops: room.dewdrops(),
			stuck: everStuck,
			wasted: v.wasted,
			urns: v.urns,
			seeds: v.seeds,
			brambles: v.brambles,
			springs: v.springs,
			maxUrns,
			mastery: {
				reserve,
				reserveRequired: level.mastery.reserve,
				reserveMargin: reserve - level.mastery.reserve,
				inkUsed: v.inkUsed,
				inkMaximum,
				inkMargin: inkMaximum === null ? null : inkMaximum - v.inkUsed,
				everSpoiled: v.everSpoiled,
			},
		};
	} finally {
		air.dispose();
		sim.dispose();
		airCanvas
			.getContext('webgl2')
			?.getExtension('WEBGL_lose_context')
			?.loseContext();
		canvas
			.getContext('webgl2')
			?.getExtension('WEBGL_lose_context')
			?.loseContext();
	}
}

async function record(result: Result) {
	results.push(result);
	console.info(JSON.stringify(result));
	await output.writeBenchJson(
		`${OUT}/results.json`,
		JSON.stringify(results, null, 2)
	);
}
describe.sequential('real-air liquid solutions', () => {
	for (const level of LEVELS) {
		it(`real-liquid ${level.id} canonical`, async () => {
			const result = await run(level, 'solution');
			await record(result);
			expect(result.cleared, JSON.stringify(result)).toBe(true);
			expect(result.dewdrops).toBe(3);
			expect(result.stuck).toBe(false);
			expect(result.mastery.everSpoiled).toBe(false);
			expect(result.mastery.reserveMargin).toBeGreaterThan(
				level.id === 'first-rain' ? 0.06 : level.id === 'two-springs' ? 0.05 : 0
			);
		}, 1_800_000);
		if (level.id === 'first-rain')
			for (const edge of [0, 1])
				it(`real-liquid first-rain zone edge ${edge}`, async () => {
					const spring = level.springs[0];
					const timeline = level.solution.map((entry) => ({
						...entry,
						action:
							entry.action.type === 'pour' && entry.action.spring
								? {
										...entry.action,
										at: {
											x: spring.zone.x + edge * spring.zone.w,
											y: spring.zone.y + spring.zone.h / 2,
										},
								  }
								: entry.action,
					}));
					const result = await run(level, 'solution', { timeline });
					await record(result);
					expect(result.cleared, JSON.stringify(result)).toBe(true);
					expect(result.dewdrops).toBe(3);
				}, 1800000);
		for (const seed of [71, 429, 2026])
			it(`real-liquid ${level.id} jitter ${seed}`, async () => {
				const result = await run(level, 'perturbed', { seed });
				await record(result);
				expect(result.cleared, JSON.stringify(result)).toBe(true);
			}, 1_800_000);
		it(`real-liquid ${level.id} idle`, async () => {
			const result = await run(level, 'idle', { cap: 1200 });
			await record(result);
			expect(result.cleared).toBe(false);
		}, 1800000);
		for (const position of [0.1, 0.3, 0.5, 0.7, 0.9]) {
			it(`real-liquid ${level.id} fixed ${position}`, async () => {
				const result = await run(level, 'fixed-pour', { position, cap: 2400 });
				await record(result);
				// First Rain's whole visible pour zone is now intentionally usable.
				if (level.id === 'first-rain') {
					expect(result.cleared, JSON.stringify(result)).toBe(true);
					expect(result.dewdrops).toBeLessThan(3);
				} else expect(result.cleared, JSON.stringify(result)).toBe(false);
			}, 1800000);
		}
		for (const seed of [194, 719])
			it(`real-liquid ${level.id} random ${seed}`, async () => {
				const result = await run(level, 'random-stir', {
					seed,
					position: 0.9,
					cap: 2400,
				});
				await record(result);
				if (level.id !== 'first-rain')
					expect(result.cleared, JSON.stringify(result)).toBe(false);
			}, 1800000);
		if (level.id !== 'first-rain')
			it(`real-liquid ${level.id} no-stir`, async () => {
				const result = await run(level, 'no-stir');
				await record(result);
				expect(result.cleared, JSON.stringify(result)).toBe(true);
				expect(result.dewdrops).toBe(3);
			}, 1800000);
		if (level.id === 'two-springs') {
			it('real-liquid two-springs overflow', async () => {
				const timeline: Level['solution'] = [
					...Array.from({ length: 6 }, (_, i) => {
						const t = i * 210;
						return [
							...sweep(t, { x: 5, y: 8 }, { x: 21, y: 8 }, 16),
							{
								tick: t + 20,
								action: {
									type: 'pour' as const,
									spring: 'dew',
									at: { x: 11, y: 4 },
								},
							},
							{ tick: t + 55, action: { type: 'pour' as const, spring: null } },
							{
								tick: t + 110,
								action: {
									type: 'pour' as const,
									spring: 'sap',
									at: { x: 30.5, y: 4 },
								},
							},
							{
								tick: t + 165,
								action: { type: 'pour' as const, spring: null },
							},
						];
					}).flat(),
				];
				const result = await run(level, 'overflow', { timeline, cap: 3000 });
				await record(result);
				expect(result.cleared).toBe(false);
				expect(result.overflow, JSON.stringify(result)).toBeDefined();
				expect(result.overflow!.greenUnits).toBeGreaterThan(24);
				expect(result.overflow!.lipCounts[0]).toBeGreaterThan(0);
				expect(result.overflow!.lipCounts[1]).toBeGreaterThan(0);
				expect(result.overflow!.sapDew).toBeGreaterThan(8);
				expect(result.urns.find((u) => u.id === 'sap-urn')?.status).toBe(
					'spoiled'
				);
			}, 1800000);
			for (const spring of ['dew', 'sap'])
				it(`real-liquid ${level.id} dump ${spring}`, async () => {
					const result = await run(level, 'dump', { spring, cap: 2400 });
					await record(result);
					expect(result.cleared).toBe(false);
				}, 1800000);
		}
	}
});
