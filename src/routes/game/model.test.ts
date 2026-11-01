import { describe, expect, it } from 'vitest';
import { AIR, GATE, INK, LOAM, ROOT, STONE, VINE } from 'svelte-fluid/experimental';
import { createRoom } from './model.js';
import { LEVELS } from './levels.js';
import {
	HOLD_SECONDS,
	MARKERS_PER_UNIT,
	SCALE,
	TICK_HZ,
	type Counts,
	type Level,
	type RoomModel,
	type SensorFrame
} from './types.js';

const W = 48 * SCALE;
const H = 30 * SCALE;
const cell = (x: number, y: number) => Math.floor(y * SCALE) * W + Math.floor(x * SCALE);
const box = (x: number, y: number, w: number, h: number) => ({ x, y, w, h });
function fixture(patch: Partial<Level> = {}): Level {
	return {
		id: 'test',
		name: 'Test',
		act: 1,
		terrain: Array.from({ length: 30 }, (_, y) =>
			y === 20 ? '  # % &'.padEnd(48) : ' '.repeat(48)
		),
		springs: [
			{
				id: 'dew',
				species: 0,
				well: 100,
				zone: box(6, 3, 6, 3),
				rate: 7,
				style: 'cloud'
			}
		],
		vents: [],
		planks: [],
		gates: [
			{
				id: 'plug',
				style: 'plug',
				box: box(22, 20, 2, 1),
				retract: 'left',
				open: false,
				driver: { kind: 'player' }
			}
		],
		urns: [
			{
				id: 'urn',
				box: box(20, 12, 8, 8),
				recipe: { amount: 10, mix: [1, 0, 0] },
				plug: 'plug',
				powers: ['machine']
			}
		],
		seeds: [],
		brambles: [],
		wheels: [],
		drains: [{ id: 'waste', kind: 'waste', box: box(40, 26, 4, 1) }],
		machines: [{ id: 'machine', kind: 'lift', box: box(30, 15, 5, 8) }],
		ink: 30,
		dig: true,
		pools: [],
		mastery: { reserve: 0.5, ink: 15 },
		hints: ['', '', ''],
		solution: [],
		...patch
	};
}
function frame(
	tick: number,
	units: Record<string, Counts> = {},
	patch: Partial<SensorFrame> = {}
): SensorFrame {
	return {
		tick,
		epoch: 1,
		sensors: Object.fromEntries(
			Object.entries(units).map(([id, counts]) => [
				id,
				{
					counts: counts.map((n) => Math.round(n * MARKERS_PER_UNIT)) as unknown as Counts,
					flux: { x: 0, y: 0 }
				}
			])
		),
		drained: {},
		alive: [0, 0, 0],
		seeded: [0, 0, 0],
		emitted: [0, 0, 0],
		activity: 0,
		occupancy: new Uint8Array(W * H),
		...patch
	};
}
describe('pool reserve mastery', () => {
	it('scores spring-less rooms by pool water not lost to waste, clamps, freezes at clear, resets on restart', () => {
		const level = fixture({
			springs: [],
			pools: [{ species: 0, box: box(5, 5, 8, 5), units: 40 }],
			mastery: { reserve: 0.8 },
		});
		const room = createRoom(level);
		expect(room.mastery().reserve).toBe(1);
		room.observe(frame(1, {}, { drained: { waste: [8 * 64, 0, 0] } }));
		expect(room.mastery()).toMatchObject({ reserve: 0.8, thrifty: true });
		room.observe(frame(2, {}, { drained: { waste: [9 * 64, 0, 0] } }));
		expect(room.mastery().thrifty).toBe(false);
		room.observe(frame(3, {}, { drained: { waste: [50 * 64, 0, 0] } }));
		expect(room.mastery().reserve).toBe(0);
		expect(createRoom(level).mastery().reserve).toBe(1);
		const cleared = createRoom(level);
		for (let tick = 1; tick <= 100; tick++)
			cleared.observe(
				frame(
					tick,
					{ 'urn:urn': [10, 0, 0] },
					{ drained: { waste: [4 * 64, 0, 0] } }
				)
			);
		expect(cleared.view().cleared).toBe(true);
		cleared.observe(
			frame(101, { urn: [10, 0, 0] }, { drained: { waste: [40 * 64, 0, 0] } })
		);
		expect(cleared.mastery().reserve).toBe(0.9);
	});
	it('keeps spring-room reserve unchanged, including rooms with pools', () => {
		const room = createRoom(
			fixture({ pools: [{ species: 0, box: box(5, 5, 4, 5), units: 20 }] })
		);
		room.observe(frame(1, {}, { drained: { waste: [20 * 64, 0, 0] } }));
		expect(room.mastery().reserve).toBe(1);
		room.act({ type: 'pour', spring: 'dew', at: { x: 8, y: 4 } });
		room.planTick();
		expect(room.mastery().reserve).toBeLessThan(1);
		expect(room.mastery().reserve).toBeGreaterThan(0.99);
	});
});

