import type { LiquidSim, LiquidTick } from 'svelte-fluid/experimental';

export function createCapacityGuard(
	options: { low?: number; resume?: number; minInterval?: number } = {}
): {
	filter(
		tick: LiquidTick,
		sim: Pick<LiquidSim, 'capacityLeft' | 'compact'>
	): LiquidTick;
	readonly full: boolean;
} {
	const { low = 8192, resume = 16384, minInterval = 120 } = options;
	let full = false;
	let lastCompaction = -Infinity;
	return {
		get full() {
			return full;
		},
		filter(tick, sim) {
			if (
				(sim.capacityLeft < low || (full && sim.capacityLeft < resume)) &&
				tick.tick - lastCompaction >= minInterval
			) {
				sim.compact();
				lastCompaction = tick.tick;
			}
			if (sim.capacityLeft < low) full = true;
			else if (sim.capacityLeft >= resume) full = false;
			return full ? { ...tick, emit: [] } : tick;
		},
	};
}
