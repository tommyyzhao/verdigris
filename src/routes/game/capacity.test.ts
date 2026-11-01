import { expect, it, vi } from 'vitest';
import type { LiquidTick } from 'svelte-fluid/experimental';
import { createCapacityGuard } from './capacity.js';

it('compacts at intervals and suppresses whole emissions until capacity recovers', () => {
	const guard = createCapacityGuard({ low: 10, resume: 20, minInterval: 3 });
	const sim = { capacityLeft: 9, compact: vi.fn() };
	const tick: LiquidTick = {
		tick: 1,
		emit: [
			{
				species: 0,
				count: 5,
				rect: { x: 0, y: 0, w: 1, h: 1 },
				velocity: { x: 0, y: 0 },
			},
		],
		edits: [{ x: 0, y: 0, kind: 1 }],
	};
	const blocked = guard.filter(tick, sim);
	expect(sim.compact).toHaveBeenCalledTimes(1);
	expect(guard.full).toBe(true);
	expect(blocked.emit).toEqual([]);
	expect(blocked.edits).toBe(tick.edits);
	sim.capacityLeft = 15;
	expect(guard.filter({ ...tick, tick: 2 }, sim).emit).toEqual([]);
	sim.capacityLeft = 9;
	guard.filter({ ...tick, tick: 3 }, sim);
	expect(sim.compact).toHaveBeenCalledTimes(1);
	sim.compact.mockImplementation(() => {
		sim.capacityLeft = 20;
	});
	const resumed = guard.filter({ ...tick, tick: 4 }, sim);
	expect(sim.compact).toHaveBeenCalledTimes(2);
	expect(guard.full).toBe(false);
	expect(resumed.emit).toBe(tick.emit);
});

it('recompacts while full after partial recovery', () => {
	const guard = createCapacityGuard({ minInterval: 120 });
	const sim = { capacityLeft: 8000, compact: vi.fn() };
	sim.compact
		.mockImplementationOnce(() => {})
		.mockImplementationOnce(() => {
			sim.capacityLeft = 12000;
		})
		.mockImplementationOnce(() => {
			sim.capacityLeft = 20000;
		});
	const tick: LiquidTick = {
		tick: 1,
		emit: [
			{
				species: 0,
				count: 1,
				rect: { x: 0, y: 0, w: 1, h: 1 },
				velocity: { x: 0, y: 0 },
			},
		],
		edits: [],
	};
	expect(guard.filter(tick, sim).emit).toEqual([]);
	expect(guard.filter({ ...tick, tick: 121 }, sim).emit).toEqual([]);
	expect(guard.filter({ ...tick, tick: 240 }, sim).emit).toEqual([]);
	expect(sim.compact).toHaveBeenCalledTimes(2);
	expect(guard.filter({ ...tick, tick: 241 }, sim).emit).toBe(tick.emit);
	expect(guard.full).toBe(false);
});
