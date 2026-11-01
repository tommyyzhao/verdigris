<script lang="ts">
	import { onDestroy } from 'svelte';
	import { LiquidEngine } from 'svelte-fluid/experimental';
	import { createAirLayer } from '../game/air.js';
	import type { AirLayer, Level } from '../game/types.js';

	let result = $state('');
	let running = $state(false);
	let cancel: (() => void) | undefined;
	const level: Level = {
		id: 'check', name: '', act: 1, terrain: Array(30).fill(' '.repeat(48)),
		springs: [], vents: [{ id: 'air', from: { x: 8, y: 10 }, to: { x: 8, y: 20 }, velocity: { x: 2, y: 0 } }],
		planks: [], gates: [], urns: [], seeds: [], brambles: [], wheels: [], drains: [], machines: [],
		ink: 0, dig: false, pools: [], mastery: { reserve: 0 }, hints: ['', '', ''], solution: []
	};

	function family() {
		const ua = navigator.userAgent;
		return /Edg\//.test(ua) ? 'Edge' : /Firefox\//.test(ua) ? 'Firefox' : /Chrome\//.test(ua) ? 'Chrome' : /Safari\//.test(ua) ? 'Safari' : 'Other';
	}

	async function run() {
		running = true;
		result = '';
		let sim: LiquidEngine | undefined;
		let air: AirLayer | undefined;
		let frame = 0;
		let lost = false;
		let stopped = false;
		let category = 'engine-init';
		const liquidCanvas = document.createElement('canvas');
		const airCanvas = document.createElement('canvas');
		liquidCanvas.width = airCanvas.width = 960;
		liquidCanvas.height = airCanvas.height = 600;
		const onLost = (event: Event) => { event.preventDefault(); lost = true; };
		liquidCanvas.addEventListener('webglcontextlost', onLost);
		airCanvas.addEventListener('webglcontextlost', onLost);
		cancel = () => { stopped = true; cancelAnimationFrame(frame); };
		try {
			const gl = liquidCanvas.getContext('webgl2', { alpha: true, premultipliedAlpha: true, antialias: false, depth: false, stencil: false, preserveDrawingBuffer: true });
			if (!gl) throw 'no-webgl2';
			for (const name of ['EXT_color_buffer_float', 'EXT_float_blend'])
				if (!gl.getExtension(name)) throw `missing-extension:${name}`;
			const texture = gl.createTexture();
			const framebuffer = gl.createFramebuffer();
			if (!texture || !framebuffer) throw category;
			gl.bindTexture(gl.TEXTURE_2D, texture);
			gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA32F, 1, 1, 0, gl.RGBA, gl.FLOAT, null);
			gl.bindFramebuffer(gl.FRAMEBUFFER, framebuffer);
			gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, texture, 0);
			const renderable = gl.checkFramebufferStatus(gl.FRAMEBUFFER) === gl.FRAMEBUFFER_COMPLETE;
			gl.bindFramebuffer(gl.FRAMEBUFFER, null);
			gl.deleteFramebuffer(framebuffer);
			gl.deleteTexture(texture);
			if (!renderable) throw category;
			sim = new LiquidEngine({ canvas: liquidCanvas, seed: 1, palette: ['#6ec6ff', '#f2b134', '#e8608a'], onContextLost: () => { lost = true; }, onError: () => { lost = true; } });
			sim.load({ width: 192, height: 120, terrain: new Uint8Array(192 * 120), fills: [], sensors: [], drains: [] });
			category = 'air-init';
			air = createAirLayer(airCanvas, level);
			category = 'engine-init';
			let tick = 0;
			const sensors = new Set<number>();
			const times: number[] = [];
			let start = 0, previous = 0;
			await new Promise<void>((resolve, reject) => {
				cancel = () => { stopped = true; cancelAnimationFrame(frame); resolve(); };
				const loop = (now: number) => {
					try {
						if (stopped) return resolve();
						if (lost || gl.isContextLost()) throw 'context-lost';
						if (!start) start = now;
						if (previous) times.push(now - previous);
						previous = now;
						for (const sensor of sim!.pollSensors()) sensors.add(sensor.tick);
						const next = tick + 1;
						if (air!.ready(next) && (next <= 2 || sensors.has(next - 2))) {
							sensors.delete(next - 2);
							air!.step(next);
							sim!.step({ tick: next, emit: next <= 180 ? [{ species: 0, count: 8, rect: { x: 90, y: 8, w: 8, h: 2 }, velocity: { x: 0, y: 20 } }] : [], edits: [], wind: air!.wind(next) });
							tick = next;
						}
						air!.render();
						sim!.render({ time: tick / 60 });
						if (now - start >= 10000) return resolve();
						frame = requestAnimationFrame(loop);
					} catch (error) { reject(error); }
				};
				frame = requestAnimationFrame(loop);
			});
			if (!stopped) {
				times.sort((a, b) => a - b);
				const p95 = times[Math.ceil(times.length * 0.95) - 1] ?? Infinity;
				result = p95 > 33 ? 'too-slow' : `PASS · ${family()}-PASS-${p95 <= 17 ? '17' : p95 <= 25 ? '25' : '33'}ms`;
			}
		} catch (error) {
			if (!stopped) result = lost ? 'context-lost' : typeof error === 'string' ? error : category;
		} finally {
			cancelAnimationFrame(frame);
			air?.dispose();
			sim?.dispose();
			liquidCanvas.removeEventListener('webglcontextlost', onLost);
			airCanvas.removeEventListener('webglcontextlost', onLost);
			cancel = undefined;
			running = false;
		}
	}
	onDestroy(() => cancel?.());
</script>

<svelte:head><title>Compatibility check</title></svelte:head>
<main>
	<h1>Compatibility check</h1>
	<p>Run this check before your session. It takes about 10 seconds.</p>
	<button onclick={run} disabled={running}>Run compatibility check</button>
	<div aria-live="polite">
		{#if running}<p>Checking…</p>{:else if result.startsWith('PASS')}<p>{result}</p><p>Read this code to the facilitator.</p>{:else if result}<p>{result}</p><p>Compatibility issue, not you. Try another browser or device, or let the facilitator know.</p>{/if}
	</div>
</main>
<style>
	:global(body) { margin: 0; background: #102525; color: #eef1e5; font-family: system-ui, sans-serif; }
	main { max-width: 36rem; margin: 12vh auto; padding: 2rem; }
	h1 { font-size: 2rem; }
	p { line-height: 1.6; }
	button { padding: .8rem 1.2rem; border: 1px solid #c9d6bf; border-radius: .35rem; background: #dce8d2; color: #102525; font: inherit; cursor: pointer; }
	button:disabled { opacity: .6; cursor: wait; }
</style>
