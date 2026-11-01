import { LiquidEngine } from 'svelte-fluid/experimental';
import type { LiquidOptions, LiquidSim } from 'svelte-fluid/experimental';

export function makeSim(options: LiquidOptions): LiquidSim {
	return new LiquidEngine(options);
}