describe('Aloft verbs', () => {
	it('validates switch/turn controls, denies authored vents and preserves detached views', () => {
		const base = { from: { x: 5, y: 8 }, to: { x: 5, y: 12 }, velocity: { x: 6, y: 0 } };
		const room = createRoom(fixture({ vents: [
			{ ...base, id: 'fixed' },
			{ ...base, id: 'switch', control: { kind: 'switch', on: false } },
			{ ...base, id: 'turn', control: { kind: 'turn', velocities: [{ x: 0, y: 0 }, { x: 0, y: -8 }], index: 0 } }
		] }));
		expect(room.view().vents.switch).toEqual({ x: 0, y: 0 });
		expect(room.act({ type: 'toggle', id: 'switch' })).toEqual([{ type: 'vent', id: 'switch', velocity: base.velocity, index: 1 }]);
		expect(room.act({ type: 'pose', id: 'turn', index: 1 })).toEqual([{ type: 'vent', id: 'turn', velocity: { x: 0, y: -8 }, index: 1 }]);
		for (const action of [{ type: 'toggle' as const, id: 'fixed' }, { type: 'toggle' as const, id: 'turn' }, { type: 'pose' as const, id: 'switch', index: 0 }, { type: 'pose' as const, id: 'turn', index: NaN }, { type: 'pose' as const, id: 'turn', index: 2 }]) expect(room.act(action)).toEqual([{ type: 'denied', reason: 'busy' }]);
		room.view().vents.switch.x = 999;
		expect(room.view().vents.switch).toEqual(base.velocity);
	});
	it('clamps puffs, rejects nonfinite points and silently rate-limits on the replay clock', () => {
		const room = createRoom(fixture());
		expect(room.act({ type: 'puff', at: { x: NaN, y: 1 } })).toEqual([{ type: 'denied', reason: 'busy' }]);
		expect(room.act({ type: 'puff', at: { x: -5, y: 40 } })).toEqual([{ type: 'puff', at: { x: 0, y: 30 } }]);
		for (let i = 0; i < 20; i++) { expect(room.act({ type: 'puff', at: { x: 1, y: 1 } })).toEqual([]); expect(room.planTick().emit).toEqual([]); }
		expect(room.act({ type: 'puff', at: { x: 1, y: 1 } })).toEqual([{ type: 'puff', at: { x: 1, y: 1 } }]);
	});
	it('uses conserved sensor counts for gauge units and estimated surface height', () => {
		const room = createRoom(fixture({ gauges: [{ id: 'tank', box: box(10, 10, 4, 8) }] }));
		expect(room.scene().sensors).toContainEqual({ id: 'gauge:tank', rect: { x: 40, y: 40, w: 16, h: 32 } });
		room.observe(frame(1, { 'gauge:tank': [8, 0, 0] }));
		expect(room.view().gauges.tank).toEqual({ units: 8, surface: 16 });
	});
});

describe('empty spring feedback', () => {
	it('denies once across sixty held moves, rearms only on release', () => {
		const level = fixture();
		const spring = { ...level.springs[0], well: 0 };
		const room = createRoom({ ...level, springs: [spring] });
		const wiggle = () => Array.from({ length: 60 }, (_, i) => {
			room.act({ type: 'stir', from: { x: 6, y: 3 }, to: { x: 6 + i / 60, y: 3 } });
			room.planTick();
			return room.act({ type: 'pour', spring: spring.id, at: { x: 6 + i / 60, y: 3 } });
		}).flat();
		expect(wiggle().filter(event => event.type === 'denied')).toHaveLength(1);
		expect(wiggle()).toEqual([]);
		room.act({ type: 'pour', spring: null });
		expect(wiggle().filter(event => event.type === 'denied')).toHaveLength(1);
	});
	it('locates the denial at the spring', () => {
		const level = fixture();
		const spring = { ...level.springs[0], well: 0 };
		const room = createRoom({ ...level, springs: [spring] });
		expect(room.act({ type: 'pour', spring: spring.id, at: { x: 6, y: 3 } })).toEqual([
			{ type: 'denied', reason: 'supply-empty', at: { x: 9, y: 4.5 } }
		]);
	});
});
function advance(room: RoomModel, n: number) {
	return Array.from({ length: n }, () => room.planTick());
}
const holdTicks = HOLD_SECONDS * TICK_HZ;
function sample(room: RoomModel, from: number, to: number, units: Record<string, Counts>) {
	return Array.from({ length: to - from + 1 }, (_, i) =>
		room.observe(frame(from + i, units))
	).flat();
}

describe('scene and deterministic boundary', () => {
	it('expands terrain and prefixes every sensor type; pools and drains use cells', () => {
		const room = createRoom(
			fixture({
				pools: [{ species: 1, box: box(3, 5, 2, 3), units: 2 }],
				seeds: [
					{
						id: 'seed',
						box: box(2, 10, 3, 3),
						recipe: { amount: 2, mix: [1, 1, 0] },
						vine: [box(10, 15, 2, 1)]
					}
				],
				brambles: [
					{
						id: 'thorn',
						sensor: box(30, 10, 2, 2),
						rose: 2,
						vine: [box(31, 15, 2, 1)]
					}
				],
				wheels: [
					{
						id: 'wheel',
						sensor: box(10, 10, 2, 2),
						at: { x: 11, y: 11 },
						radius: 1
					}
				],
				gates: [
					{
						id: 'weight',
						style: 'sluice',
						box: box(30, 20, 2, 2),
						retract: 'up',
						open: false,
						driver: { kind: 'weight', sensor: box(35, 10, 3, 3), units: 2 }
					}
				]
			})
		);
		const scene = room.scene();
		expect([scene.width, scene.height]).toEqual([W, H]);
		expect(scene.terrain[cell(2, 20)]).toBe(STONE);
		expect(scene.terrain[cell(4, 20)]).toBe(LOAM);
		expect(scene.terrain[cell(6, 20)]).toBe(ROOT);
		expect(scene.terrain[cell(30, 20)]).toBe(GATE);
		expect(scene.terrain[cell(31, 15)]).toBe(VINE);
		expect(scene.fills).toEqual([{ species: 1, rect: box(12, 20, 8, 12), markers: 128 }]);
		expect(scene.sensors.map((s) => s.id)).toEqual([
			'urn:urn',
			'seed:seed',
			'bramble:thorn',
			'wheel:wheel',
			'weight:weight'
		]);
		expect(scene.drains[0].rect).toEqual(box(160, 104, 16, 4));
	});

	it('copies input, scene and view arrays/records', () => {
		const level = fixture();
		const room = createRoom(level);
		level.springs[0].well = 1;
		const view = room.view();
		view.terrain.fill(99);
		(view.springs as Record<string, number>).dew = 0;
		room.scene().terrain.fill(99);
		room.level.springs[0].rate = 999;
		room.act({ type: 'pour', spring: 'dew', at: { x: 9, y: 4 } });
		expect(room.planTick().emit[0].count).toBe(7);
		room.act({ type: 'pour', spring: null });
		expect(room.view().springs.dew).toBe(100 - 7 / MARKERS_PER_UNIT);
		expect(room.view().pouring).toBeNull();
		expect(room.scene().terrain[cell(2, 20)]).toBe(STONE);
		expect(room.view().terrain[cell(2, 20)]).toBe(STONE);
	});
});

