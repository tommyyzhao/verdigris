import { LiquidEngine } from 'svelte-fluid/experimental';
import { createAirLayer } from '../air.js';
import { fixedAir, gpuProfiler, particleHash } from './coupling.js';
import { createRoom } from '../model.js';
import { replayActions } from '../runtime.js';
import type { AirLayer, Level, RoomModel, RoomView, Vec } from '../types.js';

export type Timeline = Level['solution'];
export interface EvaluationState {
	room: RoomModel;
	sim: LiquidEngine;
	canvas: HTMLCanvasElement;
	air: AirLayer;
	airCanvas: HTMLCanvasElement;
}
export interface EvaluateOptions {
	cap?: number;
	/** Ablation: force every vent off and ignore stir, including authored drafts. */
	airOff?: boolean;
	/** The liquid PBO ring has three slots. Never enqueue a fourth unobserved tick. */
	queueDepth?: 1 | 2 | 3 | 4;
	/** Fixed-lag is the solver default; legacy mode exists only for regression comparison. */
	coupling?: 'fixed' | 'legacy';
	lag?: 2 | 3 | 4;
	framePaced?: boolean;
	earlyStop?: boolean;
	profile?: boolean;
	hashParticles?: boolean;
	onTick?(state: EvaluationState): void | boolean | Promise<void | boolean>;
	extraSensors?: {
		id: string;
		rect: { x: number; y: number; w: number; h: number };
	}[];
	onSensors?(frame: ReturnType<LiquidEngine['pollSensors']>[number]): void;
}
export interface Outcome {
	id: string;
	seed: number;
	cleared: boolean;
	termination:
		| 'cleared'
		| 'cap'
		| 'spoiled-unrecoverable'
		| 'empty-settled'
		| 'callback';
	dewdrops: number;
	ticks: number;
	observed: number;
	maxSensorLag: number;
	wallMs: number;
	particleHash: string | null;
	delivered: number;
	profile: {
		jsMs: number;
		frameIntervalsMs: number[];
		fenceWaitMs: number;
		stallMs: number[];
		liquidGpuMs: number[];
		airGpuMs: number[];
	};
	simulatedSecondsPerWallSecond: number;
	waste: number;
	urns: RoomView['urns'];
	seedViews: RoomView['seedViews'];
	maxUrns: Record<string, number>;
	springs: RoomView['springs'];
	seeds: RoomView['seeds'];
	brambles: RoomView['brambles'];
	stuck: boolean;
	everSpoiled: boolean;
	inkUsed: number;
	reserve: number;
	/** Regions with at least one marker, including species and first arrival tick. */
	route: Record<
		string,
		{ firstTick: number; maxUnits: number; species: number[] }
	>;
	routeSignature: string;
	descriptor: {
		waterUsed: number;
		firstPourX: number;
		stirTicks: number;
		regions: number;
	};
}

const yieldGpu = () => new Promise<void>((resolve) => setTimeout(resolve, 0));

