import { describe, expect, it } from 'vitest';
import { LEVELS, sweep } from '../levels.js';
import { createRoom } from '../model.js';
import type { Level } from '../types.js';
import {
	compile,
	crossover,
	fromTimeline,
	mutate,
	naivePlans,
	normalize,
	randomGenome,
	seeded,
	type Gene,
} from './genome.js';
import { cell, fitness, insert, search, type Candidate } from './search.js';
import type { Outcome } from './evaluate.js';

function outcome(): Outcome {
	const v = createRoom(LEVELS[0]).view();
	return {
		id: LEVELS[0].id,
		seed: 1,
		cleared: false,
		termination: 'cap',
		dewdrops: 0,
		ticks: 0,
		observed: 0,
		delivered: 0,
		particleHash: null,
		profile: {
			jsMs: 0,
			frameIntervalsMs: [],
			fenceWaitMs: 0,
			stallMs: [],
			liquidGpuMs: [],
			airGpuMs: [],
		},
		maxSensorLag: 0,
		wallMs: 0,
		simulatedSecondsPerWallSecond: 0,
		waste: 0,
		urns: v.urns,
		seedViews: v.seedViews,
		maxUrns: {},
		springs: v.springs,
		seeds: {},
		brambles: {},
		stuck: false,
		everSpoiled: false,
		inkUsed: 0,
		reserve: 1,
		route: {},
		routeSignature: '',
		descriptor: { waterUsed: 0, firstPourX: 8, stirTicks: 0, regions: 0 },
	};
}

