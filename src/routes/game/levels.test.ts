import { describe, expect, it } from 'vitest';
import { AIR, INK } from 'svelte-fluid/experimental';
import { LEVELS, SANDBOX, sweep } from './levels.js';
import { createRoom } from './model.js';
import { LEVEL_H, LEVEL_W, SCALE, type Box, type Level } from './types.js';

const W = LEVEL_W * SCALE;
const H = LEVEL_H * SCALE;
function cells(box: Box): number[] {
	const out: number[] = [];
	for (let y = Math.round(box.y * SCALE); y < Math.round((box.y + box.h) * SCALE); y++)
		for (let x = Math.round(box.x * SCALE); x < Math.round((box.x + box.w) * SCALE); x++)
			out.push(y * W + x);
	return out;
}
function inside(box: Box) {
	expect(box.x).toBeGreaterThanOrEqual(0);
	expect(box.y).toBeGreaterThanOrEqual(0);
	expect(box.w).toBeGreaterThan(0);
	expect(box.h).toBeGreaterThan(0);
	expect(box.x + box.w).toBeLessThanOrEqual(LEVEL_W);
	expect(box.y + box.h).toBeLessThanOrEqual(LEVEL_H);
}

// This proves an open spill connection, not a GPU-verified hydraulic solution.
function reachesDrain(level: Level, start: number[]): boolean {
	const terrain = createRoom(level).scene().terrain;
	const drains = new Set(level.drains.flatMap((d) => cells(d.box)));
	const seen = new Set(start.filter((i) => terrain[i] === AIR));
	const queue = [...seen];
	for (let n = 0; n < queue.length; n++) {
		const i = queue[n];
		if (drains.has(i)) return true;
		for (const j of [i - W, i + W, ...(i % W ? [i - 1] : []), ...(i % W < W - 1 ? [i + 1] : [])]) {
			if (j < 0 || j >= W * H || seen.has(j) || terrain[j] !== AIR) continue;
			seen.add(j);
			queue.push(j);
		}
	}
	return false;
}

it('authors connected human-scale sweeps instead of teleport impulses', () => {
	const actions = sweep(20, { x: 9, y: 8 }, { x: 25, y: 8 }, 16);
	expect(actions).toHaveLength(16);
	for (let i = 0; i < actions.length; i++) {
		expect(actions[i]).toEqual({
			tick: 20 + i,
			action: {
				type: 'stir',
				from: { x: 9 + i, y: 8 },
				to: { x: 10 + i, y: 8 },
			},
		});
	}
});

it('contains the ordered campaign and the unlimited living garden', () => {
	expect(LEVELS.map((l) => l.id)).toEqual(['first-rain', 'breath', 'hidden-draft', 'still-pond', 'two-springs', 'bring-it-back']);
	expect(LEVELS.map((l) => l.act)).toEqual([1, 1, 2, 2, 2, 3]);
	expect(new Set([...LEVELS, SANDBOX].map((l) => l.id)).size).toBe(LEVELS.length + 1);
	expect(SANDBOX.name).toBe('The Living Garden');
	expect(SANDBOX.springs.map((s) => s.species)).toEqual([0, 1, 2]);
	expect(SANDBOX.springs.every((s) => s.well === Infinity)).toBe(true);
	expect(SANDBOX.vents).toHaveLength(2);
	expect(SANDBOX.ink).toBeGreaterThanOrEqual(500);
	expect(SANDBOX.dig).toBe(true);
});

