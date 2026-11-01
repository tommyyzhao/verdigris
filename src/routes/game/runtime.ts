import { createAirLayer } from './air.js';
import type { Stop, Telemetry } from './telemetry.js';
import { createCapacityGuard } from './capacity.js';
import { createRoom } from './model.js';
import type { LiquidOptions, LiquidSim } from 'svelte-fluid/experimental';
import { READBACK_LAG } from './types.js';
import type {
	SensorFrame,
	Action,
	AirLayer,
	GardenAudio,
	GameEvent,
	Level,
	RoomModel,
	RoomView,
} from './types.js';

export type RuntimeState =
	| 'running'
	| 'paused'
	| 'context-lost'
	| 'unavailable'
	| 'error';
export interface Runtime {
	act(action: Action): void;
	pause(): void;
	resume(): void;
	restart(): void;
	setTimeScale(scale: number): void;
	setGlow(glow: number): void;
	dispose(): void;
}
export interface RuntimeOptions {
	canvas: HTMLCanvasElement;
	airCanvas: HTMLCanvasElement;
	level: Level;
	sandbox?: boolean;
	makeSim(options: LiquidOptions): LiquidSim;
	makeAir?: typeof createAirLayer;
	audio: GardenAudio;
	telemetry?: Telemetry;
	onEvent(event: GameEvent): void;
	onView(view: RoomView): void;
	onState?(state: RuntimeState, message?: string): void;
	makeRoom?: typeof createRoom;
	clock?: {
		request(callback: FrameRequestCallback): number;
		cancel(id: number): void;
	};
	visibility?: Pick<
		Document,
		'hidden' | 'addEventListener' | 'removeEventListener'
	>;
}

/** Shared by deterministic solution replays: stirring must reach the air, not only the rules. */
export function replayActions(
	room: RoomModel,
	air: AirLayer,
	timeline: Level['solution'],
	tick: number
): GameEvent[] {
	return timeline
		.filter((entry) => entry.tick === tick)
		.flatMap(({ action }) => {
			if (action.type === 'stir') air.stir(action.from, action.to);
			const events = room.act(action);
			for (const event of events) if (event.type === 'puff') air.puff(event.at);
			return events;
		});
}

