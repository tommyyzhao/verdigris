import { expect, it } from 'vitest';
import { mount, tick, unmount } from 'svelte';
import { commands, page } from 'vitest/browser';
import Check from './+page.svelte';
import Title from '../game/Title.svelte';
import { LEVELS } from '../game/levels.js';

const browser = commands as unknown as {
	setViewport(size: { width: number; height: number }): Promise<void>;
	captureCanvasScreenshot(rect: {
		x: number;
		y: number;
		width: number;
		height: number;
	}): Promise<string>;
	writeBenchBase64(path: string, content: string): Promise<void>;
};
async function shot(name: string) {
	await browser.writeBenchBase64(
		`/tmp/verdigris-v3/ready/${name}.png`,
		await browser.captureCanvasScreenshot({
			x: 0,
			y: 0,
			width: innerWidth,
			height: innerHeight,
		})
	);
}
it('runs the neutral compatibility check without room names', async () => {
	await browser.setViewport({ width: 1480, height: 940 });
	await page.viewport(1440, 900);
	const target = document.createElement('div');
	document.body.append(target);
	let component = mount(Check, { target });
	try {
		await tick();
		await shot('check-before');
		(target.querySelector('button') as HTMLButtonElement).click();
		await expect
			.poll(() => target.textContent, { timeout: 30000 })
			.toContain('PASS');
		for (const level of LEVELS)
			expect(target.textContent).not.toContain(level.name);
		await shot('check-pass');
		await unmount(component);
		component = mount(Title, { target, props: { onenter() {}, onnew() {} } });
		await tick();
		await shot('title');
	} finally {
		await unmount(component);
		target.remove();
	}
}, 40000);
