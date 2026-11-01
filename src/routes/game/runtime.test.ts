import { describe, expect, it, vi } from 'vitest';
import { createRuntime, replayActions } from './runtime.js';
import type {
	LiquidOptions,
	LiquidSim,
	SensorFrame,
} from 'svelte-fluid/experimental';
import type {
	AirLayer,
	GardenAudio,
	Level,
	RoomModel,
	RoomView,
} from './types.js';

function setup() {
	let callback: FrameRequestCallback = () => {};
	let hidden = false;
	const visibility = new EventTarget() as EventTarget & { hidden: boolean };
	Object.defineProperty(visibility, 'hidden', { get: () => hidden });
	const frame: SensorFrame = {
		tick: 1,
		epoch: 1,
		sensors: {},
		drained: {},
		alive: [0, 0, 0],
		seeded: [0, 0, 0],
		emitted: [0, 0, 0],
		activity: 0,
		occupancy: new Uint8Array(),
	};
	const makeRoom = vi.fn(() => {
		let tick = 0;
		return {
			level: {} as Level,
			scene: () => ({
				width: 192,
				height: 120,
				terrain: new Uint8Array(192 * 120),
				fills: [],
				sensors: [],
				drains: [],
			}),
			act: vi.fn(() => [{ type: 'pour', spring: 'dew', at: { x: 10, y: 3 } }]),
			planTick: vi.fn(() => ({ tick: ++tick, emit: [], edits: [] })),
			observe: vi.fn(() => [
				{ type: 'splash', at: { x: 1, y: 2 }, strength: 0.5 },
			]),
			view: () => ({ tick } as RoomView),
			dewdrops: () => 0,
			mastery: () => ({
				revived: false,
				thrifty: true,
				clean: true,
				reserve: 1,
				reserveNeeded: 0.25,
				everSpoiled: false,
			}),
		} as RoomModel;
	});
	const sims: LiquidSim[] = [];
	let options!: LiquidOptions;
	const makeSim = vi.fn((opts: LiquidOptions) => {
		options = opts;
		let pending: SensorFrame[] = [];
		const sim = {
			load: vi.fn(),
			step: vi.fn((input) => { pending.push({ ...frame, tick: input.tick }); }),
			pollSensors: vi.fn(() => { const frames = pending; pending = []; return frames; }),
			emitted: [0, 0, 0],
			capacityLeft: 1000,
			compact: vi.fn(),
			render: vi.fn(),
			resize: vi.fn(),
			dispose: vi.fn(),
		} as LiquidSim;
		sims.push(sim);
		return sim;
	});
	const onEvent = vi.fn(),
		onView = vi.fn(),
		onState = vi.fn();
	const audio = { update: vi.fn(), ui: vi.fn() } as unknown as GardenAudio;
	const airs: AirLayer[] = [];
	const wind = { width: 48, height: 30, data: new Float32Array(48 * 30 * 2) };
	const makeAir = vi.fn(() => {
		const air = {
			stir: vi.fn(),
			puff: vi.fn(),
			step: vi.fn(),
			syncTerrain: vi.fn(),
			ready: vi.fn(() => true),
			wind: vi.fn((tick: number) => tick > 2 ? wind : undefined),
			resize: vi.fn(),
			render: vi.fn(),
			dispose: vi.fn(),
		};
		airs.push(air);
		return air;
	});
	const airCanvas = Object.assign(new EventTarget(), {
		width: 192,
		height: 120,
	}) as HTMLCanvasElement;
	const cancel = vi.fn();
	const runtime = createRuntime({
		canvas: {
			width: 192,
			height: 120,
			clientWidth: 192,
			clientHeight: 120,
		} as HTMLCanvasElement,
		level: {} as Level,
		airCanvas,
		makeAir,
		makeSim,
		audio,
		makeRoom,
		onEvent,
		onView,
		onState,
		visibility,
		clock: {
			request: (fn) => {
				callback = fn;
				return 1;
			},
			cancel,
		},
	});
	return {
		runtime,
		makeRoom,
		makeSim,
		sims,
		airs,
		makeAir,
		wind,
		airCanvas,
		onEvent,
		onView,
		onState,
		cancel,
		get options() {
			return options;
		},
		frame: (time: number) => callback(time),
		hide: () => {
			hidden = true;
			visibility.dispatchEvent(new Event('visibilitychange'));
		},
		show: () => {
			hidden = false;
			visibility.dispatchEvent(new Event('visibilitychange'));
		},
	};
}