const STEP = 1 / 60;
const SEED = 71429;
export function createRuntime(options: RuntimeOptions): Runtime {
	const { canvas, airCanvas, level, audio, onEvent, onView } = options;
	const clock = options.clock ?? {
		request: (callback: FrameRequestCallback) =>
			requestAnimationFrame(callback),
		cancel: (id: number) => cancelAnimationFrame(id),
	};
	const visibility = options.visibility ?? document;
	let room: RoomModel | undefined;
	let sim: LiquidSim | undefined;
	let air: AirLayer | undefined;
	let state: RuntimeState = 'paused';
	let disposed = false,
		frame = 0,
		accumulator = 0,
		time = 0,
		scale = 1,
		glow = 0;
	let previous: number | undefined;
	let published: RoomView | null = null;
	let guard = createCapacityGuard();
	let dirty = false;
	let waiting = false;
	let waitTimer: ReturnType<typeof setTimeout> | undefined;
	const sensors = new Map<number, SensorFrame>();
	const collectSensors = () => {
		for (const sensor of sim?.pollSensors() ?? []) sensors.set(sensor.tick, sensor);
	};
	const publish = () => {
		if (room) {
			published = { ...room.view() };
			dirty = false;
			onView(published);
		}
	};
	const dispatch = (event: GameEvent, sensorTick?: number) => {
		if (options.telemetry && room) options.telemetry.event(event, room.view(), sensorTick);
		onEvent(event);
	};
	const stopPour = (reason: Stop = 'pause') => {
		if (!room) return;
		for (const event of room.act({ type: 'pour', spring: null })) dispatch(event);
		options.telemetry?.observe(room.view(), reason);
		// A focusout may already have stopped the model since the last frame publication.
		if (dirty || published?.pouring) publish();
	};
	const changeState = (next: RuntimeState, message?: string) => {
		if (next !== 'running') {
			stopPour(visibility.hidden ? 'hidden' : next === 'context-lost' ? 'context_lost' : next === 'error' || next === 'unavailable' ? 'error' : 'pause');
			audio.update(null, 0);
		}
		state = next;
		options.telemetry?.state(next, visibility.hidden ? 'hidden' : next === 'context-lost' ? 'context_lost' : next === 'error' || next === 'unavailable' ? 'error' : message ? 'technical' : 'user', room?.view());
		clearTimeout(waitTimer);
		waitTimer = undefined;
		waiting = false;
		previous = undefined;
		accumulator = 0;
		options.onState?.(next, message);
	};
	const fail = (error: unknown) =>
		changeState(
			error instanceof Error && error.name === 'WebGLUnavailableError'
				? 'unavailable'
				: 'error',
			error instanceof Error
				? error.message
				: 'The garden could not wake. Please try again.'
		);
	const release = () => {
		sensors.clear();
		air?.dispose();
		air = undefined;
		sim?.dispose();
		sim = undefined;
	};
	const initialize = () => {
		if (disposed) return;
		try {
			const restarting = !!room;
			const technical = state === 'context-lost' || state === 'error' || state === 'unavailable';
			stopPour('restart');
			if (room) options.telemetry?.restart(room.view(), technical);
			release();
			room = (options.makeRoom ?? createRoom)(level, {
				sandbox: options.sandbox,
			});
			air = (options.makeAir ?? createAirLayer)(airCanvas, level);
			sim = options.makeSim({
				canvas,
				seed: SEED,
				palette: ['#6ec6ff', '#f2b134', '#e8608a'],
				onError: fail,
				onContextLost: () =>
					changeState('context-lost', 'The garden’s lights went out.'),
				onContextRestored: () =>
					options.onState?.(
						'context-lost',
						'The light has returned. Wake this room again.'
					),
			});
			sim.load(room.scene());
			air.syncTerrain(room.view().terrain, room.view().terrainRevision);
			scale = 1;
			glow = 0;
			time = 0;
			guard = createCapacityGuard();
			publish();
			options.telemetry?.startAttempt(room.view(), restarting ? technical ? 'technical_restart' : 'player_restart' : 'initial', SEED);
			changeState(visibility.hidden ? 'paused' : 'running');
		} catch (error) {
			release();
			fail(error);
		}
	};
	const ready = (next: number) => {
		collectSensors();
		return air!.ready(next) && (next <= READBACK_LAG || sensors.has(next - READBACK_LAG));
	};
	const waitFor = (next: number) => {
		waiting = true;
		const started = performance.now();
		const poll = () => {
			waitTimer = undefined;
			if (disposed || state !== 'running') return;
			try {
				if (ready(next)) {
					waiting = false;
					// Fence latency is not game time; spend the retained tick, not wall-time catch-up.
					previous = undefined;
					return;
				}
				if (performance.now() - started >= 50) {
					changeState('paused', `The GPU is taking too long at tick ${next - READBACK_LAG}. Resume to wait, or restart this room.`);
					return;
				}
				waitTimer = setTimeout(poll, 0);
			} catch (error) {
				fail(error);
			}
		};
		// WebGL fence visibility needs an event-loop yield, never a synchronous spin.
		waitTimer = setTimeout(poll, 0);
	};
	const loop: FrameRequestCallback = (now) => {
		if (disposed) return;
		frame = clock.request(loop);
		const elapsed =
			previous === undefined ? 0 : Math.max(0, (now - previous) / 1000);
		previous = now;
		if (!sim || !air || !room || state !== 'running' || waiting) return;
		try {
			// A stalled tab never spends its wells catching up to wall time.
			accumulator = Math.min(
				accumulator + Math.min(elapsed, 2 * STEP) * scale,
				2 * STEP
			);
			let ticks = 0;
			while (accumulator + 1e-10 >= STEP && ticks < 2) {
				const next = room.view().tick + 1;
				if (!ready(next)) {
					waitFor(next);
					break;
				}
				const target = next - READBACK_LAG;
				const sensor = sensors.get(target);
				if (sensor) {
					sensors.delete(target);
					for (const event of room.observe(sensor)) dispatch(event, sensor.tick);
				}
				if (state !== 'running') break;
				accumulator -= STEP;
				const planned = room.planTick();
				const view = room.view();
				options.telemetry?.sample(view);
				air.syncTerrain(view.terrain, view.terrainRevision);
				air.step(planned.tick, view.vents);
				const coupled = { ...planned, wind: air.wind(planned.tick) };
				sim.step(options.sandbox ? guard.filter(coupled, sim) : coupled);
				collectSensors();
				time += STEP;
				ticks++;
			}
			if (ticks || dirty) publish();
			const dpr = Math.min(globalThis.devicePixelRatio || 1, 2);
			const width = Math.max(1, Math.round(canvas.clientWidth * dpr)),
				height = Math.max(1, Math.round(canvas.clientHeight * dpr));
			if (canvas.width !== width || canvas.height !== height)
				sim.resize(width, height);
			if (airCanvas.width !== width || airCanvas.height !== height)
				air.resize(width, height);
			air.render();
			sim.render({ time, glow });
			audio.update(published, Math.min(elapsed, 0.1));
		} catch (error) {
			fail(error);
		}
	};
	const hidden = () => {
		options.telemetry?.pause('hidden', visibility.hidden);
		if (visibility.hidden && state === 'running') changeState('paused');
	};
	const airLost = (event: Event) => {
		event.preventDefault();
		changeState('context-lost', 'The garden’s lights went out.');
	};
	const airRestored = () =>
		options.onState?.(
			'context-lost',
			'The light has returned. Wake this room again.'
		);
	visibility.addEventListener('visibilitychange', hidden);
	airCanvas.addEventListener('webglcontextlost', airLost);
	airCanvas.addEventListener('webglcontextrestored', airRestored);
	initialize();
	frame = clock.request(loop);
	return {
		act(action) {
			options.telemetry?.beforeAction(action, !disposed && state === 'running' && !!room, disposed ? 'disposed' : visibility.hidden ? 'hidden' : state !== 'running' ? 'paused' : !room ? 'not_ready' : 'none');
			if (disposed || state !== 'running' || !room) return;
			try {
				if (action.type === 'stir') {
					air?.stir(action.from, action.to);
					audio.ui(
						'stir',
						action.to.x / 24 - 1,
						Math.min(
							1,
							Math.hypot(
								action.to.x - action.from.x,
								action.to.y - action.from.y
							) / 2
						)
					);
				}
				for (const event of room.act(action)) {
					if (event.type === 'puff') air?.puff(event.at);
					dispatch(event);
				}
				options.telemetry?.afterAction(room.view());
				dirty = true;
			} catch (error) {
				fail(error);
			}
		},
		pause() {
			if (!disposed && state === 'running') changeState('paused');
		},
		resume() {
			if (!disposed && state === 'paused' && !visibility.hidden)
				changeState('running');
		},
		restart: initialize,
		setTimeScale(value) {
			if (Number.isFinite(value)) { const next = Math.min(2, Math.max(0, value)); if (next !== scale) options.telemetry?.scale(scale, next); scale = next; }
		},
		setGlow(value) {
			if (Number.isFinite(value)) glow = Math.min(1, Math.max(0, value));
		},
		dispose() {
			if (disposed) return;
			stopPour('navigation');
			options.telemetry?.endRoom();
			disposed = true;
			clearTimeout(waitTimer);
			clock.cancel(frame);
			visibility.removeEventListener('visibilitychange', hidden);
			airCanvas.removeEventListener('webglcontextlost', airLost);
			airCanvas.removeEventListener('webglcontextrestored', airRestored);
			release();
			audio.update(null, 0);
		},
	};
}