describe('pouring and poses', () => {
	it('emits exact fractional-marker totals only while held; deducts the well', () => {
		const room = createRoom(fixture());
		expect(advance(room, 60).flatMap((t) => t.emit)).toEqual([]);
		expect(room.act({ type: 'pour', spring: 'dew', at: { x: 9, y: 4 } })).toEqual([
			{ type: 'pour', spring: 'dew' }
		]);
		const ticks = advance(room, 360);
		expect(ticks.flatMap((t) => t.emit).reduce((sum, e) => sum + e.count, 0)).toBe(
			42 * MARKERS_PER_UNIT
		);
		expect(room.view().springs.dew).toBe(58);
		expect(ticks[0].emit[0]).toMatchObject({
			rect: box(34, 14, 4, 4),
			velocity: { x: 0, y: 20 }
		});
		expect(room.act({ type: 'pour', spring: null })).toEqual([{ type: 'pour', spring: null }]);
		expect(advance(room, 60).flatMap((t) => t.emit)).toEqual([]);
		expect(room.act({ type: 'pour', spring: null })).toEqual([]);
		expect(createRoom(fixture()).view().pouring).toBeNull();
	});
	it('clamps and moves the 1-LU emitter inside its zone and board; custom speed', () => {
		const room = createRoom(
			fixture({
				springs: [
					{
						id: 'dew',
						species: 0,
						zone: box(0, 0, 48, 30),
						rate: 6,
						well: 100,
						speed: 32,
						style: 'cloud'
					}
				]
			})
		);
		room.act({ type: 'pour', spring: 'dew', at: { x: -100, y: 100 } });
		expect(room.view().pouring).toEqual({
			spring: 'dew',
			at: { x: 0.5, y: 29.5 }
		});
		expect(room.planTick().emit[0]).toMatchObject({
			rect: box(0, H - 4, 4, 4),
			velocity: { x: 0, y: 32 }
		});
		expect(room.act({ type: 'pour', spring: 'dew', at: { x: 100, y: -100 } })).toEqual([]);
		expect(room.planTick().emit[0].rect).toEqual(box(W - 4, 0, 4, 4));
		const view = room.view();
		view.pouring!.at.x = 0;
		expect(room.view().pouring!.at.x).toBe(47.5);
	});
	it('validates id and finite point; stir is a replay-compatible no-op', () => {
		const room = createRoom(fixture());
		for (const action of [
			{ type: 'pour' as const, spring: 'missing', at: { x: 9, y: 4 } },
			{ type: 'pour' as const, spring: 'dew' },
			{ type: 'pour' as const, spring: 'dew', at: { x: NaN, y: 4 } },
			{ type: 'pour' as const, spring: 'dew', at: { x: 9, y: Infinity } }
		])
			expect(room.act(action)).toEqual([{ type: 'denied', reason: 'busy' }]);
		const before = room.view();
		expect(room.act({ type: 'stir', from: { x: 2, y: 4 }, to: { x: 8, y: 4 } })).toEqual([]);
		expect(room.view()).toEqual(before);
	});
	it('allows one spring at a time; finite well empties once, stops and refuses restart', () => {
		const room = createRoom(
			fixture({
				springs: [
					{
						id: 'dew',
						species: 0,
						well: 1.25,
						zone: box(6, 3, 6, 3),
						rate: 12,
						style: 'cloud'
					},
					{
						id: 'sap',
						species: 1,
						well: 2,
						zone: box(16, 3, 6, 3),
						rate: 12,
						style: 'crack'
					}
				]
			})
		);
		room.act({ type: 'pour', spring: 'sap', at: { x: 18, y: 4 } });
		room.act({ type: 'pour', spring: 'dew', at: { x: 9, y: 4 } });
		const ticks = advance(room, 120);
		expect(ticks.flatMap((t) => t.emit).reduce((sum, e) => sum + e.count, 0)).toBe(80);
		expect(ticks.flatMap((t) => t.emit).every((e) => e.species === 0)).toBe(true);
		expect(room.view().springs).toEqual({ dew: 0, sap: 2 });
		expect(room.view().pouring).toBeNull();
		expect(room.observe(frame(120)).filter((e) => e.type === 'well-empty')).toEqual([
			{ type: 'well-empty', id: 'dew' }
		]);
		expect(room.observe(frame(121)).filter((e) => e.type === 'well-empty')).toEqual([]);
		expect(room.act({ type: 'pour', spring: 'dew', at: { x: 9, y: 4 } })).toEqual([
			{ type: 'denied', reason: 'supply-empty', at: { x: 9, y: 4.5 } }
		]);
	});
	it('preserves fractional credit across short ribbons', () => {
		const room = createRoom(fixture());
		let markers = 0;
		for (let i = 0; i < 60; i++) {
			room.act({ type: 'pour', spring: 'dew', at: { x: 9, y: 4 } });
			markers += room.planTick().emit.reduce((sum, e) => sum + e.count, 0);
			room.act({ type: 'pour', spring: null });
			room.planTick();
		}
		expect(markers).toBe(7 * MARKERS_PER_UNIT);
	});
	it('sandbox never deducts, clears, or becomes stuck', () => {
		const room = createRoom(fixture(), { sandbox: true });
		room.act({ type: 'pour', spring: 'dew', at: { x: 9, y: 4 } });
		advance(room, 1200);
		expect(room.view().springs.dew).toBe(Infinity);
		expect(
			sample(room, 1, 120, { 'urn:urn': [10, 0, 0] }).some(
				(e) => e.type === 'well-empty' || e.type === 'clear' || e.type === 'stuck'
			)
		).toBe(false);
		expect(room.view().urns[0].status).toBe('ready');
	});
	it('plank detents restore underlying static solids', () => {
		const room = createRoom(
			fixture({
				planks: [
					{
						id: 'plank',
						pivot: { x: 2, y: 20.5 },
						length: 4,
						angles: [0, -90],
						initial: 0
					}
				]
			})
		);
		room.act({ type: 'pose', id: 'plank', index: 1 });
		const tick = room.planTick();
		expect(tick.edits.some((e) => e.kind === AIR)).toBe(true);
		expect(tick.edits.some((e) => e.kind === STONE)).toBe(true);
		expect(room.view().terrain[cell(2.25, 20.5)]).toBe(STONE);
		expect(room.act({ type: 'pose', id: 'plank', index: 99 })).toEqual([
			{ type: 'denied', reason: 'busy' }
		]);
	});
});

