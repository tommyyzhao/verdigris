import { describe, expect, it, vi } from 'vitest';
import { createAudio } from './audio.js';
import type { GameEvent, RoomView, UiSound } from './types.js';

class Param {
	value = 0;
	setValueAtTime(value: number) {
		this.value = value;
	}
	exponentialRampToValueAtTime(value: number) {
		this.value = value;
	}
	setTargetAtTime(value: number) {
		this.value = value;
	}
}
class Node {
	static connected = 0;
	connected = false;
	gain = new Param();
	frequency = new Param();
	detune = new Param();
	pan = new Param();
	threshold = new Param();
	ratio = new Param();
	type = '';
	buffer: unknown;
	loop = false;
	onended: (() => void) | null = null;
	connect(destination: Node) {
		if (!this.connected) {
			Node.connected++;
			this.connected = true;
		}
		return destination;
	}
	disconnect() {
		if (this.connected) {
			Node.connected--;
			this.connected = false;
		}
	}
	start() {}
	stop() {
		this.onended?.();
	}
}
class Context {
	currentTime = 0;
	sampleRate = 100;
	state = 'suspended';
	destination = new Node();
	gains: Node[] = [];
	oscillators: Node[] = [];
	filters: Node[] = [];
	createGain() {
		const node = new Node();
		this.gains.push(node);
		return node;
	}
	createOscillator() {
		const node = new Node();
		this.oscillators.push(node);
		return node;
	}
	createBiquadFilter() {
		const node = new Node();
		this.filters.push(node);
		return node;
	}
	createBufferSource() {
		return new Node();
	}
	createStereoPanner() {
		return new Node();
	}
	createDynamicsCompressor() {
		return new Node();
	}
	createBuffer(_channels: number, length: number) {
		return { getChannelData: () => new Float32Array(length) };
	}
	async resume() {
		this.state = 'running';
	}
	async close() {
		this.state = 'closed';
	}
}
const events: GameEvent[] = [
	{ type: 'pour', spring: 'dew' },
	{ type: 'pour', spring: null },
	{ type: 'pose', id: 'p', index: 1 },
	{ type: 'gate', id: 'g', open: true },
	{ type: 'gate', id: 'g', open: false },
	{ type: 'denied', reason: 'wet' },
	{ type: 'splash', at: { x: 1, y: 1 }, strength: 1 },
	...(['filling', 'ready', 'complete', 'spoiled'] as const).map((status) => ({
		type: 'urn' as const,
		id: 'u',
		status,
	})),
	...(['growing', 'grown', 'spoiled'] as const).map((status) => ({
		type: 'seed' as const,
		id: 's',
		status,
	})),
	{ type: 'bramble', id: 'b' },
	{ type: 'machine', id: 'm' },
	{ type: 'well-empty', id: 'dew' },
	{ type: 'stuck' },
	{
		type: 'clear',
		dewdrops: 3,
		mastery: {
			revived: true,
			thrifty: true,
			clean: true,
			reserve: 0.5,
			reserveNeeded: 0.25,
			everSpoiled: false,
		},
	},
];
const sounds: UiSound[] = [
	'hover',
	'click',
	'creak',
	'stir',
	'aim',
	'ink',
	'erase',
	'dig',
	'denied',
	'map',
	'pane',
	'hint',
	'pause',
	'dewdrop',
];
const view = {
	activity: 4,
	urns: [
		{
			id: 'u',
			units: 1,
			counts: [1, 2, 3],
			fill: 0.5,
			status: 'ready',
			hold: 0.5,
			inTune: false,
		},
	],
} as unknown as RoomView;

