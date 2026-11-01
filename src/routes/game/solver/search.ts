import type { Level } from '../types.js';
import type { Outcome, Timeline } from './evaluate.js';
import {
	compile,
	crossover,
	mutate,
	randomGenome,
	seeded,
	type Genome,
} from './genome.js';

export interface Candidate {
	genome: Genome;
	timeline: Timeline;
	outcome: Outcome;
	fitness: number;
	cell: string;
}
export type Evaluate = (timeline: Timeline, seed: number) => Promise<Outcome>;
export interface SearchOptions {
	budget: number;
	seed: number;
	horizon?: number;
	/** Explicitly label this as a warm search when supplied. */
	warm?: Genome;
	/** Replay seeded variation choices from saved evaluations, without repeating GPU work. */
	previous?: Candidate[];
	onEvaluation?(candidate: Candidate, index: number): Promise<void> | void;
}

/** Simultaneous final recipe coverage, not historical maxima (which reward incompatible transient fills). */
export function fitness(level: Level, result: Outcome): number {
	let progress = 0,
		contamination = 0;
	const targets = [...level.urns, ...level.seeds];
	for (const target of targets) {
		const u = [...result.urns, ...result.seedViews].find(
			(u) => u.id === target.id
		);
		if (!u) continue;
		const parts = target.recipe.mix.reduce((a, b) => a + b, 0);
		for (let s = 0; s < 3; s++) {
			const wanted = (target.recipe.amount * target.recipe.mix[s]) / parts;
			if (wanted)
				progress +=
					Math.min(1, u.counts[s] / 64 / wanted) /
					target.recipe.mix.filter(Boolean).length;
			else contamination += u.counts[s] / 64 / target.recipe.amount;
		}
		if (u.inTune) progress += Math.min(1, u.fill) * 0.25;
	}
	const supply = level.springs.reduce((a, s) => a + s.well, 0) || 1;
	return (
		(result.cleared ? 100 + result.dewdrops : 0) +
		progress / Math.max(1, targets.length) -
		contamination -
		(result.waste / supply) * 0.2 -
		(result.everSpoiled ? 0.3 : 0)
	);
}

/** 8 water-use bins × 8 first-pour positions within that spring × 4 stirring bins. */
export function cell(level: Level, result: Outcome): string {
	const supply = level.springs.reduce((a, s) => a + s.well, 0) || 1;
	const spring = level.springs.find(
		(s) =>
			result.descriptor.firstPourX >= s.zone.x &&
			result.descriptor.firstPourX <= s.zone.x + s.zone.w
	);
	const x = spring
		? (result.descriptor.firstPourX - spring.zone.x) / spring.zone.w
		: 0;
	const bin = (v: number, n: number) =>
		Math.min(n - 1, Math.max(0, Math.floor(v * n)));
	return `${bin(result.descriptor.waterUsed / supply, 8)},${bin(
		x,
		8
	)},${Math.min(3, Math.ceil(result.descriptor.stirTicks / 32))}`;
}

export function insert(
	archive: Map<string, Candidate>,
	candidate: Candidate
): boolean {
	const old = archive.get(candidate.cell);
	if (
		old &&
		((old.outcome.cleared && !candidate.outcome.cleared) ||
			(old.outcome.cleared === candidate.outcome.cleared &&
				old.fitness >= candidate.fitness))
	)
		return false;
	archive.set(candidate.cell, candidate);
	return true;
}

/** Every mode spends exactly budget real-engine evaluations; no hidden warm-up or revalidation. */
export async function search(
	level: Level,
	mode: 'random' | 'ga' | 'map-elites',
	evaluate: Evaluate,
	options: SearchOptions
): Promise<{
	mode: string;
	warm: boolean;
	budget: number;
	evaluations: Candidate[];
	archive: Candidate[];
	best: Candidate | null;
}> {
	if (!Number.isInteger(options.budget) || options.budget < 0)
		throw new RangeError('Invalid search budget');
	const rand = seeded(options.seed),
		horizon = options.horizon ?? 1200;
	const evaluations: Candidate[] = [],
		archive = new Map<string, Candidate>();
	let population: Candidate[] = [];
	const choose = (xs: Candidate[]) => xs[Math.floor(rand() * xs.length)];
	for (let i = 0; i < options.budget; i++) {
		let genome: Genome;
		if (i === 0 && options.warm) genome = options.warm;
		else if (
			mode === 'random' ||
			!population.length ||
			(!options.warm && i < 4) ||
			rand() < 0.15
		)
			genome = randomGenome(level, rand, horizon);
		else {
			const parents =
				mode === 'map-elites' ? [...archive.values()] : population;
			const parent = choose(parents).genome;
			genome = mutate(
				level,
				rand() < 0.35
					? crossover(level, parent, choose(parents).genome, rand, horizon)
					: parent,
				rand,
				horizon
			);
		}
		const timeline = compile(level, genome, horizon);
		const saved = options.previous?.[i];
		if (saved && JSON.stringify(saved.timeline) !== JSON.stringify(timeline))
			throw new Error(`Search checkpoint mismatch at evaluation ${i}`);
		const outcome =
			saved?.outcome ?? (await evaluate(timeline, (options.seed + i) >>> 0));
		const candidate = {
			genome,
			timeline,
			outcome,
			fitness: fitness(level, outcome),
			cell: cell(level, outcome),
		};
		evaluations.push(candidate);
		insert(archive, candidate);
		population = [...population, candidate]
			.sort((a, b) => b.fitness - a.fitness)
			.slice(0, 16);
		if (!saved) await options.onEvaluation?.(candidate, i);
	}
	return {
		mode,
		warm: !!options.warm,
		budget: options.budget,
		evaluations,
		archive: [...archive.values()],
		best: population[0] ?? null,
	};
}
