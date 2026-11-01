import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { dirname } from 'node:path';
import { sveltekit } from '@sveltejs/kit/vite';
import { defineConfig, defineProject } from 'vitest/config';
import { playwright } from '@vitest/browser-playwright';
import { studyBuildHash } from './scripts/study-build-hash.mjs';

const browserProject = defineProject({
	extends: true,
	test: {
		name: 'browser',
		include: ['src/**/*.browser.test.ts'],
		exclude: ['.svelte-kit/**', 'build/**'],
		env: {
			// Explicit local Chrome is a hardware gate, not a software skip run.
			SVELTE_FLUID_HARDWARE_GATE: process.env.VITEST_CHROME_PATH ? '1' : '',
			SVELTE_FLUID_GPU_BENCH: process.env.SVELTE_FLUID_GPU_BENCH ?? '',
			SVELTE_FLUID_GPU_BENCH_OUT: process.env.SVELTE_FLUID_GPU_BENCH_OUT ?? ''
		},
		// Real-GPU suites contend for one GPU; keep files serial.
		fileParallelism: false,
		testTimeout: 60000,
		hookTimeout: 30000,
		browser: {
			enabled: true,
			headless: true,
			// VITEST_CHROME_PATH selects a hardware-capable installed Chrome.
			provider: playwright(
				process.env.VITEST_CHROME_PATH
					? { launchOptions: { executablePath: process.env.VITEST_CHROME_PATH, ignoreDefaultArgs: ['--enable-unsafe-swiftshader'] } }
					: {}
			),
			instances: [{ browser: 'chromium' }],
			commands: {
				async setViewport(ctx: { page: any }, size: { width: number; height: number }) {
					await ctx.page.setViewportSize(size);
				},
				async captureCanvasScreenshot(ctx: { page: any; frame: () => Promise<any> }, rect: { x: number; y: number; width: number; height: number }) {
					const frame = await ctx.frame();
					const offset = await (await frame.frameElement()).boundingBox();
					return (await ctx.page.screenshot({ clip: { ...rect, x: offset.x + rect.x, y: offset.y + rect.y } })).toString('base64');
				},
				async emulateControlMedia(ctx: { page: any }, media: { forcedColors?: 'active' | 'none'; reducedMotion?: 'reduce' | 'no-preference' }) {
					await ctx.page.emulateMedia(media);
				},
				// Built-in writeFile is confined to the project root; the GPU bench
				// writes its JSON to an arbitrary path (default /tmp).
				async readSolverCheckpoint(_ctx: unknown, name: string, dir = '/tmp/verdigris-v3/solver') {
					if (!/^[a-z0-9-]+$/.test(name)) throw new Error('Invalid solver checkpoint name');
					if (!/^\/tmp\/verdigris-v3\/[a-z0-9/-]+$/.test(dir)) throw new Error('Invalid solver checkpoint directory');
					try { return await readFile(`${dir}/${name}.json`, 'utf8'); }
					catch (error) { if ((error as NodeJS.ErrnoException).code === 'ENOENT') return '[]'; throw error; }
				},
				async writeBenchJson(_ctx: unknown, path: string, content: string) {
					await mkdir(dirname(path), { recursive: true });
					await writeFile(path, content);
				},
				// Real mouse drag with intermediate moves (userEvent.dragAndDrop sends
				// none); coordinates are relative to the test iframe viewport.
				async dragMouse(ctx: { page: any; frame: () => Promise<any> }, x0: number, y0: number, x1: number, y1: number) {
					const frame = await ctx.frame();
					const offset = await (await frame.frameElement()).boundingBox();
					const { mouse } = ctx.page;
					await mouse.move(offset.x + x0, offset.y + y0);
					await mouse.down();
					await mouse.move(offset.x + x1, offset.y + y1, { steps: 24 });
					await mouse.up();
				},
				// Evidence frames (PNG) from the contrast measurement; base64 payload.
				async writeBenchBase64(_ctx: unknown, path: string, base64: string) {
					await mkdir(dirname(path), { recursive: true });
					await writeFile(path, Buffer.from(base64, 'base64'));
				}
			}
		}
	}
});

const nodeProject = defineProject({
	extends: true,
	test: {
		name: 'node',
		environment: 'node',
		include: ['src/**/*.test.ts'],
		exclude: ['.svelte-kit/**', 'build/**', 'src/**/*.browser.test.ts']
	}
});

export default defineConfig({
	define: { 'import.meta.env.VITE_STUDY_BUILD_HASH': JSON.stringify(studyBuildHash(new URL('.', import.meta.url))) },
	cacheDir: '.svelte-kit/vitest-cache',
	plugins: [sveltekit()],
	test: {
		projects: [nodeProject, ...(process.env.VITEST_BROWSER ? [browserProject] : [])]
	}
});