describe('seeded action genome', () => {
	it.each(LEVELS)('samples player gates independently in $id', (level) => {
		const rand = seeded(71429);
		const genomes = Array.from({ length: 1000 }, () => randomGenome(level, rand));
		for (const gate of level.gates.filter(g => g.driver.kind === 'player')) {
			const count = genomes.filter(genes => genes.some(g => g.kind === 'edit' && g.action.type === 'toggle' && g.action.id === gate.id)).length;
			expect(count).toBeGreaterThan(440);
			expect(count).toBeLessThan(560);
		}
	});
	it.each(['still-pond', 'bring-it-back'])('generates and mutates sweeps without springs in %s', id => {
		const level = LEVELS.find(l => l.id === id)!;
		expect(level.springs).toHaveLength(0);
		const generated = Array.from({ length: 50 }, (_, seed) => randomGenome(level, seeded(seed + 1)));
		expect(generated.some(genes => genes.some(g => g.kind === 'sweep'))).toBe(true);
		const edits = generated.flat().filter(g => g.kind === 'edit').slice(0, 1);
		expect(Array.from({ length: 50 }, (_, seed) => mutate(level, edits, seeded((seed + 1) * 71429))).some(genes => genes.some(g => g.kind === 'sweep'))).toBe(true);
	});
	it('generates and validates switch and turn vent genes', () => {
		const base = { from: { x: 4, y: 4 }, to: { x: 4, y: 8 }, velocity: { x: 6, y: 0 } };
		const level: Level = { ...LEVELS[0], vents: [
			{ ...base, id: 'switch', control: { kind: 'switch', on: false } },
			{ ...base, id: 'turn', control: { kind: 'turn', velocities: [{ x: 0, y: 0 }, { x: 8, y: 0 }], index: 0 } }
		] };
		const timeline = Array.from({ length: 100 }, (_, i) => compile(level, randomGenome(level, seeded(i + 1)))).flat();
		expect(timeline.some(e => e.action.type === 'toggle' && e.action.id === 'switch')).toBe(true);
		expect(timeline.some(e => e.action.type === 'pose' && e.action.id === 'turn')).toBe(true);
		expect(compile(level, [{ kind: 'edit', start: 0, action: { type: 'pose', id: 'turn', index: 2 } }])).toEqual([]);
	});
	it('blind generation explores a pool release after the correct turn heading', () => {
		const level = LEVELS.find(l => l.id === 'bring-it-back')!;
		let intended = 0;
		for (let seed = 1; seed <= 100; seed++) {
			const timeline = compile(level, randomGenome(level, seeded(seed)));
			const pose = timeline.find(e => e.action.type === 'pose' && e.action.id === 'return-draft' && e.action.index === 1);
			const gate = timeline.find(e => e.action.type === 'toggle' && e.action.id === 'pool-release');
			if (pose && gate && pose.tick < gate.tick) intended++;
		}
		expect(intended).toBeGreaterThan(1);
	});
	it('uses the exact sweep semantics and round-trips authored pours', () => {
		const level = LEVELS[0];
		expect(
			compile(level, [
				{
					kind: 'sweep',
					start: 0,
					from: { x: 1, y: 2 },
					to: { x: 7, y: 8 },
					ticks: 6,
				},
			])
		).toEqual(sweep(0, { x: 1, y: 2 }, { x: 7, y: 8 }, 6));
		expect(compile(level, fromTimeline(level.solution))).toEqual(
			level.solution
		);
		expect(
			fromTimeline(LEVELS[1].solution).filter((g) => g.kind === 'sweep')
		).toHaveLength(0);
		expect(compile(LEVELS[1], fromTimeline(LEVELS[1].solution))[0]).toEqual(LEVELS[1].solution[0]);
	});
	it('bounds supply, pointer domain, schedule overlap, terrain permissions, and ink', () => {
		const level = LEVELS.find(l => l.id === 'two-springs')!;
		const genome: Gene[] = [
			{ kind: 'pour', spring: 'dew', x: -100, start: -10, duration: 9999 },
			{ kind: 'pour', spring: 'dew', x: 100, start: 0, duration: 9999 },
			{ kind: 'pour', spring: 'sap', x: 100, start: 0, duration: 9999 },
			{
				kind: 'edit',
				start: 1,
				action: {
					type: 'ink',
					stroke: 1,
					from: { x: 0, y: 0 },
					to: { x: 48, y: 30 },
				},
			},
			{
				kind: 'edit',
				start: 1,
				action: { type: 'dig', at: { x: 1, y: 1 }, radius: 2 },
			},
			{ kind: 'edit', start: 1, action: { type: 'toggle', id: 'missing' } },
		];
		const result = normalize(level, genome);
		expect(result).toHaveLength(2);
		expect(result[0]).toMatchObject({
			kind: 'pour',
			start: 0,
			duration: 192,
			x: 7,
		});
		expect(result[1]).toMatchObject({
			kind: 'pour',
			start: 192,
			duration: 336,
			x: 40,
		});
		const room = createRoom(level);
		const timeline = compile(level, result);
		for (let tick = 0; tick < 1200; tick++) {
			for (const e of timeline) if (e.tick === tick) room.act(e.action);
			room.planTick();
		}
		expect(room.view().springs.dew).toBeCloseTo(0);
		expect(room.view().springs.sap).toBeCloseTo(0);
	});
	it('compiles legal wax, dig, plug and pose genes through the game vocabulary', () => {
		const level = { ...LEVELS.find(l => l.id === 'two-springs')!, dig: true, ink: 24 };
		const genes: Gene[] = [
			{
				kind: 'edit',
				start: 0,
				action: {
					type: 'ink',
					stroke: 1,
					from: { x: 4, y: 4 },
					to: { x: 4.25, y: 4 },
				},
			},
			{
				kind: 'edit',
				start: 6,
				action: { type: 'dig', at: { x: 2, y: 2 }, radius: 1 },
			},
			{
				kind: 'edit',
				start: 12,
				action: { type: 'toggle', id: level.gates[0].id },
			},
			{
				kind: 'edit',
				start: 18,
				action: { type: 'pose', id: level.planks[0].id, index: 0 },
			},
			{ kind: 'edit', start: 24, action: { type: 'erase', stroke: 1 } },
		];
		expect(compile(level, genes).map((e) => e.action.type)).toEqual([
			'ink',
			'dig',
			'toggle',
			'pose',
			'erase',
		]);
		const room = createRoom(level);
		for (const e of compile(level, genes)) room.act(e.action);
		expect(room.view().inkUsed).toBeLessThanOrEqual(level.ink);
	});
	it('operators are seeded, pure, and resource-safe across 100 generations', () => {
		const level = LEVELS.find(l => l.id === 'two-springs')!,
			a = seeded(79),
			b = seeded(79);
		let genome = randomGenome(level, a);
		expect(genome).toEqual(randomGenome(level, b));
		for (let i = 0; i < 100; i++) {
			const original = JSON.stringify(genome);
			const other = randomGenome(level, a);
			const child = mutate(level, crossover(level, genome, other, a), a);
			expect(JSON.stringify(genome)).toBe(original);
			for (const s of level.springs) {
				const used = child
					.filter((g) => g.kind === 'pour' && g.spring === s.id)
					.reduce((sum, g) => sum + (g.kind === 'pour' ? g.duration : 0), 0);
				expect((used * s.rate) / 60).toBeLessThanOrEqual(s.well + 1e-9);
			}
			genome = child;
		}
	});
	it('naive suite covers every spring, fixed positions, no-stir, and random stir', () => {
		const plans = naivePlans(LEVELS.find(l => l.id === 'two-springs')!);
		expect(plans).toHaveLength(13);
		expect(plans.find(p => p.name === 'air-off')).toMatchObject({ airOff: true });
		expect(
			plans
				.find((p) => p.name === 'no-stir')!
				.timeline.some((e) => e.action.type === 'stir')
		).toBe(false);
		expect(plans.find((p) => p.name === 'random-stir-194')!.timeline).toEqual(
			naivePlans(LEVELS.find(l => l.id === 'two-springs')!).find((p) => p.name === 'random-stir-194')!.timeline
		);
	});
});