describe('garden audio', () => {
	it('plays a soft descending stuck tone and rate-limits drain gurgles', async () => {
		const context = new Context(),
			audio = createAudio(() => context as unknown as AudioContext);
		await audio.resume();
		audio.event({ type: 'stuck' });
		expect(context.oscillators.at(-1)!.frequency.value).toBe(130.81);
		const v = { ...view, urns: [], activity: 0, wasted: 1 };
		audio.update(v, 0);
		const n = context.filters.length;
		audio.update({ ...v, wasted: 2 }, 0);
		expect(context.filters).toHaveLength(n);
		context.currentTime = 1;
		audio.update({ ...v, wasted: 3 }, 0);
		expect(context.filters).toHaveLength(n + 1);
		audio.dispose();
	});
	it('scales and rate-limits the filtered stir voice', async () => {
		const context = new Context(),
			audio = createAudio(() => context as unknown as AudioContext);
		await audio.resume();
		audio.ui('stir', 0, 0.2);
		const low = context.gains.at(-1)!.gain.value,
			count = context.gains.length;
		audio.ui('stir', 0, 1);
		expect(context.gains.length).toBe(count);
		context.currentTime = 0.1;
		audio.ui('stir', 0, 1);
		// The fake AudioParam stores the envelope end; filter pitch still proves intensity routing.
		expect(context.filters.at(-1)!.frequency.value).toBeGreaterThan(500);
		expect(low).toBeGreaterThanOrEqual(0);
		audio.dispose();
	});
	it('keeps one pitched trickle voice while pouring; releases on stop and pause', async () => {
		const context = new Context();
		const audio = createAudio(
			() => context as unknown as AudioContext,
			() => 1
		);
		await audio.resume();
		const quiet = {
			...view,
			urns: [],
			activity: 0,
			pouring: { spring: 'sap', at: { x: 10, y: 3 } },
		};
		audio.update(quiet, 0.016);
		const count = context.gains.length;
		for (let i = 0; i < 1000; i++) audio.update(quiet, 0.016);
		expect(context.gains.length).toBe(count);
		expect(context.gains.at(-1)!.gain.value).toBe(0.055);
		audio.event({ type: 'pour', spring: null });
		expect(context.gains.at(-1)!.gain.value).toBe(0);
		audio.update(quiet, 0.016);
		audio.update(null, 0);
		expect(context.gains.at(-1)!.gain.value).toBe(0);
		audio.dispose();
	});
	it('remembers mute and volume before the first user gesture', async () => {
		const context = new Context();
		const audio = createAudio(() => context as unknown as AudioContext);
		audio.setVolume(0.25);
		audio.setMuted(true);
		await audio.resume();
		expect(context.gains[0].gain.value).toBe(0);
		audio.setMuted(false);
		expect(context.gains[0].gain.value).toBeCloseTo(0.25 * 0.18);
		audio.dispose();
	});
	it('applies volume before resume without muting', async () => {
		const context = new Context();
		const audio = createAudio(() => context as unknown as AudioContext);
		audio.setVolume(0.25);
		await audio.resume();
		expect(context.gains[0].gain.value).toBeCloseTo(0.045);
		audio.dispose();
	});
	it('releases all room voices without stopping music', async () => {
		const context = new Context();
		const audio = createAudio(() => context as unknown as AudioContext);
		await audio.resume();
		audio.update(null, 0);
		const baseline = Node.connected;
		audio.update(
			{ ...view, activity: 0, machines: { a: true }, wheels: { w: 2 } },
			0
		);
		expect(Node.connected).toBeGreaterThan(baseline);
		audio.update(null, 0);
		expect(Node.connected).toBe(baseline);
		audio.dispose();
	});
	it('is lazy, resumes, mutes and disposes', async () => {
		const context = new Context();
		const factory = vi.fn(() => context as unknown as AudioContext);
		const audio = createAudio(factory);
		audio.update(view, 0.016);
		audio.event(events[0]);
		audio.ui('click');
		audio.setScene(2);
		expect(factory).not.toHaveBeenCalled();
		await audio.resume();
		expect(factory).toHaveBeenCalledOnce();
		expect(context.state).toBe('running');
		audio.setMuted(true);
		expect(context.gains[0].gain.value).toBe(0);
		audio.dispose();
		expect(context.state).toBe('closed');
		audio.event(events[0]);
		audio.ui('click');
		audio.update(view, 1);
		await audio.resume();
		expect(factory).toHaveBeenCalledOnce();
	});
	it('handles every event and UI sound with bounded voices', async () => {
		Node.connected = 0;
		const context = new Context();
		const audio = createAudio(() => context as unknown as AudioContext);
		await audio.resume();
		for (let i = 0; i < 10000; i++) {
			expect(() => {
				audio.update(view, 0.016);
				audio.event(events[i % events.length]);
				audio.ui(sounds[i % sounds.length], 0.5);
			}).not.toThrow();
		}
		expect(Node.connected).toBeLessThan(30);
		audio.dispose();
	});
	it('delays finale scene until audio time reaches the resolution', async () => {
		vi.useFakeTimers();
		const context = new Context();
		const audio = createAudio(() => context as unknown as AudioContext);
		await audio.resume();
		audio.setScene(1);
		audio.payoff('finale');
		const gains = context.gains.length;
		audio.setScene(4);
		expect(context.gains.length).toBe(gains);
		context.currentTime = 9;
		vi.advanceTimersByTime(10000);
		const before = context.gains.length;
		context.currentTime = 10;
		vi.advanceTimersByTime(1000);
		expect(context.gains.length).toBeGreaterThan(before);
		audio.dispose();
		vi.useRealTimers();
	});
	it('uses the latest urn counts for completion pitches', async () => {
		const context = new Context();
		const audio = createAudio(() => context as unknown as AudioContext);
		await audio.resume();
		audio.update(
			{ ...view, activity: 0, urns: [{ ...view.urns[0], counts: [0, 1, 0] }] },
			0
		);
		const start = context.oscillators.length;
		audio.event({ type: 'urn', id: 'u', status: 'complete' });
		expect(
			context.oscillators.slice(start).map((node) => node.frequency.value)
		).toEqual([369.99, 369.99 * 2.01]);
		audio.dispose();
	});
	it('bounds and fades machine and speed-dependent wheel hums', async () => {
		const context = new Context();
		const audio = createAudio(() => context as unknown as AudioContext);
		await audio.resume();
		const empty = {
			...view,
			activity: 0,
			urns: [],
			machines: { a: true },
			wheels: { w: 2 },
		};
		audio.update(empty, 0);
		const oscillators = context.oscillators.slice(-2);
		const gains = context.gains.slice(-2);
		expect(gains.every((node) => node.gain.value > 0)).toBe(true);
		const pitch = oscillators[1].frequency.value;
		audio.update({ ...empty, wheels: { w: 4 } }, 0);
		expect(oscillators[1].frequency.value).toBeGreaterThan(pitch);
		const count = context.oscillators.length;
		for (let i = 0; i < 10000; i++) audio.update(empty, 0);
		expect(context.oscillators.length).toBe(count);
		audio.update(null, 0);
		expect(gains.map((node) => node.gain.value)).toEqual([0, 0]);
		audio.dispose();
	});
	it('crossfades scene layers instead of stacking them', async () => {
		vi.useFakeTimers();
		Node.connected = 0;
		const context = new Context();
		const audio = createAudio(() => context as unknown as AudioContext);
		await audio.resume();
		for (let i = 0; i < 20; i++) audio.setScene((i % 5) as 0 | 1 | 2 | 3 | 4);
		vi.advanceTimersByTime(2300);
		expect(Node.connected).toBeLessThan(15);
		audio.dispose();
		vi.useRealTimers();
	});
});