describe('Verdigris fixed-step runtime', () => {
	it('waits for exact late, out-of-order sensors and wind; observes t before planning t+2', async () => {
		vi.useFakeTimers();
		const s = setup();
		try {
			const room = s.makeRoom.mock.results[0].value;
			const delivered: number[][] = [];
			const winds = new Map<number, typeof s.wind>();
			let frames: SensorFrame[] = [];
			vi.mocked(s.sims[0].step).mockImplementation(() => {});
			vi.mocked(s.sims[0].pollSensors).mockImplementation(() => frames.splice(0));
			vi.mocked(s.airs[0].ready).mockImplementation((next) => next <= 2 || winds.has(next - 2));
			vi.mocked(s.airs[0].wind).mockImplementation((next) => {
				const wind = winds.get(next - 2);
				winds.delete(next - 2);
				return wind;
			});
			vi.mocked(room.observe).mockImplementation((frame: SensorFrame) => { delivered.push([frame.tick, room.view().tick + 1]); return []; });
			const sensor = (tick: number): SensorFrame => ({ tick, epoch: 1, sensors: {}, drained: {}, alive: [0, 0, 0], seeded: [0, 0, 0], emitted: [0, 0, 0], occupancy: new Uint8Array(), activity: 0 });
			s.frame(0); s.frame(17); s.frame(34);
			frames.push(sensor(2));
			winds.set(2, { ...s.wind, data: new Float32Array([2, 0]) });
			s.frame(51);
			expect(s.sims[0].step).toHaveBeenCalledTimes(2);
			expect(delivered).toEqual([]);
			frames.push(sensor(1));
			await vi.advanceTimersByTimeAsync(1);
			s.frame(52);
			expect(s.sims[0].step).toHaveBeenCalledTimes(2);
			winds.set(1, { ...s.wind, data: new Float32Array([1, 0]) });
			await vi.advanceTimersByTimeAsync(1);
			s.frame(53);
			expect(delivered).toEqual([[1, 3]]);
			s.frame(70);
			expect(delivered).toEqual([[1, 3], [2, 4]]);
			const steps = vi.mocked(s.sims[0].step).mock.calls.map(([input]) => [input.tick, input.wind?.data[0]]);
			expect(steps).toEqual([[1, undefined], [2, undefined], [3, 1], [4, 2]]);
		} finally { s.runtime.dispose(); vi.useRealTimers(); }
	});
	it('pauses with a message after a 50ms fence wait; resume never skips the missing tick', async () => {
		vi.useFakeTimers();
		const s = setup();
		try {
			vi.mocked(s.airs[0].ready).mockImplementation((next) => next <= 2);
			s.frame(0); s.frame(17); s.frame(34); s.frame(51);
			await vi.advanceTimersByTimeAsync(55);
			expect(s.onState).toHaveBeenLastCalledWith('paused', expect.stringContaining('tick 1'));
			expect(s.sims[0].step).toHaveBeenCalledTimes(2);
			s.runtime.resume(); s.frame(100); s.frame(117);
			expect(s.sims[0].step).toHaveBeenCalledTimes(2);
			vi.mocked(s.airs[0].ready).mockReturnValue(true);
			await vi.advanceTimersByTimeAsync(1);
			s.frame(118);
			expect(s.sims[0].step).toHaveBeenLastCalledWith(expect.objectContaining({ tick: 3 }));
		} finally { s.runtime.dispose(); vi.useRealTimers(); }
	});
	it('steps air before liquid, passes wind, renders and disposes both engines', () => {
		const s = setup();
		s.frame(0);
		s.frame(17);
		s.frame(34);
		s.frame(51);
		expect(s.airs[0].step).toHaveBeenCalledWith(1, undefined);
		expect(vi.mocked(s.airs[0].step).mock.invocationCallOrder[0]).toBeLessThan(
			vi.mocked(s.sims[0].step).mock.invocationCallOrder[0]
		);
		expect(s.sims[0].step).toHaveBeenCalledWith(
			expect.objectContaining({ wind: s.wind })
		);
		expect(s.airs[0].render).toHaveBeenCalledTimes(4);
		s.runtime.act({ type: 'stir', from: { x: 1, y: 2 }, to: { x: 3, y: 4 } });
		expect(s.airs[0].stir).toHaveBeenCalledWith({ x: 1, y: 2 }, { x: 3, y: 4 });
		s.runtime.restart();
		expect(s.airs[0].dispose).toHaveBeenCalledTimes(1);
		s.runtime.dispose();
		expect(s.airs[1].dispose).toHaveBeenCalledTimes(1);
	});
	it('stops pouring on pause, restart and air context loss', () => {
		const s = setup();
		const room = s.makeRoom.mock.results[0].value;
		room.view = () =>
			({
				tick: 0,
				pouring: { spring: 'dew', at: { x: 10, y: 3 } },
			} as RoomView);
		s.runtime.pause();
		expect(room.act).toHaveBeenCalledWith({ type: 'pour', spring: null });
		vi.mocked(room.act).mockClear();
		s.runtime.restart();
		expect(room.act).toHaveBeenCalledWith({ type: 'pour', spring: null });
		s.airCanvas.dispatchEvent(
			new Event('webglcontextlost', { cancelable: true })
		);
		expect(s.onState).toHaveBeenLastCalledWith(
			'context-lost',
			'The garden’s lights went out.'
		);
		s.runtime.dispose();
	});
	it('publishes a focusout stop before pausing even when it precedes the next frame', () => {
		const s = setup(),
			room = s.makeRoom.mock.results[0].value;
		let pouring: RoomView['pouring'] = { spring: 'dew', at: { x: 10, y: 3 } };
		room.view = () => ({ tick: 0, pouring } as RoomView);
		s.frame(0);
		s.runtime.act({ type: 'pour', spring: null });
		pouring = null;
		s.runtime.pause();
		expect(s.onView).toHaveBeenLastCalledWith({ tick: 0, pouring: null });
		s.runtime.dispose();
	});
	it('replays pour actions to rules and stir actions to air at their own ticks', () => {
		const s = setup(),
			room = s.makeRoom.mock.results[0].value;
		const action = {
			type: 'stir' as const,
			from: { x: 1, y: 2 },
			to: { x: 3, y: 4 },
		};
		replayActions(room, s.airs[0], [{ tick: 3, action }], 2);
		expect(s.airs[0].stir).not.toHaveBeenCalled();
		replayActions(room, s.airs[0], [{ tick: 3, action }], 3);
		expect(s.airs[0].stir).toHaveBeenCalledWith(action.from, action.to);
		s.runtime.dispose();
	});
	it('runs exactly sixty ticks per second, independent of render frequency', () => {
		for (const hz of [30, 60, 120, 144]) {
			const s = setup();
			for (let i = 0; i <= hz; i++) s.frame((i * 1000) / hz);
			expect(s.sims[0].step).toHaveBeenCalledTimes(60);
			s.runtime.dispose();
		}
	});
	it('coalesces arbitrarily many input actions into at most one view publication per frame', () => {
		const s = setup();
		s.onView.mockClear();
		for (let i = 0; i < 20; i++)
			s.runtime.act({ type: 'pour', spring: 'dew', at: { x: 10, y: 3 } });
		expect(s.onView).not.toHaveBeenCalled();
		s.frame(0);
		expect(s.onView).toHaveBeenCalledTimes(1);
		s.frame(0);
		expect(s.onView).toHaveBeenCalledTimes(1);
		s.runtime.dispose();
	});
	it('caps catch-up at two ticks and drops excess wall time permanently', () => {
		const s = setup();
		s.frame(0);
		s.frame(60000);
		expect(s.sims[0].step).toHaveBeenCalledTimes(2);
		s.frame(60000 + 1000 / 60);
		expect(s.sims[0].step).toHaveBeenCalledTimes(3);
		s.runtime.dispose();
	});
	it('scales simulation time without spending supply during pauses', () => {
		const s = setup();
		s.runtime.setTimeScale(0.5);
		for (let i = 0; i <= 60; i++) s.frame((i * 1000) / 60);
		expect(s.sims[0].step).toHaveBeenCalledTimes(30);
		s.runtime.pause();
		s.frame(6000);
		s.runtime.act({ type: 'toggle', id: 'g' });
		expect(s.makeRoom.mock.results[0].value.act).toHaveBeenCalledExactlyOnceWith({ type: 'pour', spring: null });
		s.runtime.resume();
		s.frame(7000);
		s.frame(7000 + 1000 / 30);
		expect(s.sims[0].step).toHaveBeenCalledTimes(31);
		s.runtime.dispose();
	});
	it('holds a hidden tab paused until explicitly resumed, without a catch-up burst', () => {
		const s = setup();
		s.frame(0);
		s.hide();
		s.frame(50000);
		s.show();
		s.frame(55000);
		expect(s.onState).toHaveBeenLastCalledWith('paused', undefined);
		expect(s.sims[0].step).not.toHaveBeenCalled();
		s.runtime.resume();
		s.frame(60000);
		s.frame(60000 + 1000 / 60);
		expect(s.sims[0].step).toHaveBeenCalledTimes(1);
		s.runtime.dispose();
	});
	it('routes actions and observed events, publishes fresh views, renders each frame', () => {
		const s = setup();
		s.runtime.act({ type: 'pour', spring: 'dew', at: { x: 10, y: 3 } });
		s.frame(0);
		s.frame(1000 / 60);
		expect(s.makeRoom.mock.results[0].value.observe).not.toHaveBeenCalled();
		s.frame(2000 / 60);
		s.frame(3000 / 60);
		expect(s.onEvent).toHaveBeenCalledWith({
			type: 'pour',
			spring: 'dew',
			at: { x: 10, y: 3 },
		});
		expect(s.onEvent).toHaveBeenCalledWith({
			type: 'splash',
			at: { x: 1, y: 2 },
			strength: 0.5,
		});
		expect(s.onView).toHaveBeenLastCalledWith({ tick: 3 });
		expect(s.sims[0].render).toHaveBeenCalledTimes(4);
		s.runtime.dispose();
	});
	it('restarts with a fresh scene and disposes only its own resources', () => {
		const s = setup();
		s.frame(0);
		s.frame(17);
		s.runtime.pause();
		s.runtime.restart();
		expect(s.sims[0].dispose).toHaveBeenCalledTimes(1);
		expect(s.makeRoom).toHaveBeenCalledTimes(2);
		expect(s.sims[1].load).toHaveBeenCalledTimes(1);
		s.frame(1000);
		s.frame(1017);
		expect(s.sims[1].step).toHaveBeenCalledTimes(1);
		s.runtime.dispose();
		s.runtime.dispose();
		expect(s.sims[1].dispose).toHaveBeenCalledTimes(1);
		expect(s.cancel).toHaveBeenCalledTimes(1);
	});
	it('context loss pauses, reports the held error state, restart creates a new engine', () => {
		const s = setup();
		s.options.onContextLost?.();
		s.frame(0);
		s.frame(1000);
		expect(s.sims[0].step).not.toHaveBeenCalled();
		expect(s.onState).toHaveBeenLastCalledWith(
			'context-lost',
			'The garden’s lights went out.'
		);
		s.runtime.restart();
		expect(s.makeSim).toHaveBeenCalledTimes(2);
		s.runtime.dispose();
	});
	it('reports permanent hardware refusal without falling back to a different simulation', () => {
		const s = setup();
		const error = new Error('Floating-point textures are unavailable.');
		error.name = 'WebGLUnavailableError';
		s.options.onError?.(error);
		s.frame(0);
		s.frame(1000);
		expect(s.onState).toHaveBeenLastCalledWith('unavailable', error.message);
		expect(s.makeSim).toHaveBeenCalledTimes(1);
		expect(s.sims[0].step).not.toHaveBeenCalled();
		s.runtime.dispose();
	});
});
