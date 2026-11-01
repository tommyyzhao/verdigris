import { afterEach, expect, it } from 'vitest';
import { mount, tick, unmount } from 'svelte';
import { commands, page } from 'vitest/browser';
import Finale from './game/Finale.svelte';
import Map from './game/Map.svelte';
import Title from './game/Title.svelte';
import { LEVELS } from './game/levels.js';

const browser = commands as unknown as {
	setViewport(size: { width: number; height: number }): Promise<void>;
	emulateControlMedia(media: {
		reducedMotion: 'reduce' | 'no-preference';
	}): Promise<void>;
	captureCanvasScreenshot(rect: {
		x: number;
		y: number;
		width: number;
		height: number;
	}): Promise<string>;
	writeBenchBase64(path: string, content: string): Promise<void>;
};
let component: ReturnType<typeof mount> | undefined;
let target: HTMLDivElement;
const wait = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));
async function setup(width = 1440, height = 900) {
	await browser.setViewport({ width: width + 40, height: height + 40 });
	await page.viewport(width, height);
	target = document.createElement('div');
	target.style.cssText =
		'position:fixed;inset:0;font-family:system-ui,sans-serif;isolation:isolate';
	document.body.append(target);
}
async function shot(name: string) {
	await tick();
	await browser.writeBenchBase64(
		`/tmp/verdigris-ui/art-${name}.png`,
		await browser.captureCanvasScreenshot({
			x: 0,
			y: 0,
			width: innerWidth,
			height: innerHeight,
		})
	);
}
afterEach(async () => {
	if (component) await unmount(component);
	component = undefined;
	target?.remove();
	await browser.emulateControlMedia({ reducedMotion: 'no-preference' });
});

it('art: liquid travels before blooms, dawn leaves a living garden', async () => {
	await setup();
	component = mount(Finale, {
		target,
		props: { rooms: 9, dewdrops: 27, onwander() {} },
	});
	await wait(1900);
	expect(document.querySelectorAll('.veins path')).toHaveLength(3);
	expect(document.querySelectorAll('.water-floor')).toHaveLength(9);
	const vein = document.querySelector('.veins path')!;
	const bloom = document.querySelector('.bloom')!;
	expect(
		Number.parseFloat(getComputedStyle(vein).strokeDashoffset)
	).toBeLessThan(1);
	expect(Number.parseFloat(getComputedStyle(bloom).opacity)).toBe(0);
	await shot('liquid-arrives');
	await wait(4700);
	await shot('finale-mid');
	await unmount(component);
	component = mount(Finale, {
		target,
		props: { quiet: true, rooms: 9, dewdrops: 27, onwander() {} },
	});
	await wait(3300);
	await shot('garden');
	expect(getComputedStyle(document.querySelector('.dawn-sky')!).opacity).toBe(
		'1'
	);
	expect(document.querySelectorAll('.pane-lantern .lit')).toHaveLength(9);
	expect(document.querySelectorAll('.new-leaf')).toHaveLength(173);
});

it('art: dormant title, frosted locked panes, warm earned panes', async () => {
	await setup();
	component = mount(Title, { target, props: { onenter() {}, onnew() {} } });
	await shot('title');
	await unmount(component);
	component = mount(Map, {
		target,
		props: {
			levels: LEVELS,
			progress: {
				version: 2,
				cleared: Object.fromEntries(
					LEVELS.slice(0, 3).map((level, i) => [level.id, i + 1])
				),
				finale: false,
			},
			available: 4,
			onselect() {},
			onback() {},
		},
	});
	await wait(200);
	await shot('map');
	expect(document.querySelectorAll('.earned-drops')).toHaveLength(3);
	expect(document.querySelectorAll('.room-pane.locked')).toHaveLength(LEVELS.length - 4);
	expect(document.querySelectorAll('.room-pane.clear')).toHaveLength(3);
});

it('art: reduced motion crossfades without moving foliage or flowing strokes', async () => {
	await setup(390, 844);
	await browser.emulateControlMedia({ reducedMotion: 'reduce' });
	component = mount(Finale, {
		target,
		props: { quiet: true, rooms: 9, dewdrops: 27, onwander() {} },
	});
	await wait(3300);
	await shot('garden-portrait-reduced');
	expect(
		getComputedStyle(document.querySelector('.whole-garden')!).animationName
	).toBe('none');
	expect(
		Number.parseFloat(
			getComputedStyle(document.querySelector('.water-floor')!).strokeDashoffset
		)
	).toBe(0);
	expect(getComputedStyle(document.querySelector('.petal')!).display).toBe(
		'none'
	);
	expect(
		getComputedStyle(document.querySelector('.flame')!).animationName
	).toBe('none');
});
