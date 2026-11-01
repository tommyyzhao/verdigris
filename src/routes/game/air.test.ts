import { describe, expect, it, vi } from 'vitest';
import { createAirLayer } from './air.js';
import type { FluidConfig } from 'svelte-fluid';
import type { Level } from './types.js';

function setup(vents: Level['vents'] = []) {
	let config!: FluidConfig;
	let snapshot: {
		tick: number;
		epoch: number;
		width: number;
		height: number;
		data: Float32Array;
	} | null = null;
	const engine = {
		splat: vi.fn(),
		setConfig: vi.fn(),
		advance: vi.fn(),
		renderOnce: vi.fn(),
		resize: vi.fn(() => false),
		dispose: vi.fn(),
		queueVelocitySnapshot: vi.fn(() => true),
		pollVelocitySnapshot: vi.fn(() => {
			const s = snapshot;
			snapshot = null;
			return s;
		}),
	};
	const air = createAirLayer(
		{} as HTMLCanvasElement,
		{ vents } as Level,
		(opts) => {
			config = opts.config;
			expect(opts.autoStart).toBe(false);
			return engine;
		}
	);
	return {
		air,
		engine,
		get config() {
			return config;
		},
		snapshot(tick: number, data: Float32Array) {
			snapshot = { tick, epoch: 1, width: 48, height: 30, data };
		},
	};
}

