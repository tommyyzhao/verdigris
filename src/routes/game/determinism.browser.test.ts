import { expect, it } from 'vitest';
import { commands } from 'vitest/browser';
import { LiquidEngine } from 'svelte-fluid/experimental';
import { createSteppedFluidEngine, type SteppedFluidEngine } from 'svelte-fluid/experimental';
import { createAirLayer } from './air.js';
import { LEVELS } from './levels.js';
import { createRoom } from './model.js';
import { createRuntime } from './runtime.js';
import type { GardenAudio, RoomView } from './types.js';

// Both particle attachments include inactive slots, matching the solver diagnostic.
function particleHash(sim: LiquidEngine): string {
	const { a, b } = sim._debugParticles();
	let hash = 2166136261;
	for (const data of [a, b])
		for (const byte of new Uint8Array(data.buffer, data.byteOffset, data.byteLength))
			hash = Math.imul(hash ^ byte, 16777619) >>> 0;
	return hash.toString(16).padStart(8, '0');
}

it('Breath runtime is identical across three asynchronous readback schedules', async () => {
	const level = LEVELS.find((level) => level.id === 'breath')!;
	const results = [];
	for (const depth of [1, 2, 3]) {
		const canvas = document.createElement('canvas');
		const airCanvas = document.createElement('canvas');
		for (const element of [canvas, airCanvas]) {
			element.width = 960; element.height = 600;
			Object.defineProperties(element, { clientWidth: { value: 960 }, clientHeight: { value: 600 } });
		}
		let callback: FrameRequestCallback = () => {};
		let sim!: LiquidEngine;
		let latest!: RoomView;
		let clearTick: number | null = null;
		let failure = '';
		let checkpoint: number | undefined;
		let now = 0;
		const room = createRoom(level);
		const audio = { update() {}, ui() {} } as unknown as GardenAudio;
		const runtime = createRuntime({
			canvas, airCanvas, level, audio,
			makeRoom: () => room,
			makeSim: (options) => (sim = new LiquidEngine(options)),
			makeAir: (canvas, level) => createAirLayer(canvas, level, (options) => {
				const engine = createSteppedFluidEngine(options);
				const queued: NonNullable<ReturnType<SteppedFluidEngine['pollVelocitySnapshot']>>[] = [];
				return {
					splat: engine.splat.bind(engine), setConfig: engine.setConfig.bind(engine),
					advance: engine.advance.bind(engine), renderOnce: engine.renderOnce.bind(engine),
					resize: engine.resize.bind(engine), dispose: engine.dispose.bind(engine),
					queueVelocitySnapshot: engine.queueVelocitySnapshot.bind(engine),
					pollVelocitySnapshot() {
						for (let frame = engine.pollVelocitySnapshot(); frame; frame = engine.pollVelocitySnapshot()) queued.push(frame);
						// Vary completion ordering without changing issued ticks or simulation inputs.
						return depth === 3 ? queued.pop() ?? null : queued.shift() ?? null;
					},
				};
			}),
			clock: { request(fn) { callback = fn; return 1; }, cancel() {} },
			visibility: Object.assign(new EventTarget(), { hidden: false }),
			onView: (view) => { latest = view; },
			onEvent: (event) => { if (event.type === 'clear') clearTick = room.view().tick + 1; },
			onState: (state, message) => { if (state !== 'running') failure = `${state}: ${message}`; },
		});
		try {
			callback(0);
			for (let tick = 0; tick < 1800 && clearTick === null; tick++) {
				for (const entry of level.solution) if (entry.tick === tick) runtime.act(entry.action);
				const target = tick + 1;
				callback(now += 1000 / 60);
				if (target % depth === 0) await new Promise((resolve) => setTimeout(resolve, 0));
				const started = performance.now();
				while (latest.tick < target && !failure && performance.now() - started < 2000) {
					await new Promise((resolve) => setTimeout(resolve, 0));
					callback(now);
				}
				expect(failure).toBe('');
				expect(latest.tick).toBe(target);
				if (target === 180) checkpoint = latest.urns[0].units;
			}
			expect(clearTick).not.toBeNull();
			results.push({ checkpoint, units: latest.urns.map((urn) => urn.units), clearTick, hash: particleHash(sim) });
		} finally {
			runtime.dispose();
			for (const element of [canvas, airCanvas]) element.getContext('webgl2')?.getExtension('WEBGL_lose_context')?.loseContext();
		}
	}
	await (commands as unknown as { writeBenchJson(path: string, json: string): Promise<void> }).writeBenchJson('/tmp/verdigris-v2-determinism.json', JSON.stringify(results, null, 2));
	console.info('Breath runtime determinism', JSON.stringify(results));
	expect(results[1]).toEqual(results[0]);
	expect(results[2]).toEqual(results[0]);
}, 180_000);