describe('gates', () => {
	it.each(['up', 'down', 'left', 'right'] as const)(
		'animates %s panels over 36 ticks, reverses midway',
		(retract) => {
			const room = createRoom(
				fixture({
					gates: [
						{
							id: 'gate',
							style: 'sluice',
							box: box(10, 15, 4, 4),
							retract,
							open: false,
							driver: { kind: 'player' }
						}
					]
				})
			);
			expect(room.act({ type: 'toggle', id: 'gate' })).toEqual([
				{ type: 'gate', id: 'gate', open: true }
			]);
			const ticks = advance(room, 18);
			expect(room.view().gates.gate).toBe(0.5);
			expect(ticks.flatMap((t) => t.edits).filter((e) => e.kind === AIR)).toHaveLength(128);
			room.act({ type: 'toggle', id: 'gate' });
			advance(room, 18);
			expect(room.view().gates.gate).toBe(0);
			room.act({ type: 'toggle', id: 'gate' });
			advance(room, 36);
			expect(room.view().gates.gate).toBe(1);
			expect(room.view().terrain[cell(11, 16)]).toBe(AIR);
		}
	);
	it('weight driver uses 10% hysteresis, disallows manual toggle', () => {
		const room = createRoom(
			fixture({
				gates: [
					{
						id: 'door',
						style: 'sluice',
						box: box(10, 15, 2, 4),
						retract: 'up',
						open: false,
						driver: { kind: 'weight', sensor: box(4, 10, 4, 4), units: 10 }
					}
				]
			})
		);
		expect(room.act({ type: 'toggle', id: 'door' })).toContainEqual({
			type: 'denied',
			reason: 'busy'
		});
		expect(room.observe(frame(1, { 'weight:door': [10, 0, 0] }))).toContainEqual({
			type: 'gate',
			id: 'door',
			open: true
		});
		advance(room, 36);
		expect(
			room.observe(frame(2, { 'weight:door': [9.2, 0, 0] })).some((e) => e.type === 'gate')
		).toBe(false);
		expect(room.observe(frame(3, { 'weight:door': [8.8, 0, 0] }))).toContainEqual({
			type: 'gate',
			id: 'door',
			open: false
		});
	});
	it('wheel speed smooths flux; driven gate uses cells·units/s threshold', () => {
		const room = createRoom(
			fixture({
				wheels: [
					{
						id: 'wheel',
						sensor: box(10, 10, 2, 2),
						at: { x: 11, y: 11 },
						radius: 2
					}
				],
				gates: [
					{
						id: 'door',
						style: 'lift',
						box: box(10, 15, 2, 4),
						retract: 'up',
						open: false,
						driver: { kind: 'wheel', wheel: 'wheel', flux: 10 }
					}
				]
			})
		);
		const f = frame(60);
		f.sensors = {
			'wheel:wheel': { counts: [64, 0, 0], flux: { x: 64 * 24, y: 0 } }
		};
		expect(room.observe(f)).toContainEqual({
			type: 'gate',
			id: 'door',
			open: true
		});
		expect(room.view().wheels.wheel).toBeCloseTo(3 * (1 - 0.85 ** 6), 3);
		expect(room.observe(frame(120))).toContainEqual({
			type: 'gate',
			id: 'door',
			open: false
		});
	});
});

