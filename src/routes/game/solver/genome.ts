import { sweep } from '../rooms/kit.js';
import type { Action, Level, Vec } from '../types.js';

export type Gene =
	| { kind: 'pour'; spring: string; x: number; start: number; duration: number }
	| { kind: 'sweep'; from: Vec; to: Vec; start: number; ticks: number }
	| {
			kind: 'edit';
			start: number;
			action: Exclude<Action, { type: 'pour' | 'stir' }>;
	  };
export type Genome = readonly Gene[];
export const GRID = 6;
export const seeded = (seed: number) => () => {
	seed = (Math.imul(1664525, seed) + 1013904223) >>> 0;
	return seed / 4294967296;
};
const clamp = (v: number, lo: number, hi: number) =>
	Math.max(lo, Math.min(hi, v));
const grid = (v: number) => Math.max(0, Math.round(v / GRID) * GRID);
const point = (p: Vec): Vec => ({ x: clamp(p.x, 0, 48), y: clamp(p.y, 0, 30) });

/** Conservative static resource bounds; model.act remains the authority for wet/dry terrain. */
export function normalize(
	level: Level,
	genome: Genome,
	horizon = 1200
): Gene[] {
	if (!Number.isInteger(horizon) || horizon < GRID)
		throw new RangeError('Invalid genome horizon');
	const remaining = new Map(
		level.springs.map((s) => [s.id, Math.floor((s.well * 60) / s.rate)])
	);
	const result: Gene[] = [];
	let pouringUntil = 0,
		ink = level.ink;
	for (const g of [...genome].sort((a, b) => a.start - b.start)) {
		if (!Number.isFinite(g.start)) continue;
		const start = Math.min(grid(g.start), horizon - GRID);
		if (g.kind === 'pour') {
			const spring = level.springs.find((s) => s.id === g.spring);
			if (!spring || !Number.isFinite(g.x) || !Number.isFinite(g.duration))
				continue;
			const from = Math.max(start, pouringUntil);
			const duration = Math.min(
				grid(g.duration),
				remaining.get(g.spring)!,
				horizon - from
			);
			if (duration < 1) continue;
			result.push({
				...g,
				start: from,
				duration,
				x: clamp(g.x, spring.zone.x, spring.zone.x + spring.zone.w),
			});
			remaining.set(g.spring, remaining.get(g.spring)! - duration);
			pouringUntil = from + duration;
		} else if (g.kind === 'sweep') {
			if (![g.ticks, g.from.x, g.from.y, g.to.x, g.to.y].every(Number.isFinite))
				continue;
			result.push({
				...g,
				start,
				ticks: Math.min(Math.max(GRID, grid(g.ticks)), horizon - start),
				from: point(g.from),
				to: point(g.to),
			});
		} else {
			const a = g.action;
			if (a.type === 'ink') {
				if (
					![a.from.x, a.from.y, a.to.x, a.to.y].every(Number.isFinite) ||
					!Number.isSafeInteger(a.stroke) ||
					a.stroke < 0
				)
					continue;
				// Bounding box overestimates the two-cell stroke, so actual cost cannot exceed budget.
				const from = point(a.from),
					to = point(a.to);
				const cost =
					(Math.ceil(Math.abs(to.x - from.x) * 4) + 3) *
					(Math.ceil(Math.abs(to.y - from.y) * 4) + 3);
				if (cost > ink) continue;
				ink -= cost;
				result.push({ kind: 'edit', start, action: { ...a, from, to } });
			} else if (a.type === 'dig') {
				if (level.dig && [a.at.x, a.at.y, a.radius].every(Number.isFinite))
					result.push({
						kind: 'edit',
						start,
						action: { ...a, at: point(a.at), radius: clamp(a.radius, 0.25, 3) },
					});
			} else if (a.type === 'toggle') {
				if (
					level.gates.some(
						(gate) => gate.id === a.id && gate.driver.kind === 'player'
					) || level.vents.some(v => v.id === a.id && v.control?.kind === 'switch')
				)
					result.push({ ...g, start });
			} else if (a.type === 'pose') {
				const plank = level.planks.find((p) => p.id === a.id);
				const vent = level.vents.find(v => v.id === a.id && v.control?.kind === 'turn');
				const count = plank?.angles.length ?? (vent?.control?.kind === 'turn' ? vent.control.velocities.length : 0);
				if (
					count > 0 &&
					Number.isInteger(a.index) &&
					a.index >= 0 &&
					a.index < count
				)
					result.push({ ...g, start });
			} else if (
				a.type === 'erase' &&
				Number.isSafeInteger(a.stroke) &&
				a.stroke >= 0
			)
				result.push({ ...g, start });
		}
	}
	return result.sort((a, b) => a.start - b.start);
}

