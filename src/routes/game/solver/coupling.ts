import { createSteppedFluidEngine, type SteppedFluidEngine } from 'svelte-fluid/experimental';
import { createAirLayer } from '../air.js';
import type { Level } from '../types.js';

type Snapshot = NonNullable<ReturnType<SteppedFluidEngine['pollVelocitySnapshot']>>;

/** Solver-only adapter: leave production air.ts unchanged; deliver precisely t-lag, never newest-ready. */
export function fixedAir(canvas: HTMLCanvasElement, level: Level, lag: number) {
	let engine: SteppedFluidEngine;
	let target = 0;
	const pending = new Map<number, Snapshot>();
	const air = createAirLayer(canvas, level, (options) => {
		engine = createSteppedFluidEngine(options);
		return {
			splat: engine.splat.bind(engine),
			setConfig: engine.setConfig.bind(engine),
			advance: engine.advance.bind(engine),
			renderOnce: engine.renderOnce.bind(engine),
			resize: engine.resize.bind(engine),
			dispose() {
				const ownsContext = !(engine as unknown as { host: unknown }).host;
				engine.dispose();
				if (ownsContext)
					canvas
						.getContext('webgl2')
						?.getExtension('WEBGL_lose_context')
						?.loseContext();
			},
			queueVelocitySnapshot(tick, w, h) {
				collect();
				if (!engine.queueVelocitySnapshot(tick, w, h))
					throw new Error(`Air PBO ring exhausted at ${tick}`);
				return true;
			},
			pollVelocitySnapshot() {
				const frame = pending.get(target);
				pending.delete(target);
				return frame ?? null;
			},
		};
	});
	function collect() {
		for (
			let frame = engine.pollVelocitySnapshot();
			frame;
			frame = engine.pollVelocitySnapshot()
		)
			pending.set(frame.tick, frame);
	}
	return {
		air,
		ready(tick: number) {
			target = tick - lag;
			collect();
			return target <= 0 || pending.has(target);
		},
		wind(tick: number) {
			if (tick <= lag) return undefined;
			// step() may already have collected the ready frame into the production air cache.
			const wind = air.wind(tick - lag + 2);
			if (wind)
				for (let i = 0; i < wind.data.length; i += 2) {
					const magnitude = Math.hypot(wind.data[i], wind.data[i + 1]);
					// Float32 component rounding can place the production 400 clamp just outside the liquid contract.
					if (magnitude > 400) {
						wind.data[i] *= 399.9999 / magnitude;
						wind.data[i + 1] *= 399.9999 / magnitude;
					}
				}
			return wind;
		},
	};
}

/** Diagnostic readback only. Hash both current particle attachments, including every inactive slot. */
export function particleHash(sim: unknown): string {
	const state = sim as {
		gl: WebGL2RenderingContext;
		particles: { fbo: WebGLFramebuffer }[];
		particleSide: number;
	};
	const gl = state.gl;
	gl.bindFramebuffer(
		gl.READ_FRAMEBUFFER,
		state.particles[state.particleSide].fbo
	);
	let hash = 2166136261;
	for (const attachment of [gl.COLOR_ATTACHMENT0, gl.COLOR_ATTACHMENT1]) {
		gl.readBuffer(attachment);
		const data = new Float32Array(256 * 256 * 4);
		gl.readPixels(0, 0, 256, 256, gl.RGBA, gl.FLOAT, data);
		for (const byte of new Uint8Array(data.buffer))
			hash = Math.imul(hash ^ byte, 16777619) >>> 0;
	}
	return hash.toString(16).padStart(8, '0');
}

/** Optional GPU elapsed-time samples, not wall time; no result is used while disjoint. */
export function gpuProfiler(canvas: HTMLCanvasElement, enabled: boolean) {
	const gl = canvas.getContext('webgl2')!;
	const ext = enabled
		? gl.getExtension('EXT_disjoint_timer_query_webgl2')
		: null;
	const queries: WebGLQuery[] = [];
	return {
		measure(fn: () => void) {
			const q = ext ? gl.createQuery() : null;
			if (q) gl.beginQuery(ext.TIME_ELAPSED_EXT, q);
			fn();
			if (q) {
				gl.endQuery(ext.TIME_ELAPSED_EXT);
				queries.push(q);
			}
		},
		finish() {
			const samples =
				!ext || gl.getParameter(ext.GPU_DISJOINT_EXT)
					? []
					: queries
							.filter((q) => gl.getQueryParameter(q, gl.QUERY_RESULT_AVAILABLE))
							.map(
								(q) =>
									(gl.getQueryParameter(q, gl.QUERY_RESULT) / 1e6) as number
							);
			for (const q of queries) gl.deleteQuery(q);
			return samples;
		},
	};
}