describe('ink and digging', () => {
	it('claims dry air, queues INK, stops at budget, refunds complete strokes', () => {
		const room = createRoom(fixture({ ink: 5 }));
		const events = room.act({
			type: 'ink',
			stroke: 1,
			from: { x: 3, y: 8 },
			to: { x: 12, y: 8 }
		});
		expect(events).toContainEqual({ type: 'denied', reason: 'ink-empty' });
		expect(room.view().inkUsed).toBe(5);
		expect(room.planTick().edits.filter((e) => e.kind === INK)).toHaveLength(5);
		room.act({ type: 'erase', stroke: 1 });
		expect(room.view().inkLeft).toBe(5);
		expect(room.planTick().edits.filter((e) => e.kind === AIR)).toHaveLength(5);
	});
	it('spends scarce ink from the stroke start in either direction', () => {
		const room = createRoom(fixture({ ink: 4 }));
		room.act({
			type: 'ink',
			stroke: 1,
			from: { x: 12, y: 8 },
			to: { x: 3, y: 8 }
		});
		expect(room.planTick().edits.every((e) => e.x >= 46)).toBe(true);
	});
	it('wet denial once per stroke; sensor/spring/drain cells cannot be claimed', () => {
		const room = createRoom(fixture({ ink: 500 }));
		const f = frame(1);
		f.occupancy.fill(1);
		room.observe(f);
		const stroke = {
			type: 'ink' as const,
			stroke: 1,
			from: { x: 3, y: 8 },
			to: { x: 5, y: 8 }
		};
		expect(room.act(stroke).filter((e) => e.type === 'denied' && e.reason === 'wet')).toHaveLength(
			1
		);
		expect(room.act(stroke)).toEqual([]);
		expect(room.view().inkUsed).toBe(0);
		room.observe(frame(2));
		for (const [x, y] of [
			[23, 15],
			[10, 4],
			[8, 5],
			[42, 26.5]
		])
			room.act({
				type: 'ink',
				stroke: x * 100 + y,
				from: { x, y },
				to: { x, y }
			});
		expect(room.view().inkUsed).toBe(0);
	});
	it('no ink tool disallows strokes; malformed geometry is rejected', () => {
		const room = createRoom(fixture({ ink: 0 }));
		expect(
			room.act({
				type: 'ink',
				stroke: 1,
				from: { x: 1, y: 1 },
				to: { x: 2, y: 1 }
			})
		).toContainEqual({ type: 'denied', reason: 'ink-empty' });
		expect(room.act({ type: 'dig', at: { x: NaN, y: 1 }, radius: 2 })).toContainEqual({
			type: 'denied',
			reason: 'busy'
		});
	});
	it('digs only loam, leaves stone and root, disabled tool does nothing', () => {
		const room = createRoom(fixture());
		room.act({ type: 'dig', at: { x: 4.5, y: 20.5 }, radius: 0.75 });
		expect(room.view().terrain[cell(4.5, 20.5)]).toBe(AIR);
		expect(room.planTick().edits.every((e) => e.kind === AIR)).toBe(true);
		for (const x of [2.5, 6.5])
			expect(room.act({ type: 'dig', at: { x, y: 20.5 }, radius: 0.3 })).toContainEqual({
				type: 'denied',
				reason: 'not-diggable',
				at: { x, y: 20.5 }
			});
		expect(room.view().terrain[cell(6.5, 20.5)]).toBe(ROOT);
		const disabled = createRoom(fixture({ dig: false }));
		disabled.act({ type: 'dig', at: { x: 4.5, y: 20.5 }, radius: 1 });
		expect(disabled.view().terrain[cell(4.5, 20.5)]).toBe(LOAM);
	});
});

describe('sensor gap safety and impossible supply', () => {
	it('does not retroactively credit a first sample, caps gaps at six ticks', () => {
		const room = createRoom(fixture());
		room.observe(frame(600, { 'urn:urn': [10, 0, 0] }));
		expect(room.view().urns[0].hold).toBe(0);
		room.observe(frame(1200, { 'urn:urn': [10, 0, 0] }));
		expect(room.view().urns[0].hold).toBe(6 / 75);
		expect(room.observe(frame(1200, { 'urn:urn': [0, 10, 0] }))).toEqual([]);
		const spoiled = createRoom(fixture());
		spoiled.observe(frame(600, { 'urn:urn': [9, 1, 0] }));
		for (let i = 2; i <= 6; i++) spoiled.observe(frame(i * 600, { 'urn:urn': [9, 1, 0] }));
		expect(spoiled.view().urns[0].status).toBe('filling');
		spoiled.observe(frame(4200, { 'urn:urn': [9, 1, 0] }));
		expect(spoiled.view().urns[0].status).toBe('spoiled');
	});
	it('reports stuck once after irrecoverable loss, never during recoverable flight or sandbox', () => {
		const level = fixture({
			springs: [
				{
					id: 'dew',
					species: 0,
					well: 10,
					rate: 7,
					zone: box(6, 3, 6, 3),
					style: 'cloud'
				}
			]
		});
		const room = createRoom(level);
		room.act({ type: 'pour', spring: 'dew', at: { x: 9, y: 4 } });
		advance(room, 120);
		room.observe(frame(120, {}, { alive: [640, 0, 0], emitted: [640, 0, 0] }));
		expect(room.view().stuck).toBe(false);
		expect(
			room.observe(
				frame(
					121,
					{},
					{
						alive: [0, 0, 0],
						emitted: [640, 0, 0],
						drained: { waste: [640, 0, 0] }
					}
				)
			)
		).toContainEqual({ type: 'stuck' });
		expect(room.view().stuck).toBe(true);
		expect(room.observe(frame(122)).filter((e) => e.type === 'stuck')).toEqual([]);
		const garden = createRoom(level, { sandbox: true });
		garden.observe(frame(120));
		expect(garden.view().stuck).toBe(false);
	});
	it('counts emissions newer than the asynchronous sensor snapshot as recoverable', () => {
		const room = createRoom(
			fixture({
				springs: [
					{
						id: 'dew',
						species: 0,
						well: 10,
						rate: 7,
						zone: box(6, 3, 6, 3),
						style: 'cloud'
					}
				]
			})
		);
		room.act({ type: 'pour', spring: 'dew', at: { x: 9, y: 4 } });
		advance(room, 120);
		room.observe(frame(1, {}, { alive: [7, 0, 0], emitted: [7, 0, 0] }));
		expect(room.view().stuck).toBe(false);
	});
	it('aggregates requirements but keeps ready contents recoverable', () => {
		const level = fixture({ springs: [] });
		level.urns = [
			...level.urns,
			{
				id: 'second',
				box: box(30, 8, 4, 4),
				recipe: { amount: 10, mix: [1, 0, 0] },
				powers: []
			}
		];
		const room = createRoom(level);
		for (let tick = 1; tick <= 76; tick++)
			room.observe(frame(tick, { 'urn:urn': [10, 0, 0] }, { alive: [640, 0, 0] }));
		expect(room.view().urns[0].status).toBe('ready');
		expect(room.view().stuck).toBe(true);
	});
	it('keeps ready liquid available until room clear, excludes grown seed contents', () => {
		const level = fixture({
			springs: [],
			seeds: [
				{
					id: 'seed',
					box: box(2, 8, 4, 4),
					recipe: { amount: 2, mix: [1, 0, 0] },
					vine: []
				}
			]
		});
		const room = createRoom(level);
		for (let tick = 1; tick <= 76; tick++)
			room.observe(
				frame(tick, { 'urn:urn': [9.5, 0, 0], 'seed:seed': [2, 0, 0] }, { alive: [736, 0, 0] })
			);
		expect(room.view().stuck).toBe(false);
		expect(room.view().seedViews[0].status).toBe('complete');
		expect(
			room.observe(
				frame(77, { 'urn:urn': [8, 0, 0], 'seed:seed': [2, 0, 0] }, { alive: [640, 0, 0] })
			)
		).toContainEqual({ type: 'stuck' });
	});
	it('excludes spoiled contents from reusable supply, respects ratio tolerance', () => {
		const room = createRoom(fixture({ springs: [] }));
		expect(
			room
				.observe(frame(1, { 'urn:urn': [9.5, 0, 0] }, { alive: [608, 0, 0] }))
				.some((e) => e.type === 'stuck')
		).toBe(false);
		sample(room, 2, 33, { 'urn:urn': [9, 1, 0] });
		expect(room.view().urns[0].status).toBe('spoiled');
		expect(room.view().stuck).toBe(true);
	});
});