export function compile(
	level: Level,
	genome: Genome,
	horizon = 1200
): Level['solution'] {
	return normalize(level, genome, horizon)
		.flatMap((g): { tick: number; action: Action }[] => {
			if (g.kind === 'sweep') return sweep(g.start, g.from, g.to, g.ticks);
			if (g.kind === 'edit') return [{ tick: g.start, action: g.action }];
			const spring = level.springs.find((s) => s.id === g.spring)!;
			return [
				{
					tick: g.start,
					action: {
						type: 'pour',
						spring: g.spring,
						at: { x: g.x, y: spring.zone.y + spring.zone.h / 2 },
					},
				},
				{ tick: g.start + g.duration, action: { type: 'pour', spring: null } },
			];
		})
		.sort((a, b) => a.tick - b.tick);
}

export function randomGenome(
	level: Level,
	rand: () => number,
	horizon = 1200
): Gene[] {
	const genes: Gene[] = [];
	const n = 1 + Math.floor(rand() * 8);
	for (let i = 0; i < n; i++) {
		const spring = level.springs[Math.floor(rand() * level.springs.length)];
		const start = Math.floor(rand() * Math.max(1, horizon - 240));
		if (spring) genes.push({
			kind: 'pour',
			spring: spring.id,
			x: spring.zone.x + rand() * spring.zone.w,
			start,
			duration: 24 + Math.floor(rand() * 216),
		});
		if (rand() < 0.65) {
			const from = { x: rand() * 40, y: 5 + rand() * 15 };
			genes.push({
				kind: 'sweep',
				start: Math.max(0, start - 24),
				from,
				to: {
					x: clamp(from.x + (rand() * 2 - 1) * 24, 0, 48),
					y: clamp(from.y + (rand() * 2 - 1) * 10, 0, 30),
				},
				ticks: 6 + Math.floor(rand() * 30),
			});
		}
	}
	for (const v of level.vents) {
		if (!v.control || rand() >= 0.5) continue;
		genes.push({ kind: 'edit', start: Math.floor(rand() * horizon / 2), action: v.control.kind === 'switch' ? { type: 'toggle', id: v.id } : { type: 'pose', id: v.id, index: Math.floor(rand() * v.control.velocities.length) } });
	}
	for (const gate of level.gates) {
		if (gate.driver.kind !== 'player' || rand() >= 0.5) continue;
		genes.push({ kind: 'edit', start: Math.floor(rand() * horizon / 2), action: { type: 'toggle', id: gate.id } });
	}
	return normalize(level, genes, horizon);
}

export function mutate(
	level: Level,
	genome: Genome,
	rand: () => number,
	horizon = 1200
): Gene[] {
	// ponytail: autonomous wax/dig topology needs a spatial search.
	if (rand() < 0.15) {
		const controls = randomGenome(level, rand, horizon).filter(
			(g) => g.kind === 'edit' && (g.action.type === 'toggle' || g.action.type === 'pose')
		);
		if (controls.length) return normalize(level, [...genome, controls[Math.floor(rand() * controls.length)]], horizon);
	}
	if (!genome.length || rand() < 0.15)
		return normalize(
			level,
			[...genome, ...randomGenome(level, rand, horizon).slice(0, 2)],
			horizon
		);
	const index = Math.floor(rand() * genome.length);
	const child = structuredClone([...genome]);
	if (rand() < 0.15 && child.length > 1) child.splice(index, 1);
	else {
		const g = child[index];
		g.start += Math.round((rand() * 2 - 1) * 60);
		if (g.kind === 'pour') {
			g.x += (rand() * 2 - 1) * 2;
			g.duration += Math.round((rand() * 2 - 1) * 48);
		}
		if (g.kind === 'edit' && g.action.type === 'pose') {
			const v = level.vents.find(v => v.id === (g.action as { id: string }).id);
			if (v?.control?.kind === 'turn') g.action.index = Math.floor(rand() * v.control.velocities.length);
		}
		if (g.kind === 'sweep') {
			g.from.x += (rand() * 2 - 1) * 3;
			g.to.x += (rand() * 2 - 1) * 3;
			g.from.y += (rand() * 2 - 1) * 2;
			g.to.y += (rand() * 2 - 1) * 2;
			g.ticks += Math.round((rand() * 2 - 1) * 12);
		}
	}
	return normalize(level, child, horizon);
}
export function crossover(
	level: Level,
	a: Genome,
	b: Genome,
	rand: () => number,
	horizon = 1200
): Gene[] {
	return normalize(
		level,
		[...a.filter(() => rand() < 0.5), ...b.filter(() => rand() < 0.5)],
		horizon
	);
}

