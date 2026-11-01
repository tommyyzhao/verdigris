import { expect, it } from 'vitest';
import { commands, page } from 'vitest/browser';
import { mount, tick, unmount } from 'svelte';
import Board from '../Board.svelte';
import hiddenDraft from './hidden-draft.js';
import stillPond from './still-pond.js';
import {
	evaluate,
	perturbTimeline,
	replayPng,
	type Outcome,
} from '../solver/evaluate.js';
import { naivePlans, seeded } from '../solver/genome.js';
import type { Level } from '../types.js';

const output = commands as unknown as {
	writeBenchJson(path: string, json: string): Promise<void>;
	writeBenchBase64(path: string, base64: string): Promise<void>;
	captureCanvasScreenshot(rect: {
		x: number;
		y: number;
		width: number;
		height: number;
	}): Promise<string>;
	setViewport(size: { width: number; height: number }): Promise<void>;
};
const rooms = [hiddenDraft, stillPond];
const selected = import.meta.env.VITE_ROOMS_A_ROOM ?? 'hidden-draft';
const mode = import.meta.env.VITE_ROOMS_A_RUN;
const OUT = `/tmp/verdigris-v3/rooms/${selected}`;
const cap = 1500;
const results: { name: string; outcome: Outcome }[] = [];
async function run(
	level: Level,
	name: string,
	timeline = level.solution,
	seed = 1,
	airOff = false,
	shots = false
) {
	const seen = new Set<string>();
	const outcome = await evaluate(level, timeline, seed, {
		cap,
		airOff,
		onTick: shots
			? async (state) => {
					const tick = state.room.view().tick;
					const tag =
						tick === 1
							? 'first-look'
							: state.room.view().cleared
							? 'clear'
							: tick === (selected === 'still-pond' ? 660 : 420)
							? 'insight'
							: tick === 900
							? 'greedy-stall'
							: null;
					if (tag && !seen.has(tag)) {
						seen.add(tag);
						await output.writeBenchBase64(
							`${OUT}/${name}-${tag}.png`,
							replayPng(level, state)
						);
					}
			  }
			: undefined,
	});
	results.push({ name, outcome });
	await output.writeBenchJson(
		`${OUT}/${mode}.json`,
		JSON.stringify(results, null, 2)
	);
	console.info(
		JSON.stringify({
			name,
			clear: outcome.cleared,
			drops: outcome.dewdrops,
			urn: outcome.maxUrns,
			waste: outcome.waste,
			reserve: outcome.reserve,
			tick: outcome.ticks,
		})
	);
	return outcome;
}