describe('recipes and completion', () => {
	it('uses the authored ratio tolerance for readiness and supply feasibility', () => {
		const level = fixture({ ratioTolerance: 0.1, springs: [] });
		level.urns[0].recipe.mix = [1, 1, 0];
		const room = createRoom(level);
		room.observe(frame(1, { 'urn:urn': [6, 4, 0] }, { alive: [384, 256, 0] }));
		expect(room.view().urns[0].status).toBe('ready');
		expect(room.view().stuck).toBe(false);
	});
	it('ignores a stray marker in an empty vessel', () => {
		const level = fixture();
		level.urns[0].recipe.mix = [0, 1, 0];
		const room = createRoom(level);
		sample(room, 1, 60, { 'urn:urn': [1 / 64, 0, 0] });
		expect(room.view().urns[0].status).toBe('filling');
	});
	it('closes the plug after a spoiled vessel is flushed', () => {
		const room = createRoom(fixture());
		sample(room, 1, 40, { 'urn:urn': [9, 1, 0] });
		expect(room.view().urns[0].status).toBe('spoiled');
		room.act({ type: 'toggle', id: 'plug' });
		advance(room, 36);
		expect(room.view().gates.plug).toBe(1);
		expect(room.observe(frame(41))).toContainEqual({ type: 'gate', id: 'plug', open: false });
		advance(room, 36);
		expect(room.view().gates.plug).toBe(0);
	});
	it('requires 75 fresh ticks in tune, ignores stale frames, complete remains sticky', () => {
		const room = createRoom(fixture());
		room.observe(frame(30, { 'urn:urn': [10, 0, 0] }));
		expect(room.view().urns[0]).toMatchObject({ status: 'ready', hold: 0 });
		expect(room.observe(frame(30, { 'urn:urn': [0, 20, 0] }))).toEqual([]);
		expect(room.observe(frame(20, { 'urn:urn': [0, 20, 0] }))).toEqual([]);
		const events = sample(room, 31, 105, { 'urn:urn': [10, 0, 0] });
		expect(events).toContainEqual({
			type: 'urn',
			id: 'urn',
			status: 'complete'
		});
		expect(events).toContainEqual({ type: 'gate', id: 'plug', open: true });
		expect(events).toContainEqual({ type: 'machine', id: 'machine' });
		expect(events).toContainEqual({
			type: 'clear',
			dewdrops: 3,
			mastery: room.mastery()
		});
		room.observe(frame(200, { 'urn:urn': [0, 100, 0] }));
		expect(room.view().urns[0].status).toBe('complete');
		expect(room.view().everSpoiled).toBe(false);
		advance(room, 36);
		expect(room.view().gates.plug).toBe(1);
	});
	it('amount and ratio departure resets hold; all species ratios matter', () => {
		const room = createRoom(
			fixture({
				urns: [
					{
						id: 'urn',
						box: box(20, 12, 8, 8),
						recipe: { amount: 10, mix: [1, 1, 0] },
						powers: []
					}
				]
			})
		);
		room.observe(frame(30, { 'urn:urn': [5, 5, 0] }));
		room.observe(frame(40, { 'urn:urn': [4, 4, 0] }));
		expect(room.view().urns[0]).toMatchObject({ hold: 0, status: 'filling' });
		room.observe(frame(50, { 'urn:urn': [6.5, 3.5, 0] }));
		expect(room.view().urns[0].inTune).toBe(false);
		room.observe(frame(100, { 'urn:urn': [5, 5, 0] }));
		expect(room.view().urns[0].status).toBe('ready');
		sample(room, 101, 175, { 'urn:urn': [5, 5, 0] });
		expect(room.view().urns[0].status).toBe('complete');
	});
	it('forbidden species needs more than 30 ticks; spoilt resets only below 5%', () => {
		const room = createRoom(fixture());
		sample(room, 1, 31, { 'urn:urn': [9, 1, 0] });
		expect(room.view().urns[0].status).toBe('filling');
		room.observe(frame(32, { 'urn:urn': [9, 1, 0] }));
		expect(room.view().urns[0].status).toBe('spoiled');
		room.observe(frame(90, { 'urn:urn': [10, 0, 0] }));
		expect(room.view().urns[0].status).toBe('spoiled');
		room.observe(frame(91, { 'urn:urn': [0.5, 0, 0] }));
		expect(room.view().urns[0].status).toBe('spoiled');
		room.observe(frame(92, { 'urn:urn': [0.4, 0, 0] }));
		expect(room.view().urns[0].status).toBe('filling');
		sample(room, 93, 168, { 'urn:urn': [10, 0, 0] });
		expect(room.dewdrops()).toBe(2);
		expect(room.view().everSpoiled).toBe(true);
		expect(room.mastery()).toMatchObject({
			revived: true,
			thrifty: true,
			clean: false
		});
	});
	it('unbounded surplus stays ready; forbidden grace resets on clean frame', () => {
		const room = createRoom(fixture());
		room.observe(frame(1, { 'urn:urn': [100, 0, 0] }));
		expect(room.view().urns[0]).toMatchObject({ status: 'ready', fill: 10 });
		expect(room.view().everSpoiled).toBe(false);
		const clean = createRoom(fixture());
		clean.observe(frame(30, { 'urn:urn': [5, 1, 0] }));
		clean.observe(frame(31, { 'urn:urn': [5, 0, 0] }));
		clean.observe(frame(60, { 'urn:urn': [5, 1, 0] }));
		expect(clean.view().urns[0].status).toBe('filling');
	});
	it('machines need every powering urn; gates latch on completed urns and seeds', () => {
		const level = fixture();
		level.urns = [
			...level.urns,
			{
				id: 'second',
				box: box(30, 8, 4, 4),
				recipe: { amount: 2, mix: [0, 1, 0] },
				powers: ['machine']
			}
		];
		level.gates = [
			...level.gates,
			{
				id: 'latch',
				style: 'lift',
				box: box(10, 18, 2, 4),
				retract: 'up',
				open: false,
				driver: { kind: 'urns', urns: ['urn', 'second'] }
			}
		];
		const room = createRoom(level);
		sample(room, 1, 76, { 'urn:urn': [10, 0, 0] });
		expect(room.view().machines.machine).toBe(false);
		expect(room.view().cleared).toBe(false);
		const events = sample(room, 77, 152, {
			'urn:urn': [10, 0, 0],
			'urn:second': [0, 2, 0]
		});
		expect(events).toContainEqual({ type: 'machine', id: 'machine' });
		expect(events).toContainEqual({ type: 'gate', id: 'latch', open: true });
		expect(events).toContainEqual({
			type: 'clear',
			dewdrops: 3,
			mastery: room.mastery()
		});
		room.observe(frame(200));
		advance(room, 36);
		expect(room.view().gates.latch).toBe(1);
	});
	it('holds all urns simultaneously, resets when either leaves ready, never drains early', () => {
		const level = fixture();
		level.urns = [
			...level.urns,
			{
				id: 'second',
				box: box(30, 8, 4, 4),
				recipe: { amount: 2, mix: [0, 1, 0] },
				powers: ['machine']
			}
		];
		const room = createRoom(level);
		const both: Record<string, Counts> = {
			'urn:urn': [10, 0, 0],
			'urn:second': [0, 2, 0]
		};
		sample(room, 1, 60, both);
		expect(room.view().urns.map((u) => u.hold)).toEqual([59 / 75, 59 / 75]);
		expect(room.view().gates.plug).toBe(0);
		expect(room.view().machines.machine).toBe(false);
		room.observe(frame(61, { ...both, 'urn:urn': [9, 0, 0] }));
		expect(room.view().urns.map((u) => u.hold)).toEqual([0, 0]);
		sample(room, 62, 136, both);
		expect(room.view().cleared).toBe(false);
		expect(room.observe(frame(137, both))).toContainEqual({
			type: 'clear',
			dewdrops: 3,
			mastery: room.mastery()
		});
		const sealed = room.view().urns;
		expect(
			room.observe(frame(138, { 'urn:urn': [0, 99, 0] })).some((e) => e.type === 'clear')
		).toBe(false);
		expect(room.view().urns).toEqual(sealed);
	});
	it('forbidden traces above 2% prevent ready even within ratio tolerance', () => {
		const room = createRoom(fixture());
		room.observe(frame(1, { 'urn:urn': [9.7, 0.3, 0] }));
		expect(room.view().urns[0]).toMatchObject({
			inTune: true,
			status: 'filling'
		});
		room.observe(frame(2, { 'urn:urn': [9.9, 0.1, 0] }));
		expect(room.view().urns[0].status).toBe('ready');
	});
	it('clear drops freeze at clear: Thrifty and Clean scored independently', () => {
		const room = createRoom(fixture({ mastery: { reserve: 0.99, ink: 0 } }));
		room.act({ type: 'pour', spring: 'dew', at: { x: 9, y: 4 } });
		advance(room, 60);
		room.act({
			type: 'ink',
			stroke: 1,
			from: { x: 4, y: 8 },
			to: { x: 5, y: 8 }
		});
		sample(room, 1, 76, { 'urn:urn': [10, 0, 0] });
		expect(room.dewdrops()).toBe(1);
		const marks = room.mastery();
		expect(marks).toMatchObject({
			revived: true,
			thrifty: false,
			clean: false,
			inkBudget: 0
		});
		room.act({ type: 'erase', stroke: 1 });
		expect(room.dewdrops()).toBe(1);
		expect(room.mastery()).toEqual(marks);
	});
	it('a no-wax room earns Clean for no spoil, never a free wax drop', () => {
		const room = createRoom(fixture({ ink: 0, mastery: { reserve: 0.99 } }));
		room.act({ type: 'pour', spring: 'dew', at: { x: 9, y: 4 } });
		advance(room, 60);
		sample(room, 1, 32, { 'urn:urn': [9, 1, 0] });
		room.observe(frame(33));
		sample(room, 34, 109, { 'urn:urn': [10, 0, 0] });
		expect(room.mastery()).toMatchObject({
			revived: true,
			thrifty: false,
			clean: false,
			everSpoiled: true
		});
		expect(room.mastery().inkUsed).toBeUndefined();
		expect(room.dewdrops()).toBe(1);
	});
	it('splash strength clamps; per-sensor cooldown; waste counted cumulatively', () => {
		const room = createRoom(fixture());
		expect(
			room.observe(frame(1, { 'urn:urn': [2, 0, 0] })).filter((e) => e.type === 'splash')
		).toHaveLength(1);
		expect(
			room.observe(frame(2, { 'urn:urn': [4, 0, 0] })).filter((e) => e.type === 'splash')
		).toHaveLength(0);
		expect(
			room.observe(frame(20, { 'urn:urn': [30, 0, 0] }, { drained: { waste: [128, 64, 0] } }))
		).toContainEqual({ type: 'splash', at: { x: 24, y: 16 }, strength: 1 });
		expect(room.view().wasted).toBe(3);
	});
});