describe('fitness and MAP-Elites', () => {
	it('rewards simultaneous coverage, penalizes waste/spoil, prioritizes clears', () => {
		const empty = outcome();
		const full = {
			...empty,
			urns: [
				{
					...empty.urns[0],
					counts: [1536, 0, 0] as const,
					units: 24,
					fill: 1,
					inTune: true,
				},
			],
		};
		expect(fitness(LEVELS[0], full)).toBeGreaterThan(fitness(LEVELS[0], empty));
		expect(
			fitness(LEVELS[0], { ...full, waste: 20, everSpoiled: true })
		).toBeLessThan(fitness(LEVELS[0], full));
		expect(
			fitness(LEVELS[0], { ...empty, cleared: true, dewdrops: 1 })
		).toBeGreaterThan(fitness(LEVELS[0], full));
	});
	it('bins boundaries and never replaces a clear with a failure', () => {
		const result = outcome();
		expect(cell(LEVELS[0], result)).toBe('0,0,0');
		expect(
			cell(LEVELS[0], {
				...result,
				descriptor: {
					...result.descriptor,
					waterUsed: 36,
					firstPourX: 22,
					stirTicks: 500,
				},
			})
		).toBe('7,7,3');
		const archive = new Map<string, Candidate>();
		const c: Candidate = {
			genome: [],
			timeline: [],
			outcome: { ...result, cleared: true },
			fitness: 1,
			cell: '0,0,0',
		};
		expect(insert(archive, c)).toBe(true);
		expect(insert(archive, { ...c, outcome: result, fitness: 100 })).toBe(
			false
		);
		expect(archive.get(c.cell)).toBe(c);
		archive.clear();
		insert(archive, { ...c, outcome: result, fitness: 100 });
		expect(insert(archive, c)).toBe(true);
	});
	it('resumes an interrupted search without repeating or changing evaluations', async () => {
		let calls = 0;
		const evaluate = async () => {
			calls++;
			return outcome();
		};
		const full = await search(LEVELS[0], 'ga', evaluate, {
			budget: 8,
			seed: 3,
		});
		calls = 0;
		const resumed = await search(LEVELS[0], 'ga', evaluate, {
			budget: 8,
			seed: 3,
			previous: full.evaluations.slice(0, 5),
		});
		expect(calls).toBe(3);
		expect(resumed.evaluations.map((c) => c.timeline)).toEqual(
			full.evaluations.map((c) => c.timeline)
		);
		await expect(
			search(LEVELS[0], 'ga', evaluate, {
				budget: 2,
				seed: 4,
				previous: full.evaluations,
			})
		).rejects.toThrow('checkpoint mismatch');
	});
	for (const mode of ['random', 'ga', 'map-elites'] as const)
		it(`${mode} spends exactly its stated budget`, async () => {
			let calls = 0;
			const run = () =>
				search(
					LEVELS[0],
					mode,
					async () => {
						calls++;
						return outcome();
					},
					{ budget: 9, seed: 7 }
				);
			const a = await run();
			expect(calls).toBe(9);
			expect(a.evaluations).toHaveLength(9);
			expect((await run()).evaluations.map((c) => c.timeline)).toEqual(
				a.evaluations.map((c) => c.timeline)
			);
			expect(calls).toBe(18);
		});
});