it.skipIf(!mode)(
	'rooms A real-engine acceptance',
	async () => {
		const level = rooms.find((r) => r.id === selected)!;
		expect(level).toBeDefined();
		if (mode === 'probe') {
			await run(level, 'canonical', level.solution, 1, false, true);
			await run(level, 'air-off', level.solution, 1, true, true);
			const obvious: Level['solution'] = [
				{
					tick: 120,
					action: { type: 'pour', spring: 'dew', at: { x: 13, y: 4 } },
				},
				{ tick: 520, action: { type: 'pour', spring: null } },
			];
			await run(level, 'obvious', obvious, 1, false, true);
			await run(level, 'obvious-air-off', obvious, 1, true);
		}
		if (mode === 'search-replays') {
			for (const method of ['random', 'map-elites']) {
				const saved = JSON.parse(
					await (
						commands as unknown as {
							readSolverCheckpoint(name: string): Promise<string>;
						}
					).readSolverCheckpoint(`${level.id}-${method}-partial`)
				);
				const candidates = saved
					.map(
						(
							r: { outcome: Outcome; timeline: Level['solution'] },
							i: number
						) => ({ ...r, i })
					)
					.filter((r: { outcome: Outcome }) => r.outcome.cleared);
				for (const candidate of candidates) {
					await run(
						level,
						`search-${method}-${candidate.i}`,
						candidate.timeline,
						candidate.outcome.seed,
						false,
						true
					);
					if (
						level.id === 'hidden-draft' &&
						!candidate.timeline.some(
							(e: Level['solution'][number]) =>
								e.action.type === 'pose' && e.action.index === 0
						)
					) {
						const noStir = await run(
							level,
							`search-${method}-${candidate.i}-no-stir`,
							candidate.timeline.filter(
								(e: Level['solution'][number]) => e.action.type !== 'stir'
							),
							candidate.outcome.seed
						);
						expect(
							noStir.cleared,
							'off/right vent clear must need air stirring'
						).toBe(false);
					}
				}
			}
		}
		if (mode === 'pond-probe') {
			await run(level, 'canonical', level.solution, 1, false, true);
			await run(level, 'air-off', level.solution, 1, true, true);
			await run(
				level,
				'vent-only',
				level.solution.filter(
					(e) => e.action.type !== 'toggle' || e.action.id !== 'pond-plug'
				),
				1,
				false,
				true
			);
		}
		if (mode === 'pond-controls') {
			for (const index of [0, 1, 2])
				for (const order of ['vent-first', 'plug-first']) {
					const timeline: Level['solution'] = [
						{
							tick: order === 'vent-first' ? 0 : 240,
							action: { type: 'pose', id: 'pond-draft', index },
						},
						{
							tick: order === 'vent-first' ? 240 : 0,
							action: { type: 'toggle', id: 'pond-plug' },
						},
					];
					await run(level, `${order}-${index}`, timeline);
				}
		}
		if (mode === 'pond-near-order') {
			for (const delay of [0, 6, 12, 24]) {
				const timeline: Level['solution'] = [
					{ tick: 120, action: { type: 'toggle', id: 'pond-plug' } },
					{
						tick: 120 + delay,
						action: { type: 'pose', id: 'pond-draft', index: 2 },
					},
				];
				await run(level, `plug-first-right-after-${delay}`, timeline);
			}
		}
		if (mode === 'pond-seal') {
			let minimum = Infinity,
				maximum = 0;
			const outcome = await evaluate(
				level,
				level.solution.filter((e) => e.action.type === 'pose'),
				1,
				{
					cap: 600,
					onTick: ({ room }) => {
						if (room.view().tick < 30) return;
						const units = room.view().gauges['pond-level'].units;
						minimum = Math.min(minimum, units);
						maximum = Math.max(maximum, units);
					},
				}
			);
			await output.writeBenchJson(
				`${OUT}/seal.json`,
				JSON.stringify({ minimum, maximum, outcome }, null, 2)
			);
			expect(minimum).toBe(32);
			expect(maximum).toBe(32);
			expect(outcome.waste).toBe(0);
		}
		if (mode === 'pond-tune') {
			for (const velocity of [24, 48, 72, 96]) {
				const variant: Level = {
					...level,
					vents: level.vents.map((v) => ({
						...v,
						from: { x: 6, y: 12 },
						to: { x: 6, y: 17 },
						velocity: { x: velocity, y: 0 },
						radius: 5,
						control: {
							kind: 'turn',
							velocities: [
								{ x: -velocity, y: 0 },
								{ x: 0, y: 0 },
								{ x: velocity, y: 0 },
							],
							index: 1,
						},
					})),
				};
				await run(
					variant,
					`under-draft-${velocity}`,
					variant.solution,
					1,
					false,
					true
				);
			}
		}
		if (mode === 'accidental') {
			const spring = level.springs[0];
			const timeline: Level['solution'] = [
				{ tick: 0, action: { type: 'pose', id: 'return-louvres', index: 2 } },
				{
					tick: 120,
					action: {
						type: 'pour',
						spring: spring.id,
						at: { x: spring.zone.x + spring.zone.w / 2, y: spring.zone.y + 1 },
					},
				},
			];
			await run(level, 'first-click-then-pour', timeline, 1, false, true);
			const cycling: Level['solution'] = [
				{ tick: 0, action: { type: 'pose', id: 'return-louvres', index: 2 } },
				{
					tick: 120,
					action: {
						type: 'pour',
						spring: spring.id,
						at: { x: spring.zone.x + spring.zone.w - 1, y: spring.zone.y + 1 },
					},
				},
				{ tick: 210, action: { type: 'pour', spring: null } },
				{ tick: 240, action: { type: 'pose', id: 'return-louvres', index: 0 } },
				{
					tick: 480,
					action: {
						type: 'pour',
						spring: spring.id,
						at: { x: spring.zone.x + spring.zone.w - 1, y: spring.zone.y + 1 },
					},
				},
				{ tick: 740, action: { type: 'pour', spring: null } },
			];
			await run(level, 'cycle-until-clear', cycling, 1, false, true);
		}
		if (mode === 'tune') {
			for (const velocity of [-30, -36, -42, -48]) {
				const variant = {
					...level,
					vents: level.vents.map((v) =>
						v.id === 'return-louvres'
							? { ...v, velocity: { x: velocity, y: 0 } }
							: v
					),
				};
				await run(
					variant,
					`return-${velocity}`,
					variant.solution,
					1,
					false,
					true
				);
			}
		}
		if (mode === 'visual') {
			await output.setViewport({ width: 1340, height: 920 });
			await page.viewport(1300, 880);
			for (const greedy of [false, true]) {
				const target = document.createElement('div');
				target.style.cssText =
					'position:fixed;inset:0;width:1280px;background:#122b2b';
				document.body.append(target);
				const seen = new Set<string>();
				const timeline: Level['solution'] = greedy
					? level.id === 'still-pond'
						? level.solution.filter(
								(e) => e.action.type !== 'toggle' || e.action.id !== 'pond-plug'
						  )
						: [
								{
									tick: 120,
									action: { type: 'pour', spring: 'dew', at: { x: 13, y: 4 } },
								},
								{ tick: 520, action: { type: 'pour', spring: null } },
						  ]
					: level.solution;
				await evaluate(level, timeline, 1, {
					cap,
					onTick: async (state) => {
						const t = state.room.view().tick;
						const tag =
							!greedy && t === 1
								? 'first-look'
								: !greedy &&
								  level.id === 'hidden-draft' &&
								  [31, 61, 91, 121].includes(t)
								? `mist-${t}`
								: !greedy && t === (level.id === 'still-pond' ? 660 : 420)
								? 'insight'
								: !greedy && state.room.view().cleared
								? 'clear'
								: greedy && t === 900
								? 'greedy-stall'
								: null;
						if (!tag || seen.has(tag)) return;
						seen.add(tag);
						state.sim.render({ time: t / 60 });
						state.air.render();
						let liquid!: HTMLCanvasElement, air!: HTMLCanvasElement;
						const component = mount(Board, {
							target,
							props: {
								level,
								view: state.room.view(),
								oncanvas: (l: HTMLCanvasElement, a: HTMLCanvasElement) => {
									liquid = l;
									air = a;
								},
								onact() {},
								onui() {},
								onboarding:
									tag === 'first-look' && level.cues?.includes('puff')
										? 'puff'
										: undefined,
							},
						});
						await tick();
						for (const [dest, source] of [
							[liquid, state.canvas],
							[air, state.airCanvas],
						]) {
							dest.width = source.width;
							dest.height = source.height;
							dest.getContext('2d')!.drawImage(source, 0, 0);
						}
						await output.writeBenchBase64(
							`${OUT}/${tag}.png`,
							await output.captureCanvasScreenshot({
								x: 0,
								y: 0,
								width: 1280,
								height: 860,
							})
						);
						await unmount(component);
					},
				});
				target.remove();
			}
		}
		if (mode === 'canonical') {
			for (const seed of [1, 71, 429]) {
				const result = await run(
					level,
					`canonical-${seed}`,
					level.solution,
					seed,
					false,
					seed === 1
				);
				expect(result.cleared, JSON.stringify(result)).toBe(true);
				expect(result.dewdrops).toBe(3);
			}
			expect(level.solution.some((e) => e.action.type === 'stir')).toBe(false);
		}
		if (mode === 'perturbation') {
			for (const [timing, position] of [
				[3, 0.25],
				[6, 0.5],
				[12, 1],
			]) {
				let clears = 0;
				for (let i = 0; i < 10; i++) {
					const seed = 71 + i * 429;
					const timeline = perturbTimeline(
						level.solution,
						seeded(seed),
						timing,
						position
					);
					clears += Number(
						(await run(level, `jitter-${timing}-${i}`, timeline, seed)).cleared
					);
				}
				expect(
					clears,
					`±${timing} ticks / ${position} LU`
				).toBeGreaterThanOrEqual(9);
			}
		}
		if (mode === 'naive') {
			for (const plan of naivePlans(level).filter(
				(p) => p.name !== 'no-stir'
			)) {
				const result = await run(
					level,
					plan.name,
					plan.timeline,
					1,
					!!plan.airOff,
					['idle', 'single-dew'].includes(plan.name)
				);
				expect(result.cleared, plan.name).toBe(false);
			}
			const toggles: Level['solution'][number][] = level.gates
				.filter((g) => g.driver.kind === 'player')
				.map((g) => ({ tick: 120, action: { type: 'toggle', id: g.id } }));
			for (const v of level.vents.filter((v) => v.control?.kind === 'switch'))
				toggles.push({ tick: 120, action: { type: 'toggle', id: v.id } });
			expect((await run(level, 'toggle-everything', toggles)).cleared).toBe(
				false
			);
			const spring = level.springs[0];
			if (spring) {
				const greedy: Level['solution'] = [
					...level.solution.filter((e) => e.action.type !== 'pour'),
					{
						tick: 300,
						action: {
							type: 'pour',
							spring: spring.id,
							at: { x: spring.zone.x + 1, y: spring.zone.y + 1 },
						},
					},
				];
				const informed = await run(level, 'informed-overpour', greedy);
				expect(informed.cleared).toBe(true);
				expect(informed.dewdrops).toBe(2);
				const blind = greedy.filter((e) => e.action.type === 'pour');
				expect((await run(level, 'greedy-fill', blind)).cleared).toBe(false);
			}
		}
	},
	550_000
);
