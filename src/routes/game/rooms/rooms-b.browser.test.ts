import { expect, it } from 'vitest';
import { commands } from 'vitest/browser';
import level from './bring-it-back.js';
import {
	evaluate,
	perturbTimeline,
	replayPng,
	type Outcome,
	type Timeline,
} from '../solver/evaluate.js';
import { naivePlans, seeded } from '../solver/genome.js';

const output = commands as unknown as {
	readSolverCheckpoint(name: string): Promise<string>;
	writeBenchJson(path: string, json: string): Promise<void>;
	writeBenchBase64(path: string, base64: string): Promise<void>;
};
const out = '/tmp/verdigris-v3/rooms/bring-it-back';
const mode = import.meta.env.VITE_ROOMS_B_RUN ?? '';
const gate = (tick: number) => ({
	tick,
	action: { type: 'toggle' as const, id: 'pool-release' },
});
const heading = (tick: number, index: number) => ({
	tick,
	action: { type: 'pose' as const, id: 'return-draft', index },
});

it('bring-it-back canonical seeds and air-off', async () => {
	const rows = [];
	for (const seed of [1, 71, 429]) {
		const outcome = await evaluate(level, level.solution, seed, { cap: 900 });
		rows.push({ seed, outcome });
		expect(outcome.cleared).toBe(true);
		expect(outcome.dewdrops).toBe(3);
	}
	const airOff = await evaluate(level, level.solution, 1, {
		cap: 900,
		airOff: true,
	});
	rows.push({ seed: 1, outcome: airOff });
	await output.writeBenchJson(
		`${out}/canonical.json`,
		JSON.stringify(rows, null, 2)
	);
	expect(airOff.cleared).toBe(false);
}, 550000);

it.skipIf(mode !== 'envelope')(
	'bring-it-back perturbation envelope',
	async () => {
		const rows = [];
		for (const [timing, position] of [
			[3, 0.25],
			[6, 0.5],
			[12, 1],
		]) {
			let clears = 0;
			for (let i = 0; i < 10; i++) {
				const seed = 71 + i * 97;
				const timeline = perturbTimeline(
					level.solution,
					seeded(seed),
					timing,
					position
				);
				const outcome = await evaluate(level, timeline, seed, { cap: 900 });
				rows.push({ timing, position, seed, timeline, outcome });
				clears += +outcome.cleared;
				await output.writeBenchJson(
					`${out}/envelope.json`,
					JSON.stringify(rows, null, 2)
				);
			}
			expect(clears).toBeGreaterThanOrEqual(9);
		}
	},
	550000
);

it.skipIf(mode !== 'breakers')(
	'bring-it-back naive and exhaustive controls',
	async () => {
		const rows: { name: string; timeline: Timeline; outcome: Outcome }[] = [];
		const plans = [
			...naivePlans(level).filter((p) => p.name !== 'no-stir'),
			{ name: 'toggle-everything', timeline: [gate(0)] },
			{ name: 'pose-only', timeline: [heading(0, 1)] },
			{ name: 'greedy-fill', timeline: [gate(0)] },
			...[0, 1].flatMap((index) => [
				{
					name: `heading-${index}-then-gate`,
					timeline: [heading(0, index), gate(120)],
				},
				{
					name: `gate-then-heading-${index}`,
					timeline: [gate(0), heading(120, index)],
				},
			]),
		];
		for (const plan of plans) {
			const outcome = await evaluate(level, plan.timeline, 1, {
				cap: 900,
				airOff: 'airOff' in plan && plan.airOff === true,
			});
			rows.push({ ...plan, outcome });
			await output.writeBenchJson(
				`${out}/breakers.json`,
				JSON.stringify(rows, null, 2)
			);
			if (plan.name !== 'heading-1-then-gate')
				expect(outcome.cleared, plan.name).toBe(false);
			else expect(outcome.cleared).toBe(true);
		}
	},
	550000
);

it.skipIf(mode !== 'search-replays')('bring-it-back blind alternative replays preserve both ideas', async () => {
	const rows = [];
	for (const searchMode of ['random', 'map-elites']) {
		const saved = JSON.parse(await output.readSolverCheckpoint(`bring-it-back-${searchMode}`)) as { evaluations: { timeline: Timeline; outcome: Outcome }[] };
		const routes = new Map<string, { index: number; timeline: Timeline }>();
		for (const [index, candidate] of saved.evaluations.entries()) {
			if (!candidate.outcome.cleared) continue;
			const pose = candidate.timeline.find(e => e.action.type === 'pose' && e.action.id === 'return-draft' && e.action.index === 1);
			const release = candidate.timeline.find(e => e.action.type === 'toggle' && e.action.id === 'pool-release');
			expect(pose).toBeDefined();
			expect(release).toBeDefined();
			const delay = pose!.tick - release!.tick;
			const key = `${candidate.outcome.routeSignature}:${delay <= 0 ? 'prepared' : delay}`;
			if (!routes.has(key)) routes.set(key, { index, timeline: candidate.timeline });
		}
		for (const [key, { index, timeline }] of routes) {
			const outcome = await evaluate(level, timeline, 1, { cap: 900, onTick: async state => {
				if (state.room.view().cleared) await output.writeBenchBase64(`${out}/search-${searchMode}-${index}.png`, replayPng(level, state));
			} });
			rows.push({ searchMode, key, index, timeline, outcome });
			await output.writeBenchJson(`${out}/search-replays.json`, JSON.stringify(rows, null, 2));
			expect(outcome.cleared).toBe(true);
		}
	}
}, 550000);

it.skipIf(mode !== 'screenshots')(
	'bring-it-back inspected diagnostic captures',
	async () => {
		for (const [name, timeline] of [
			['canonical', level.solution],
			['greedy', [gate(0)]],
		] as const) {
			await evaluate(level, timeline, 1, {
				cap: 900,
				onTick: async (state) => {
					const tick = state.room.view().tick;
					if (
						(name === 'canonical' && [1, 120, 240].includes(tick)) ||
						(name === 'greedy' && tick === 600) ||
						state.room.view().cleared
					)
						await output.writeBenchBase64(
							`${out}/${name}-${tick}.png`,
							replayPng(level, state)
						);
				},
			});
		}
	},
	550000
);
