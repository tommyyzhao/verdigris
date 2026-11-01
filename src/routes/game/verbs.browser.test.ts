import { expect, it } from 'vitest';
import { commands } from 'vitest/browser';
import { createSteppedFluidEngine, type SteppedFluidEngine } from 'svelte-fluid/experimental';
import type { FluidConfig } from 'svelte-fluid';
import { LEVELS } from './levels.js';
import { evaluate, perturbTimeline } from './solver/evaluate.js';
import { naivePlans, seeded } from './solver/genome.js';

it.skipIf(import.meta.env.VITE_SOLVER_RUN !== 'tune')('measures room vent tuning', async () => {
	const rows = [];
	const level = LEVELS.find(l => l.id === (import.meta.env.VITE_SOLVER_ROOM ?? 'breath'))!;
	for (const strength of [6, 12, 24, 48, 96]) {
		const candidate = { ...level, vents: level.vents.map(v => ({ ...v, velocity: { x: strength, y: 0 } })) };
		const result = await evaluate(candidate, candidate.solution, 1, { cap: 1200 });
		rows.push({ strength, result });
		await output.writeBenchJson(`/tmp/verdigris-v3/v3-verbs/${level.id}-tune.json`, JSON.stringify(rows, null, 2));
	}
}, 570_000);

it.skipIf(import.meta.env.VITE_SOLVER_RUN !== 'accept')('accepts canonical, perturbations and naive ablations', async () => {
	const rows = [];
	const level = LEVELS.find(l => l.id === (import.meta.env.VITE_SOLVER_ROOM ?? 'breath'))!;
	const mode = import.meta.env.VITE_SOLVER_MODE ?? 'canonical';
	if (mode === 'canonical') for (const seed of [1, 71, 429]) rows.push({ name: 'canonical', seed, result: await evaluate(level, level.solution, seed, { cap: 1800, hashParticles: true }) });
	else if (mode === 'naive') for (const plan of naivePlans(level).filter(p => p.name !== 'no-stir')) rows.push({ name: plan.name, result: await evaluate(level, plan.timeline, 1, { cap: 1800, airOff: plan.airOff }) });
	else {
		const timing = Number(mode), position = timing / 12;
		for (let i = 0; i < 10; i++) {
			rows.push({ name: `perturb-${timing}`, i, result: await evaluate(level, perturbTimeline(level.solution, seeded(71 + i * 97), timing, position), 1, { cap: 1800 }) });
			await output.writeBenchJson(`/tmp/verdigris-v3/v3-verbs/${level.id}-${mode}.json`, JSON.stringify(rows, null, 2));
		}
	}
	await output.writeBenchJson(`/tmp/verdigris-v3/v3-verbs/${level.id}-${mode}.json`, JSON.stringify(rows, null, 2));
	if (mode === 'canonical') for (const r of rows) { expect(r.result.cleared).toBe(true); expect(r.result.dewdrops).toBe(3); }
	else if (mode === 'naive') for (const r of rows) expect(r.result.cleared, r.name).toBe(false);
	else expect(rows.filter(r => r.result.cleared).length).toBeGreaterThanOrEqual(9);
}, 570_000);

const output = commands as unknown as { writeBenchJson(path: string, json: string): Promise<void> };
const enabled = import.meta.env.VITE_SOLVER_RUN === 'vents';
const percentile = (xs: number[], p: number) => [...xs].sort((a, b) => a - b)[Math.floor((xs.length - 1) * p)];
it.skipIf(!enabled)('measures source reconfigure against line splats without resetting velocity', async () => {
	const results = [];
	for (const mechanism of ['sources', 'splats'] as const) {
		const canvas = document.createElement('canvas');
		canvas.width = 960; canvas.height = 600;
		const engine = createSteppedFluidEngine({ canvas, config: { pointerInput: false, initialSplatCount: 0, simResolution: 96, dyeResolution: 384, bloom: false, sunrays: false, shading: false, curl: 4 } });
		const source = (v: number): FluidConfig => ({ flow: { sources: [{ kind: 'line', from: { x: .3, y: .5 }, to: { x: .3, y: .7 }, velocity: { x: v, y: 0 }, rate: .7, radius: 1 }] } });
		const changeMs: number[] = [], intervals: number[] = [];
		let previous = 0;
		for (let tick = 0; tick < 180; tick++) {
			await new Promise<void>(resolve => requestAnimationFrame(now => { if (previous) intervals.push(now - previous); previous = now; resolve(); }));
			const start = performance.now();
			if (mechanism === 'sources' && tick % 15 === 0) engine.setConfig(source(tick % 30 ? 0 : 19.2));
			if (mechanism === 'splats' && tick % 30 < 15) for (let i = 0; i < 6; i++) engine.splat(.3, .5 + i * .04, 19.2 / 60, 0, { r: 0, g: 0, b: 0 });
			if (tick % 15 === 0) changeMs.push(performance.now() - start);
			engine.advance(1, 1 / 60); engine.renderOnce();
		}
		results.push({ mechanism, changeMs, intervals, changeP50: percentile(changeMs, .5), changeP95: percentile(changeMs, .95), frameP50: percentile(intervals, .5), frameP95: percentile(intervals, .95), dropped: intervals.filter(n => n > 25).length });
		engine.dispose();
	}
	await output.writeBenchJson('/tmp/verdigris-v3/v3-verbs/vent-mechanism.json', JSON.stringify(results, null, 2));
	expect(results[0].changeP95).toBeLessThan(16.7);
}, 60_000);
