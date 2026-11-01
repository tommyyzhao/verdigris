import { describe, expect, it } from 'vitest';
import { commands } from 'vitest/browser';
import { LEVELS } from '../levels.js';
import { evaluate, type Outcome } from './evaluate.js';

const output = commands as unknown as {
	writeBenchJson(path: string, json: string): Promise<void>;
};
const OUT = '/tmp/verdigris-v3/solver';
const long = import.meta.env.VITE_SOLVER_RUN;

describe('real-engine evaluator', () => {
	it('does not stop a settled pool at its delayed release action', async () => {
		const level = LEVELS.find(level => level.id === 'bring-it-back')!;
		const timeline = level.solution.map(entry => ({ ...entry, tick: entry.tick + 180 }));
		const result = await evaluate(level, timeline, 1, { cap: 900, earlyStop: true });
		expect(result.cleared).toBe(true);
	});
	it('drains final fences without rendering', async () => {
		const result = await evaluate(LEVELS[0], [], 1, { cap: 6 });
		expect(result.observed).toBe(6);
		expect(result.cleared).toBe(false);
		expect(result.maxSensorLag).toBeLessThanOrEqual(3);
	});
	it('delivers every sensor at its fixed boundary, independent of readiness', async () => {
		for (const lag of [2, 3, 4] as const) {
			let currentTick = 0,
				frames = 0;
			const result = await evaluate(LEVELS[0], [], 1, {
				cap: 8,
				lag,
				queueDepth: 4,
				onTick({ room }) {
					currentTick = room.view().tick;
				},
				onSensors(frame) {
					frames++;
					expect(currentTick + 1 - frame.tick).toBe(lag);
				},
			});
			expect(result.delivered).toBe(8 - lag);
			expect(frames).toBe(8 - lag);
		}
	});
	it.skipIf(long !== 'pacing')(
		'real-frame-paced fixed-lag stalls',
		async () => {
			const rows = [];
			for (const lag of [2, 3, 4] as const)
				for (let repeat = 0; repeat < 3; repeat++) {
					const result = await evaluate(LEVELS[1], LEVELS[1].solution, 1, {
						cap: 300,
						lag,
						framePaced: true,
						hashParticles: true,
					});
					rows.push({ lag, repeat, result });
					await output.writeBenchJson(
						`${OUT}/frame-pacing.json`,
						JSON.stringify(rows, null, 2)
					);
				}
		},
		570_000
	);
	it.skipIf(long !== 'determinism')(
		'fixed-lag coupling is bitwise stable across queue depths',
		async () => {
			const outcomes: Outcome[] = [];
			for (const depth of [1, 2, 4] as const)
				for (let repeat = 0; repeat < 3; repeat++) {
					const result = await evaluate(LEVELS[1], LEVELS[1].solution, 1, {
						cap: 300,
						queueDepth: depth,
						profile: true,
						hashParticles: true,
					});
					outcomes.push(result);
					await output.writeBenchJson(
						`${OUT}/determinism.json`,
						JSON.stringify(outcomes, null, 2)
					);
					expect(result.particleHash).toBe(outcomes[0].particleHash);
					expect(result.urns).toEqual(outcomes[0].urns);
				}
		},
		570_000
	);
	it.skipIf(long !== 'fixed-throughput')(
		'fixed-lag throughput and concurrency calibration',
		async () => {
			const rows = [];
			for (const batch of [1, 2, 4])
				for (const depth of [1, 2, 4] as const) {
					const started = performance.now();
					const outcomes = await Promise.all(
						Array.from({ length: batch }, (_, i) =>
							evaluate(LEVELS[1], LEVELS[1].solution, 1, {
								cap: 180,
								queueDepth: depth,
								hashParticles: true,
							})
						)
					);
					const wallMs = performance.now() - started;
					rows.push({
						batch,
						depth,
						wallMs,
						speed:
							outcomes.reduce((a, r) => a + r.ticks / 60, 0) / (wallMs / 1000),
						outcomes,
					});
					await output.writeBenchJson(
						`${OUT}/fixed-throughput.json`,
						JSON.stringify(rows, null, 2)
					);
					expect(new Set(outcomes.map((r) => r.particleHash)).size).toBe(1);
				}
		},
		570_000
	);
	it.skipIf(long !== 'throughput')(
		'throughput and queue-depth calibration',
		async () => {
			const rows: {
				batch: number;
				depth: 1 | 2 | 3;
				wallMs: number;
				speed: number;
				outcomes: Outcome[];
			}[] = [];
			for (const batch of [1, 2, 4])
				for (const depth of [1, 2, 3] as const) {
					const started = performance.now();
					const outcomes = await Promise.all(
						Array.from({ length: batch }, (_, i) =>
							evaluate(LEVELS[1], LEVELS[1].solution, i + 1, {
								cap: 180,
								queueDepth: depth,
								coupling: 'legacy',
							})
						)
					);
					const wallMs = performance.now() - started;
					const row = {
						batch,
						depth,
						wallMs,
						speed:
							outcomes.reduce((a, r) => a + r.ticks / 60, 0) / (wallMs / 1000),
						outcomes,
					};
					rows.push(row);
					console.info(
						'THROUGHPUT',
						JSON.stringify({ batch, depth, wallMs, speed: row.speed })
					);
					await output.writeBenchJson(
						`${OUT}/throughput.json`,
						JSON.stringify(rows, null, 2)
					);
				}
		},
		570_000
	);
});