/** Convert intended plans into segments; optional warm starts must be labeled, never mixed into blind baselines. */
export function fromTimeline(timeline: Level['solution']): Gene[] {
	const genes: Gene[] = [];
	let pouring: Extract<Gene, { kind: 'pour' }> | undefined;
	for (const { tick, action } of timeline) {
		if (action.type === 'pour') {
			if (pouring) {
				pouring.duration = tick - pouring.start;
				genes.push(pouring);
			}
			pouring = action.spring
				? {
						kind: 'pour',
						spring: action.spring,
						x: action.at?.x ?? 0,
						start: tick,
						duration: 0,
				  }
				: undefined;
		} else if (action.type === 'stir') {
			const previous = genes.at(-1);
			if (
				previous?.kind === 'sweep' &&
				previous.start + previous.ticks === tick &&
				Math.hypot(
					previous.to.x - action.from.x,
					previous.to.y - action.from.y
				) < 1e-6
			) {
				previous.to = action.to;
				previous.ticks++;
			} else
				genes.push({
					kind: 'sweep',
					start: tick,
					ticks: 1,
					from: action.from,
					to: action.to,
				});
		} else genes.push({ kind: 'edit', start: tick, action });
	}
	return genes;
}

export function naivePlans(
	level: Level,
	positions = 5,
	horizon = 1200
): { name: string; timeline: Level['solution']; airOff?: boolean }[] {
	const plans: ReturnType<typeof naivePlans> = [
		{ name: 'idle', timeline: [] },
		{ name: 'air-off', timeline: level.solution.filter(e => e.action.type !== 'stir'), airOff: true },
		{ name: 'gravity-only', timeline: level.solution.filter(e => e.action.type === 'pour') },
		{
			name: 'no-stir',
			timeline: level.solution.filter((e) => e.action.type !== 'stir'),
		},
	];
	const dump = (springs: typeof level.springs, fraction: number) => {
		let start = 0;
		return compile(
			level,
			springs.map((s) => {
				const g: Gene = {
					kind: 'pour',
					spring: s.id,
					x: s.zone.x + s.zone.w * fraction,
					start,
					duration: Math.ceil((s.well / s.rate) * 60),
				};
				start += g.duration + GRID;
				return g;
			}),
			horizon
		);
	};
	for (let k = 0; k < positions; k++)
		plans.push({
			name: `dump-all-${k}`,
			timeline: dump(level.springs, (k + 0.5) / positions),
		});
	for (const s of level.springs)
		plans.push({ name: `single-${s.id}`, timeline: dump([s], 0.9) });
	for (const seed of [194, 719]) {
		const rand = seeded(seed);
		const timeline = [...dump(level.springs, 0.9)];
		for (let tick = 0; tick < horizon; tick += 6)
			timeline.push({
				tick,
				action: {
					type: 'stir',
					from: { x: rand() * 48, y: rand() * 20 },
					to: { x: rand() * 48, y: rand() * 20 },
				},
			});
		plans.push({
			name: `random-stir-${seed}`,
			timeline: timeline.sort((a, b) => a.tick - b.tick),
		});
	}
	return plans;
}