/** Real air + liquid + room rules. No render calls, animation clock, DOM attachment, or wall-time stepping. */
export async function evaluate(
	level: Level,
	timeline: Timeline,
	seed: number,
	options: EvaluateOptions = {}
): Promise<Outcome> {
	const par = Math.max(600, (level.solution.at(-1)?.tick ?? 0) + 300);
	const cap =
		options.cap ??
		(options.earlyStop
			? Math.ceil(par * 1.5)
			: Math.max(1800, (timeline.at(-1)?.tick ?? 0) + 900));
	const depth = options.queueDepth ?? 2;
	if (
		!Number.isInteger(cap) ||
		cap < 1 ||
		![1, 2, 3, 4].includes(depth) ||
		(options.coupling === 'legacy' && depth === 4)
	)
		throw new RangeError('Invalid evaluator cap or queueDepth');
	if (!Number.isInteger(seed) || seed < 0 || seed > 0xffff_ffff)
		throw new RangeError('Invalid evaluator seed');
	if (timeline.some((e) => !Number.isInteger(e.tick) || e.tick < 0))
		throw new RangeError('Timeline ticks must be nonnegative integers');
	const fixed = options.coupling !== 'legacy';
	const lag = options.lag ?? 2;
	if (![2, 3, 4].includes(lag)) throw new RangeError('Invalid coupling lag');
	const profile: Outcome['profile'] = {
		jsMs: 0,
		frameIntervalsMs: [],
		fenceWaitMs: 0,
		stallMs: [],
		liquidGpuMs: [],
		airGpuMs: [],
	};
	const ordered = [...timeline].sort((a, b) => a.tick - b.tick);
	const byTick = new Map<number, Timeline>();
	for (const entry of ordered)
		byTick.set(entry.tick, [...(byTick.get(entry.tick) ?? []), entry]);
	const canvas = document.createElement('canvas');
	canvas.width = 1280;
	canvas.height = 800;
	canvas.getContext('webgl2', {
		alpha: true,
		premultipliedAlpha: true,
		antialias: false,
		depth: false,
		stencil: false,
		preserveDrawingBuffer: true,
	});
	const airCanvas = document.createElement('canvas');
	airCanvas.width = 960;
	airCanvas.height = 600;
	let sim: LiquidEngine | undefined;
	let air: AirLayer | undefined;
	const room = createRoom(level);
	const airLevel = options.airOff ? { ...level, vents: level.vents.map(v => ({ ...v, velocity: { x: 0, y: 0 }, control: undefined })) } : level;
	let observed = 0,
		delivered = 0,
		maxSensorLag = 0,
		stuck = false;
	const route: Outcome['route'] = {};
	const maxUrns: Record<string, number> = {};
	const started = performance.now();
	let termination: Outcome['termination'] = 'cap';
	let settledFrames = 0,
		previousFrame = 0;
	const frames = new Map<
		number,
		ReturnType<LiquidEngine['pollSensors']>[number]
	>();
	let coupling: ReturnType<typeof fixedAir> | undefined;
	let liquidProfile: ReturnType<typeof gpuProfiler> | undefined;
	let airProfile: ReturnType<typeof gpuProfiler> | undefined;
	function observe(deliverThrough = fixed ? -1 : Infinity) {
		for (const frame of sim!.pollSensors()) {
			observed = frame.tick;
			frames.set(frame.tick, frame);
		}
		for (const [tick, frame] of frames) {
			if (tick > deliverThrough) continue;
			frames.delete(tick);
			delivered = tick;
			maxSensorLag = Math.max(maxSensorLag, room.view().tick - frame.tick);
			for (const [id, sensor] of Object.entries(frame.sensors)) {
				const count = sensor.counts.reduce((a, b) => a + b, 0);
				if (!count) continue;
				const region = (route[id] ??= {
					firstTick: frame.tick,
					maxUnits: 0,
					species: [],
				});
				region.maxUnits = Math.max(region.maxUnits, count / 64);
				sensor.counts.forEach((n, i) => {
					if (n && !region.species.includes(i)) region.species.push(i);
				});
			}
			room.observe(frame);
			settledFrames = frame.activity < 0.5 ? settledFrames + 1 : 0;
			stuck ||= room.view().stuck;
			for (const u of room.view().urns)
				maxUrns[u.id] = Math.max(maxUrns[u.id] ?? 0, u.units);
			options.onSensors?.(frame);
		}
	}
	async function drain(target: number) {
		for (let wait = 0; observed < target && wait < 1000; wait++) {
			await yieldGpu();
			observe();
		}
		if (observed < target)
			throw new Error(
				`GPU sensor fence did not complete: ${observed}/${target}`
			);
	}
	try {
		sim = new LiquidEngine({
			canvas,
			seed,
			palette: ['#6ec6ff', '#f2b134', '#e8608a'],
		});
		coupling = fixed ? fixedAir(airCanvas, airLevel, lag) : undefined;
		air = coupling?.air ?? createAirLayer(airCanvas, airLevel);
		liquidProfile = gpuProfiler(canvas, !!options.profile);
		airProfile = gpuProfiler(airCanvas, !!options.profile);
		const scene = room.scene();
		if (options.extraSensors)
			scene.sensors = [...scene.sensors, ...options.extraSensors];
		sim.load(scene);
		air.syncTerrain(room.view().terrain, room.view().terrainRevision);
		for (let tick = 0; tick < cap; tick++) {
			if (options.framePaced) {
				await new Promise<void>((resolve) => {
					const next = (now: number) => {
						if (previousFrame && now - previousFrame < 15) {
							requestAnimationFrame(next);
							return;
						}
						if (previousFrame)
							profile.frameIntervalsMs.push(now - previousFrame);
						previousFrame = now;
						resolve();
					};
					requestAnimationFrame(next);
				});
			}
			const waitStarted = performance.now();
			let waited = false;
			if (fixed) {
				for (let tries = 0; ; tries++) {
					observe();
					if (
						coupling!.ready(tick + 1) &&
						observed >= Math.max(0, tick + 1 - Math.min(lag, 3))
					)
						break;
					if (tries >= 1000)
						throw new Error('Fixed-lag coupling fence did not complete');
					waited = true;
					await yieldGpu();
				}
			}
			const stall = performance.now() - waitStarted;
			if (waited) {
				profile.fenceWaitMs += stall;
				profile.stallMs.push(stall);
			}
			const jsStarted = performance.now();
			if (fixed) observe(tick + 1 - lag);
			const v = room.view();
			if (v.cleared) {
				termination = 'cleared';
				await options.onTick?.({ room, sim, canvas, air, airCanvas });
				break;
			}
			if (options.earlyStop) {
				const spoiled = [...v.urns, ...v.seedViews].some(
					(u) => u.status === 'spoiled'
				);
				// Conservative: with any future plug/erase/dig event, do not infer irrecoverability.
				const recovery =
					level.gates.some(
						(g) => g.driver.kind !== 'player' || v.gates[g.id] > 0
					) ||
					level.seeds.length > 0 ||
					level.brambles.length > 0 ||
					ordered.some(
						(e) => e.tick >= tick && !['pour', 'stir'].includes(e.action.type)
					);
				if (spoiled && !recovery) {
					termination = 'spoiled-unrecoverable';
					break;
				}
				const empty = Object.values(v.springs).every((n) => n < 1e-6);
				if (
					empty &&
					tick - (ordered.at(-1)?.tick ?? 0) >= 120 &&
					settledFrames >= 120 &&
					!ordered.some((e) => e.tick >= tick)
				) {
					termination = 'empty-settled';
					break;
				}
			}
			replayActions(room, air, (byTick.get(tick) ?? []).filter(e => !options.airOff || e.action.type !== 'stir'), tick);
			const planned = room.planTick();
			air.syncTerrain(room.view().terrain, room.view().terrainRevision);
			airProfile.measure(() => air!.step(planned.tick, options.airOff ? Object.fromEntries(level.vents.map(v => [v.id, { x: 0, y: 0 }])) : room.view().vents));
			liquidProfile.measure(() =>
				sim!.step({
					...planned,
					wind: coupling
						? coupling.wind(planned.tick)
						: air!.wind(planned.tick),
				})
			);
			observe();
			profile.jsMs += performance.now() - jsStarted;
			if (!options.framePaced && planned.tick % depth === 0) {
				const waitStart = performance.now();
				await yieldGpu();
				observe();
				// Preserve the harness's one-tick overlap, but never exhaust the three-slot ring.
				if (!fixed) await drain(planned.tick - (depth > 1 ? 1 : 0));
				profile.fenceWaitMs += performance.now() - waitStart;
			}
			if (
				options.onTick &&
				(await options.onTick({ room, sim, canvas, air, airCanvas })) === false
			) {
				termination = 'callback';
				break;
			}
			if (room.view().cleared) {
				termination = 'cleared';
				break;
			}
		}
		await drain(room.view().tick);
		profile.liquidGpuMs = liquidProfile.finish();
		profile.airGpuMs = airProfile.finish();
		const hash = options.hashParticles ? particleHash(sim) : null;
		const wallMs = performance.now() - started;
		const v = room.view();
		const supply = level.springs.reduce((sum, s) => sum + s.well, 0);
		const remaining = Object.values(v.springs).reduce((a, b) => a + b, 0);
		const first = ordered.find(
			(e) => e.action.type === 'pour' && e.action.spring !== null
		);
		return {
			id: level.id,
			seed,
			cleared: v.cleared,
			termination,
			dewdrops: room.dewdrops(),
			ticks: v.tick,
			observed,
			delivered,
			maxSensorLag,
			wallMs,
			particleHash: hash,
			profile,
			simulatedSecondsPerWallSecond: v.tick / 60 / (wallMs / 1000),
			waste: v.wasted,
			urns: v.urns,
			seedViews: v.seedViews,
			maxUrns,
			springs: v.springs,
			seeds: v.seeds,
			brambles: v.brambles,
			stuck,
			everSpoiled: v.everSpoiled,
			inkUsed: v.inkUsed,
			reserve: room.mastery().reserve,
			route,
			routeSignature: Object.keys(route)
				.sort()
				.map((id) => `${id}[${route[id].species.sort().join('')}]`)
				.join('|'),
			descriptor: {
				waterUsed: supply - remaining,
				firstPourX: first?.action.type === 'pour' ? first.action.at?.x ?? 0 : 0,
				stirTicks: new Set(
					ordered.filter((e) => e.action.type === 'stir').map((e) => e.tick)
				).size,
				regions: Object.keys(route).length,
			},
		};
	} finally {
		air?.dispose();
		sim?.dispose();
		// The detached liquid canvas is private. FluidEngine already releases any shared-host context.
		canvas
			.getContext('webgl2')
			?.getExtension('WEBGL_lose_context')
			?.loseContext();
		if (options.coupling === 'legacy')
			airCanvas
				.getContext('webgl2')
				?.getExtension('WEBGL_lose_context')
				?.loseContext();
	}
}