describe('cursor air and mist', () => {
	it('reconfigures controlled drafts only on tick boundaries; mist injects zero velocity', () => {
		const s = setup([{ id: 'v', from: { x: 4, y: 8 }, to: { x: 4, y: 12 }, velocity: { x: 6, y: 0 }, control: { kind: 'switch', on: false } }]);
		expect(s.config.flow!.sources![0].velocity).toEqual({ x: 0, y: -0 });
		s.air.step(1, { v: { x: 6, y: 0 } });
		expect(s.engine.setConfig).toHaveBeenCalledTimes(1);
		s.air.step(2, { v: { x: 6, y: 0 } });
		expect(s.engine.setConfig).toHaveBeenCalledTimes(1);
		s.air.puff({ x: 24, y: 15 });
		expect(s.engine.splat).toHaveBeenLastCalledWith(.5, .5, 0, 0, { r: .8, g: 1.25, b: 1.15 });
		s.air.step(15, { v: { x: 0, y: 0 } });
		expect(s.engine.splat).toHaveBeenCalledTimes(1);
	});
	it('keeps hidden drafts velocity-only until the player puffs', () => {
		const s = setup([{ id: 'hidden', from: { x: 4, y: 8 }, to: { x: 4, y: 12 }, velocity: { x: 24, y: 0 }, hidden: true }]);
		expect(s.config.flow!.sources![0].velocity).toEqual({ x: 24 * 3.2, y: -0 });
		s.air.step(15);
		expect(s.engine.splat).not.toHaveBeenCalled();
		s.air.puff({ x: 24, y: 15 });
		expect(s.engine.splat).toHaveBeenCalledOnce();
	});
	it('keeps human sweeps broad and persistent without extra force', () => {
		const s = setup();
		expect(s.config.velocityDissipation).toBe(0.15);
		expect(s.config.curl).toBe(4);
		expect(s.config.splatRadius).toBe(0.7);
		for (let i = 0; i < 16; i++) {
			s.air.stir({ x: 9 + i, y: 9 }, { x: 10 + i, y: 9 });
			s.air.step(i + 1);
		}
		expect(s.engine.splat).toHaveBeenCalledTimes(32);
		expect(
			s.engine.splat.mock.calls.reduce(
				(sum, call) => sum + Math.hypot(call[2], call[3]),
				0
			)
		).toBeCloseTo(16 * 28);
	});
	it('bounds splat work and impulse per segment and tick; rejects invalid input', () => {
		const s = setup();
		for (let i = 0; i < 100; i++) s.air.stir({ x: 0, y: 0 }, { x: 48, y: 30 });
		expect(s.engine.splat.mock.calls.length).toBeLessThanOrEqual(12);
		expect(
			s.engine.splat.mock.calls.reduce(
				(n, call) => n + Math.hypot(call[2], call[3]),
				0
			)
		).toBeCloseTo(150);
		for (const [x, y, , , color] of s.engine.splat.mock.calls) {
			expect(x).toBeGreaterThanOrEqual(0);
			expect(y).toBeLessThanOrEqual(1);
			expect(color.g).toBeLessThan(0.15);
		}
		s.air.step(1);
		s.air.stir({ x: 10, y: 10 }, { x: 11, y: 10 });
		expect(s.engine.advance).toHaveBeenCalledWith(1, 1 / 60);
		expect(s.engine.queueVelocitySnapshot).toHaveBeenCalledWith(1, 48, 30);
		const before = s.engine.splat.mock.calls.length;
		s.air.stir({ x: NaN, y: 0 }, { x: 0, y: 0 });
		expect(s.engine.splat).toHaveBeenCalledTimes(before);
		s.air.dispose();
		s.air.dispose();
		s.air.render();
		expect(s.engine.dispose).toHaveBeenCalledTimes(1);
		expect(s.engine.renderOnce).not.toHaveBeenCalled();
	});
	it('authors normalized y-up velocity-only line sources; adds only faint draft dye', () => {
		const s = setup([
			{
				id: 'v',
				from: { x: 12, y: 6 },
				to: { x: 24, y: 9 },
				velocity: { x: -3, y: 2 },
			},
		]);
		const source = s.config.flow!.sources![0];
		expect(source).toMatchObject({
			kind: 'line',
			from: { x: 0.25, y: 0.8 },
			to: { x: 0.5, y: 0.7 },
			velocity: { x: expect.closeTo(-9.6), y: -6.4 },
		});
		expect(source.dye).toBeUndefined();
		s.air.step(15);
		expect(s.engine.splat).toHaveBeenCalledWith(
			expect.any(Number),
			expect.any(Number),
			0,
			0,
			expect.objectContaining({ g: 0.25 })
		);
	});
	it('combines solid row-runs into one full-board obstruction; coalesces revisions for thirty ticks', () => {
		const s = setup(),
			terrain = new Uint8Array(192 * 120);
		terrain[0] = 1;
		terrain[1] = 2;
		terrain[193] = 3;
		s.air.syncTerrain(terrain, 1);
		expect(s.engine.setConfig).toHaveBeenLastCalledWith({
			obstructions: [
				{ d: 'M0 0h2v1H0ZM1 1h1v1H1Z', viewBox: [0, 0, 192, 120], fit: 'fill' },
			],
		});
		s.air.syncTerrain(terrain, 1);
		s.air.syncTerrain(new Uint8Array(192 * 120), 2);
		s.air.step(29);
		expect(s.engine.setConfig).toHaveBeenCalledTimes(1);
		s.air.step(30);
		expect(s.engine.setConfig).toHaveBeenLastCalledWith({ obstructions: [] });
		expect(s.engine.setConfig).toHaveBeenCalledTimes(2);
	});
	it('flips bottom-up rows, converts domain velocities and caps exact-lag vectors', () => {
		const s = setup(),
			data = new Float32Array(48 * 30 * 2);
		data[0] = 1;
		data[1] = 0.5;
		data[29 * 48 * 2] = -0.5;
		data[29 * 48 * 2 + 1] = -1;
		data[2] = 10;
		data[3] = 10;
		s.snapshot(10, data);
		expect(s.air.ready(12)).toBe(true);
		const wind = s.air.wind(12)!;
		expect(wind.data[0]).toBe(-96);
		expect(wind.data[1]).toBe(120);
		expect(wind.data[29 * 48 * 2]).toBe(192);
		expect(wind.data[29 * 48 * 2 + 1]).toBe(-60);
		expect(
			Math.hypot(wind.data[29 * 48 * 2 + 2], wind.data[29 * 48 * 2 + 3])
		).toBeCloseTo(399.99, 2);
		expect(s.air.ready(13)).toBe(false);
		expect(() => s.air.wind(13)).toThrow('Missing exact-lag air snapshot 11');
	});
	it('keeps float32 wind magnitudes within the liquid limit', () => {
		const s = setup();
		let seed = 12345;
		const random = () => ((seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0) / 2 ** 32 - 0.5) * 20;
		for (let batch = 0; batch < 8; batch++) {
			const data = new Float32Array(48 * 30 * 2);
			for (let i = 0; i < data.length; i++) data[i] = random();
			data[0] = 1;
			data[1] = -4;
			s.snapshot(batch + 1, data);
			const wind = s.air.wind(batch + 3)!;
			for (let i = 0; i < wind.data.length; i += 2)
				expect(Math.hypot(wind.data[i], wind.data[i + 1])).toBeLessThanOrEqual(400);
		}
	});
	it('buffers out-of-order wind instead of taking newest; never overwrites a missed enqueue', () => {
		const s = setup();
		expect(s.air.wind(1)).toBeUndefined();
		expect(s.air.wind(2)).toBeUndefined();
		s.snapshot(2, new Float32Array(48 * 30 * 2).fill(0.2));
		expect(s.air.ready(3)).toBe(false);
		s.snapshot(1, new Float32Array(48 * 30 * 2).fill(0.1));
		expect(s.air.ready(3)).toBe(true);
		expect(s.air.wind(3)!.data[0]).toBeCloseTo(19.2);
		expect(s.air.wind(4)!.data[0]).toBeCloseTo(38.4);
		s.engine.queueVelocitySnapshot.mockReturnValue(false);
		expect(() => s.air.step(5)).toThrow('could not be queued at 5');
	});
	it('defers resize until every issued snapshot survives its old epoch', () => {
		const s = setup();
		s.air.step(1); s.air.step(2);
		s.air.resize(960, 600);
		expect(s.engine.resize).not.toHaveBeenCalled();
		s.snapshot(1, new Float32Array(48 * 30 * 2));
		s.air.ready(3);
		s.air.resize(960, 600);
		expect(s.engine.resize).not.toHaveBeenCalled();
		s.snapshot(2, new Float32Array(48 * 30 * 2));
		s.air.ready(3);
		s.air.resize(960, 600);
		expect(s.engine.resize).toHaveBeenCalledWith(960, 600);
		expect(s.air.wind(3)).toBeDefined();
		expect(s.air.wind(4)).toBeDefined();
	});
	it('feature-detects older engines without snapshot support', () => {
		const s = setup();
		delete (s.engine as Partial<typeof s.engine>).queueVelocitySnapshot;
		s.air.step(1);
		expect(s.air.wind(1)).toBeUndefined();
	});
});