describe.each([...LEVELS, SANDBOX].map((level) => [level.id, level] as const))('%s', (_, level) => {
	it('has readable legal terrain and globally unique entity ids', () => {
		expect(level.terrain).toHaveLength(LEVEL_H);
		for (const row of level.terrain) {
			expect(row).toHaveLength(LEVEL_W);
			expect(row).toMatch(/^[ #%&]+$/);
		}
		expect(level.terrain.slice(0, 2).every((row) => row.trim() === '')).toBe(true);
		const entities = [
			...level.springs,
			...level.vents,
			...level.planks,
			...level.gates,
			...level.urns,
			...level.seeds,
			...level.brambles,
			...level.wheels,
			...level.drains,
			...level.machines
		];
		expect(new Set(entities.map((e) => e.id)).size).toBe(entities.length);
	});
	it('resolves references and respects sensor/drain limits', () => {
		for (const u of [...level.urns, ...level.seeds]) {
			if (u.plug)
				expect(level.gates.find((g) => g.id === u.plug)).toMatchObject({
					style: 'plug',
					driver: { kind: 'player' }
				});
		}
		for (const u of level.urns) {
			for (const id of u.powers) expect(level.machines.some((m) => m.id === id)).toBe(true);
			if (u.plug) expect(level.drains.find((d) => d.id === `${u.id}-out`)?.kind).toBe('machine');
		}
		for (const g of level.gates) {
			const driver = g.driver;
			if (driver.kind === 'wheel')
				expect(level.wheels.some((w) => w.id === driver.wheel)).toBe(true);
			if (driver.kind === 'urns')
				for (const id of driver.urns)
					expect([...level.urns, ...level.seeds].some((u) => u.id === id)).toBe(true);
		}
		const scene = createRoom(level).scene();
		expect(scene.sensors.length).toBeLessThanOrEqual(32);
		expect(scene.drains.length).toBeLessThanOrEqual(16);
	});
	it('keeps spring zones inside the board, over unobstructed air', () => {
		const terrain = createRoom(level).scene().terrain;
		for (const spring of level.springs) {
			inside(spring.zone);
			expect(spring.zone.w).toBeGreaterThanOrEqual(1);
			expect(spring.zone.h).toBeGreaterThanOrEqual(1);
			expect(spring.rate).toBeGreaterThan(0);
			expect(spring.well).toBeGreaterThan(0);
			if (level !== SANDBOX) expect(Number.isFinite(spring.well)).toBe(true);
			for (const i of cells(spring.zone)) expect(terrain[i], `${spring.id}: zone ${i}`).toBe(AIR);
			const room = createRoom(level);
			for (const p of [
				{ x: -100, y: -100 },
				{ x: 100, y: 100 }
			]) {
				room.act({ type: 'pour', spring: spring.id, at: p });
				const emitter = room.planTick().emit[0].rect;
				expect(emitter.w).toBe(SCALE);
				expect(emitter.h).toBe(SCALE);
				for (const i of cells({
					x: emitter.x / SCALE,
					y: emitter.y / SCALE,
					w: 1,
					h: 1
				}))
					expect(terrain[i]).toBe(AIR);
			}
		}
	});
	it('keeps boxes, sensors, drains and vents inside the board', () => {
		for (const e of [
			...level.urns,
			...level.seeds,
			...level.gates,
			...level.drains,
			...level.machines,
			...level.pools
		])
			inside(e.box);
		for (const e of [...level.brambles, ...level.wheels]) inside(e.sensor);
		for (const s of [...level.seeds, ...level.brambles]) for (const v of s.vine) inside(v);
		const terrain = createRoom(level).scene().terrain;
		for (const u of [...level.urns, ...level.seeds])
			for (const i of cells(u.box)) expect(terrain[i], `${u.id}: ${i}`).toBe(AIR);
		for (const e of [...level.drains, ...level.pools])
			for (const i of cells(e.box)) expect(terrain[i], `interior ${i}`).toBe(AIR);
		for (const w of level.wheels)
			for (const i of cells(w.sensor)) expect(terrain[i], `${w.id}: ${i}`).toBe(AIR);
		for (const v of level.vents) {
			for (const p of [v.from, v.to]) {
				inside({ ...p, w: 0.25, h: 0.25 });
				expect(terrain[Math.floor(p.y * SCALE) * W + Math.floor(p.x * SCALE)]).toBe(AIR);
			}
			expect(Number.isFinite(v.velocity.x) && Number.isFinite(v.velocity.y)).toBe(true);
		}
	});
	it('has valid recipes, at least 15% supply slack and physical room for targets', () => {
		const needed = [0, 0, 0];
		for (const u of [...level.urns, ...level.seeds]) {
			expect(u.recipe.amount).toBeGreaterThan(0);
			expect(u.recipe.mix).toHaveLength(3);
			expect(u.recipe.mix.every((p) => p >= 0 && Number.isFinite(p))).toBe(true);
			const parts = u.recipe.mix.reduce((sum, p) => sum + p, 0);
			expect(parts).toBeGreaterThan(0);
			u.recipe.mix.forEach((part, i) => {
				needed[i] += (u.recipe.amount * part) / parts;
			});
			expect(u.box.w * (u.box.h - (u.box.h >= 5 ? 1 : 0))).toBeGreaterThanOrEqual(
				u.recipe.amount * 1.15
			);
		}
		for (let i = 0; i < 3; i++)
			expect(
				level.springs.filter((s) => s.species === i).reduce((sum, s) => sum + s.well, 0) +
				level.pools.filter((p) => p.species === i).reduce((sum, p) => sum + p.units, 0)
			).toBeGreaterThanOrEqual(needed[i] * 1.15);
	});
	it('leaves every rim open, a side spill lip and an air path to a drain', () => {
		const terrain = createRoom(level).scene().terrain;
		for (const u of level.urns) {
			const { x, y, w, h } = u.box;
			const mouth = cells({ x, y: y - 0.25, w, h: 0.25 });
			for (const i of mouth) expect(terrain[i], `${u.id}: rim ${i}`).toBe(AIR);
			if (h >= 5)
				for (const i of cells({ x: x + w, y, w: 1, h: 1 }))
					expect(terrain[i], `${u.id}: lip ${i}`).toBe(AIR);
			expect(reachesDrain(level, mouth), `${u.id}: spill route`).toBe(true);
			for (const i of cells({ x, y: y + h, w, h: 0.25 }))
				expect(terrain[i], `${u.id}: floor ${i}`).not.toBe(AIR);
		}
	});
	it('has three short hints and ordered, valid pour/stir candidate replays', () => {
		expect(level.hints).toHaveLength(3);
		for (const hint of level.hints) {
			expect(hint.length).toBeGreaterThan(15);
			expect(hint.length).toBeLessThan(220);
		}
		const room = createRoom(level, { sandbox: level === SANDBOX });
		let previous = 0;
		let planned = 0;
		for (const { tick, action } of level.solution) {
			while (planned < tick) {
				room.planTick();
				planned++;
			}
			expect(Number.isInteger(tick) && tick >= previous).toBe(true);
			previous = tick;
			if (action.type === 'pour' && action.spring !== null)
				expect(level.springs.some((s) => s.id === action.spring)).toBe(true);
			expect(
				room.act(action).filter((e) => e.type === 'denied'),
				JSON.stringify(action)
			).toEqual([]);
		}
		expect(room.view().pouring).toBeNull();
		expect(room.view().inkUsed).toBeLessThanOrEqual(level.mastery.ink ?? level.ink);
	});
});

it('Breath gravity-only rays from the entire spring miss all interception gutters', () => {
	const level = LEVELS[1];
	const terrain = createRoom(level).scene().terrain;
	const spring = level.springs[0];
	for (let x = spring.zone.x * SCALE; x < (spring.zone.x + spring.zone.w) * SCALE; x++) {
		for (let y = (spring.zone.y + spring.zone.h) * SCALE; y < 27 * SCALE; y++)
			expect(terrain[y * W + x]).toBe(AIR);
	}
	expect(level.vents[0].velocity.x).toBeGreaterThan(0);
	expect(level.vents[0].control).toEqual({ kind: 'switch', on: false });
	expect(level.solution.some(e => e.action.type === 'stir')).toBe(false);
});

it('wax cannot seal campaign urn interiors or spring zones', () => {
	for (const level of LEVELS.filter((l) => l.ink > 0)) {
		const room = createRoom(level);
		for (const box of [...level.urns.map((u) => u.box), ...level.springs.map((s) => s.zone)])
			room.act({
				type: 'ink',
				stroke: 1,
				from: { x: box.x + 0.5, y: box.y + 0.5 },
				to: { x: box.x + box.w - 0.5, y: box.y + 0.5 }
			});
		expect(room.view().inkUsed).toBe(0);
		expect(room.planTick().edits.some((e) => e.kind === INK)).toBe(false);
	}
});