/** Diagnostic only; search evaluations never render unless explicitly requested. */
export function replayPng(
	level: Level,
	{ room, sim, canvas }: EvaluationState
): string {
	sim.render({ time: room.view().tick / 60 });
	const shot = document.createElement('canvas');
	shot.width = canvas.width;
	shot.height = canvas.height;
	const ctx = shot.getContext('2d')!;
	ctx.fillStyle = '#122b2b';
	ctx.fillRect(0, 0, shot.width, shot.height);
	for (let y = 0; y < 120; y++)
		for (let x = 0; x < 192; x++) {
			const kind = room.view().terrain[y * 192 + x];
			if (!kind) continue;
			ctx.fillStyle = [
				'transparent',
				'#657677',
				'#71563c',
				'#d9cda4',
				'#ba8e54',
				'#6e995d',
				'#967346',
			][kind];
			ctx.fillRect(
				(x * shot.width) / 192,
				(y * shot.height) / 120,
				shot.width / 192 + 0.1,
				shot.height / 120 + 0.1
			);
		}
	ctx.drawImage(canvas, 0, 0);
	ctx.font = '16px sans-serif';
	for (const u of level.urns) {
		ctx.strokeStyle = '#ffffff88';
		ctx.strokeRect(
			(u.box.x * shot.width) / 48,
			(u.box.y * shot.height) / 30,
			(u.box.w * shot.width) / 48,
			(u.box.h * shot.height) / 30
		);
		ctx.fillStyle = 'white';
		ctx.fillText(
			`${u.id}: ${room
				.view()
				.urns.find((v) => v.id === u.id)!
				.units.toFixed(1)}`,
			(u.box.x * shot.width) / 48,
			(u.box.y * shot.height) / 30 - 6
		);
	}
	return shot.toDataURL('image/png').split(',')[1];
}

/** Independent bounded action jitter; sorting preserves event vocabulary, not paired pour duration. */
export function perturbTimeline(
	timeline: Timeline,
	rand: () => number,
	timing: number,
	position: number
): Timeline {
	if (![timing, position].every((n) => Number.isFinite(n) && n >= 0))
		throw new RangeError('Perturbation bounds must be finite and nonnegative');
	const point = (p: Vec) => ({
		x: p.x + (rand() * 2 - 1) * position,
		y: p.y + (rand() * 2 - 1) * position,
	});
	return timeline
		.map(({ tick, action }) => ({
			tick: Math.max(0, tick + Math.round((rand() * 2 - 1) * timing)),
			action:
				action.type === 'stir'
					? { ...action, from: point(action.from), to: point(action.to) }
					: action.type === 'pour' && action.at
					? { ...action, at: point(action.at) }
					: action,
		}))
		.sort((a, b) => a.tick - b.tick);
}