describe('living geometry', () => {
	const seed = {
		id: 'seed',
		box: box(3, 8, 4, 4),
		recipe: { amount: 2, mix: [1, 1, 0] as const },
		plug: 'plug',
		vine: [box(10, 15, 2, 0.5), box(12, 16, 3, 0.5)]
	};
	it('seed grows one row every three ticks, then reports grown; no overfill spoil', () => {
		const room = createRoom(fixture({ seeds: [seed] }));
		room.observe(frame(1, { 'seed:seed': [5, 5, 0] }));
		expect(room.view().seeds.seed).toBe(0);
		const events = sample(room, 2, 76, { 'seed:seed': [5, 5, 0] });
		expect(room.view().seedViews[0]).toMatchObject({
			status: 'ready',
			units: 10,
			inTune: true
		});
		expect(events).toContainEqual({
			type: 'seed',
			id: 'seed',
			status: 'growing'
		});
		expect(advance(room, 2).flatMap((t) => t.edits)).toEqual([]);
		expect(room.planTick().edits.filter((e) => e.kind === VINE)).toHaveLength(8);
		expect(room.view().seeds.seed).toBe(0.25);
		advance(room, 9);
		expect(room.view().seeds.seed).toBe(1);
		expect(room.observe(frame(77))).toContainEqual({
			type: 'seed',
			id: 'seed',
			status: 'grown'
		});
	});
	it('slowest valid ongoing flow can hold a seed despite growing surplus', () => {
		const room = createRoom(fixture({ seeds: [seed] }));
		for (let tick = 1; tick <= 76; tick++)
			room.observe(frame(tick, { 'seed:seed': [1 + tick / 600, 1 + tick / 600, 0] }));
		expect(room.view().seedViews[0]).toMatchObject({
			status: 'ready',
			hold: 1,
			inTune: true
		});
		advance(room, 12);
		expect(room.view().seedViews[0].status).toBe('complete');
		const snapshot = room.view().seedViews[0];
		(snapshot.counts as unknown as number[])[0] = 999;
		expect(room.view().seedViews[0].counts[0]).not.toBe(999);
	});
	it('forbidden watering spoils seed; flushing recovers', () => {
		const room = createRoom(fixture({ seeds: [seed] }));
		expect(sample(room, 1, 32, { 'seed:seed': [0, 0, 2] })).toContainEqual({
			type: 'seed',
			id: 'seed',
			status: 'spoiled'
		});
		expect(room.view().seeds.seed).toBe(-1);
		room.observe(frame(33));
		expect(room.view().seeds.seed).toBe(0);
	});
	it('rose withers brambles in rows, overlapping grown vine survives', () => {
		const room = createRoom(
			fixture({
				seeds: [{ ...seed, vine: [box(10, 15, 2, 0.5)] }],
				brambles: [
					{
						id: 'thorn',
						sensor: box(30, 8, 3, 3),
						rose: 2,
						vine: [box(10, 15, 2, 0.5), box(14, 16, 2, 0.5)]
					}
				]
			})
		);
		sample(room, 1, 76, { 'seed:seed': [1, 1, 0] });
		advance(room, 6);
		room.observe(frame(77, { 'bramble:thorn': [0, 0, 2] }));
		advance(room, 12);
		expect(room.view().brambles.thorn).toBe(0);
		expect(room.view().terrain[cell(10.5, 15.25)]).toBe(VINE);
		expect(room.view().terrain[cell(14.5, 16.25)]).toBe(AIR);
		expect(room.observe(frame(78))).toContainEqual({
			type: 'bramble',
			id: 'thorn'
		});
	});
});

it.each(LEVELS.map((level) => [level.id, level] as const))(
	'%s never clears without input',
	(_, level) => {
		const room = createRoom(level);
		for (let tick = 60; tick <= 600; tick += 60) {
			advance(room, 60);
			expect(room.observe(frame(tick)).some((e) => e.type === 'clear')).toBe(false);
		}
		expect(room.view().cleared).toBe(false);
		expect(room.dewdrops()).toBe(0);
	}
);
